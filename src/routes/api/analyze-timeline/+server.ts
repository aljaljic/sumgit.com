import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getInstallationOctokit } from '$lib/github-app';
import { analyzeMilestones, analyzeCommitsInChunks, type Commit, type MilestoneInput } from '$lib/openai';
import type { Repository, Milestone, GitHubInstallation } from '$lib/database.types';
import { checkAndDeductCredits, refundCredits } from '$lib/server/credits';
import { CREDIT_COSTS } from '$lib/credits';

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
		const maxCommitsWithDiff = 40; // Cloudflare subrequest limit

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

		console.log(`Timeline analysis: Fetched ${commits.length} commits`);

		if (commits.length === 0) {
			throw error(400, 'No commits found in repository');
		}

		// Helper function to fetch and process a single commit diff
		const fetchCommitDiff = async (commit: Commit): Promise<void> => {
			try {
				const { data: commitDetail } = await octokit.repos.getCommit({
					owner: repo.repo_owner,
					repo: repo.repo_name,
					ref: commit.sha
				});

				// Extract stats
				commit.files_changed = commitDetail.files?.length ?? 0;
				commit.additions = commitDetail.stats?.additions ?? 0;
				commit.deletions = commitDetail.stats?.deletions ?? 0;

				// Build a truncated diff summary (max 2000 chars per commit)
				if (commitDetail.files && commitDetail.files.length > 0) {
					const diffParts: string[] = [];
					let totalDiffLength = 0;
					const maxDiffLength = 2000;

					for (const file of commitDetail.files) {
						if (totalDiffLength >= maxDiffLength) break;

						const fileHeader = `\n--- ${file.filename} (${file.status})\n`;
						const patch = file.patch || '';

						// Truncate patch if needed
						const remaining = maxDiffLength - totalDiffLength - fileHeader.length;
						const truncatedPatch = patch.length > remaining
							? patch.substring(0, remaining) + '\n... (truncated)'
							: patch;

						diffParts.push(fileHeader + truncatedPatch);
						totalDiffLength += fileHeader.length + truncatedPatch.length;
					}

					commit.diff = diffParts.join('\n');
				}
			} catch (err: any) {
				const errorStatus = err?.status || err?.response?.status;
				const errorMessage = err?.message || String(err);

				// Check for Cloudflare subrequest limit error
				const errorMsg = (errorMessage || '').toLowerCase();
				const isSubrequestLimit = errorMsg.includes('too many subrequests');

				if (isSubrequestLimit) {
					const subrequestError = new Error('Too many subrequests');
					(subrequestError as any).isSubrequestLimit = true;
					throw subrequestError;
				}

				console.error(`Error fetching commit ${commit.sha}:`, {
					status: errorStatus,
					message: errorMessage
				});

				// For 500/403/404 errors, continue without diff
				if (errorStatus === 500 || errorStatus === 403 || errorStatus === 404) {
					console.warn(`Skipping diff for commit ${commit.sha} (status: ${errorStatus})`);
					return;
				}

				// Rate limit - stop processing
				if (errorStatus === 429 || errorMsg.includes('rate limit')) {
					console.warn(`GitHub API rate limit hit, stopping diff fetches`);
					throw err;
				}

				// For other errors, continue without diff
				console.warn(`Failed to fetch diff for commit ${commit.sha}, continuing without diff`);
			}
		};

		// Fetch diffs for only the most recent commits (limited by Cloudflare subrequest limit)
		const commitsToFetchDiffs = commits.slice(0, maxCommitsWithDiff);
		let hitSubrequestLimit = false;

		for (let i = 0; i < commitsToFetchDiffs.length; i++) {
			if (hitSubrequestLimit) break;

			try {
				await fetchCommitDiff(commitsToFetchDiffs[i]);
			} catch (err) {
				if (err instanceof Error && (
					err.message.includes('Too many subrequests') ||
					(err as any).isSubrequestLimit
				)) {
					hitSubrequestLimit = true;
					console.warn(`Hit subrequest limit at commit ${i + 1}`);
					break;
				}
				// Continue for other errors
			}

			// Small delay between requests
			if (i < commitsToFetchDiffs.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		// Sort commits by date for chronological analysis
		const commitsForAnalysis = commits.sort((a, b) => {
			return new Date(a.date).getTime() - new Date(b.date).getTime();
		});

		// Log summary
		const commitsWithDiffs = commitsForAnalysis.filter(c => c.diff).length;
		console.log(`Timeline analysis: Analyzing ${commitsForAnalysis.length} commits (${commitsWithDiffs} with diffs)`);

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
				console.log(`Timeline OpenAI analysis successful: ${milestones.length} milestones found`);
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
						console.warn(`OpenAI connection error, retrying (${retryCount}/${maxRetries})...`);
						const backoffDelay = 1000 * retryCount + Math.random() * 1000;
						await new Promise((resolve) => setTimeout(resolve, backoffDelay));
						continue;
					} else {
						console.warn('Max retries reached for OpenAI, attempting final request...');
						try {
							milestones = await analyzeCommitsInChunks(`${repo.repo_owner}/${repo.repo_name}`, commitsForAnalysis);
							console.log(`Timeline OpenAI analysis successful on final attempt: ${milestones.length} milestones found`);
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
				console.error('Insert milestones error:', insertError);
			}
		}

		// Update last_analyzed_at
		await locals.supabase
			.from('repositories')
			.update({ last_analyzed_at: new Date().toISOString() } as Partial<Repository>)
			.eq('id', repository_id);

		const commitsWithDiffsCount = commitsForAnalysis.filter(c => c.diff).length;

		return json({
			success: true,
			milestones_count: milestones.length,
			commits_analyzed: commitsForAnalysis.length,
			commits_with_diffs: commitsWithDiffsCount,
			total_commits: commits.length,
			credits_remaining: creditResult.newBalance
		});
	} catch (err) {
		console.error('Timeline analysis error:', err);

		// Refund credits on failure
		if (creditsDeducted) {
			await refundCredits(user.id, 'timeline_analyze', 'Refund due to timeline analysis failure');
		}

		if (err instanceof Error) {
			const errorMsg = err.message.toLowerCase();

			if (errorMsg.includes('openai') || errorMsg.includes('connection error') || errorMsg.includes('timeout')) {
				throw error(503, 'AI analysis service temporarily unavailable. Please try again.');
			}

			if (errorMsg.includes('github') || errorMsg.includes('api rate limit')) {
				throw error(429, 'GitHub API rate limit reached. Please try again later.');
			}

			if (errorMsg.includes('403') || errorMsg.includes('forbidden') || errorMsg.includes('permission')) {
				throw error(403, 'Access denied. Please ensure the GitHub App has access to this repository.');
			}

			throw error(500, `Timeline analysis failed: ${err.message}`);
		}

		throw error(500, 'Failed to analyze repository timeline. Please check the logs for details.');
	}
};
