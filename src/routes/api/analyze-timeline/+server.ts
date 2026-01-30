import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getInstallationOctokit } from '$lib/github-app';
import { analyzeMilestones, analyzeCommitsInChunks, type Commit, type MilestoneInput } from '$lib/openai';
import type { Repository, Milestone, GitHubInstallation } from '$lib/database.types';
import { checkAndDeductCredits, refundCredits } from '$lib/server/credits';
import { CREDIT_COSTS } from '$lib/credits';
import { handleError } from '$lib/server/errors';
import { secureLog } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const { repository_id } = await request.json();

	if (!repository_id) {
		throw error(400, 'Repository ID required');
	}

	// Check and deduct credits before processing
	const creditResult = await checkAndDeductCredits(user.id, 'timeline_analyze', repository_id);
	if (!creditResult.success) {
		throw error(402, {
			message: creditResult.error || 'Insufficient credits',
			credits_required: CREDIT_COSTS.timeline_analyze,
			credits_available: creditResult.newBalance
		} as any);
	}

	let creditsDeducted = true;

	// Get repository details
	const { data: repoData } = await locals.supabase
		.from('repositories')
		.select('*')
		.eq('id', repository_id)
		.eq('user_id', user.id)
		.single();

	const repo = repoData as Repository | null;

	if (!repo) {
		throw error(404, 'Repository not found');
	}

	// Get user's GitHub App installations
	const { data: installations } = await locals.supabase
		.from('github_installations')
		.select('*')
		.eq('user_id', user.id);

	const typedInstallations = (installations ?? []) as GitHubInstallation[];

	if (typedInstallations.length === 0) {
		throw error(400, 'No GitHub App installation found. Please install the GitHub App first.');
	}

	// Find the installation that has access to this repo
	let octokit = null;
	let foundInstallation = null;

	for (const installation of typedInstallations) {
		try {
			const testOctokit = await getInstallationOctokit(installation.installation_id);
			// Try to access the repo to verify we have permission
			await testOctokit.repos.get({
				owner: repo.repo_owner,
				repo: repo.repo_name
			});
			octokit = testOctokit;
			foundInstallation = installation;
			break;
		} catch {
			// This installation doesn't have access to this repo, try the next one
			continue;
		}
	}

	if (!octokit || !foundInstallation) {
		throw error(
			403,
			'No GitHub App installation has access to this repository. Please ensure the app is installed on the repo owner account.'
		);
	}

	try {
		// Fetch commits from the repository (up to 5000 commits for full timeline)
		const commits: Commit[] = [];
		const maxPages = 50; // 50 pages × 100 per page = 5000 commits max
		const perPage = 100;
		// Paginate through commit history
		for (let page = 1; page <= maxPages; page++) {
			const { data } = await octokit.repos.listCommits({
				owner: repo.repo_owner,
				repo: repo.repo_name,
				per_page: perPage,
				page
			});

			if (data.length === 0) {
				break; // No more commits
			}

			for (const commit of data) {
				const message = (commit.commit.message ?? '').split('\n')[0] ?? '';

				// Skip merge commits and very small commits early
				if (message.toLowerCase().startsWith('merge') || message.toLowerCase().startsWith('wip')) {
					continue;
				}

				const commitData: Commit = {
					sha: commit.sha,
					message,
					date: commit.commit.author?.date ?? new Date().toISOString(),
					author: commit.commit.author?.name ?? 'Unknown'
				};

				commits.push(commitData);
			}

			// If we got fewer commits than requested, we've reached the end
			if (data.length < perPage) {
				break;
			}
		}

		secureLog.info(`Timeline analysis: Fetched ${commits.length} commits`);

		if (commits.length === 0) {
			throw error(400, 'No commits found in repository');
		}

		// Sort commits by date for chronological analysis
		const commitsForAnalysis = commits.sort((a, b) => {
			return new Date(a.date).getTime() - new Date(b.date).getTime();
		});

		secureLog.info(`Timeline analysis: Analyzing ${commitsForAnalysis.length} commits`);

		// Ensure we have commits to analyze
		if (commitsForAnalysis.length === 0) {
			throw error(400, 'No commits available for analysis');
		}

		// Analyze commits with OpenAI (always use chunked analysis for timeline)
		let milestones: MilestoneInput[] = [];

		const maxRetries = 3;
		let retryCount = 0;
		let lastError: Error | null = null;

		while (retryCount <= maxRetries) {
			try {
				// Always use chunked analysis for timeline (large repositories)
				milestones = await analyzeCommitsInChunks(`${repo.repo_owner}/${repo.repo_name}`, commitsForAnalysis);
				secureLog.info(`Timeline OpenAI analysis successful: ${milestones.length} milestones found`);
				break;
			} catch (err) {
				lastError = err instanceof Error ? err : new Error(String(err));
				const errorMessage = lastError.message.toLowerCase();

				const isRetryableError = errorMessage.includes('connection error') ||
				                          errorMessage.includes('timeout') ||
				                          errorMessage.includes('econnrefused') ||
				                          errorMessage.includes('etimedout') ||
				                          errorMessage.includes('network') ||
				                          errorMessage.includes('fetch failed');

				if (isRetryableError) {
					retryCount++;
					if (retryCount <= maxRetries) {
						secureLog.warn(`OpenAI connection error, retrying (${retryCount}/${maxRetries})...`);
						const backoffDelay = 1000 * retryCount + Math.random() * 1000;
						await new Promise((resolve) => setTimeout(resolve, backoffDelay));
						continue;
					} else {
						secureLog.warn('Max retries reached for OpenAI, attempting final request...');
						try {
							milestones = await analyzeCommitsInChunks(`${repo.repo_owner}/${repo.repo_name}`, commitsForAnalysis);
							secureLog.info(`Timeline OpenAI analysis successful on final attempt: ${milestones.length} milestones found`);
							break;
						} catch (finalErr) {
							const finalErrorMsg = finalErr instanceof Error ? finalErr.message : String(finalErr);
							throw new Error(`OpenAI service unavailable after ${maxRetries + 1} attempts: ${finalErrorMsg}`);
						}
					}
				}
				throw lastError;
			}
		}

		if (milestones.length === 0 && lastError) {
			throw lastError;
		}

		// Clear existing timeline milestones for this repo
		await locals.supabase.from('milestones').delete().eq('repository_id', repository_id).eq('source', 'timeline');

		// Insert new milestones
		if (milestones.length > 0) {
			const milestonesToInsert = milestones
				.filter((m) => m.milestone_date)
				.map((m) => ({
					repository_id,
					title: m.title,
					description: m.description,
					commit_sha: m.commit_sha,
					milestone_date: (m.milestone_date ?? new Date().toISOString()).split('T')[0],
					x_post_suggestion: m.x_post_suggestion,
					source: 'timeline'
				}));

			const { error: insertError } = await locals.supabase
				.from('milestones')
				.insert(milestonesToInsert as Milestone[]);

			if (insertError) {
				secureLog.error('Insert milestones error:', insertError);
			}
		}

		// Update last_analyzed_at with error checking
		const { error: updateError } = await locals.supabase
			.from('repositories')
			.update({ last_analyzed_at: new Date().toISOString() })
			.eq('id', repository_id);

		if (updateError) {
			secureLog.error('Failed to update last_analyzed_at:', updateError);
		}

		return json({
			success: true,
			milestones_count: milestones.length,
			commits_analyzed: commitsForAnalysis.length,
			total_commits: commits.length,
			credits_remaining: creditResult.newBalance
		});
	} catch (err) {
		// Refund credits on failure
		if (creditsDeducted) {
			await refundCredits(user.id, 'timeline_analyze', 'Refund due to timeline analysis failure');
		}

		// Use sanitized error handling
		handleError(err, 'Timeline analysis');
	}
};
