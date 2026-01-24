import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getInstallationOctokit } from '$lib/github-app';
import type { Commit } from '$lib/openai';
import type { Repository, Milestone, GitHubInstallation } from '$lib/database.types';
import { checkAndDeductCredits, refundCredits } from '$lib/server/credits';
import { CREDIT_COSTS } from '$lib/credits';
import { handleError } from '$lib/server/errors';
import { secureLog } from '$lib/server/logger';
import { runAnalysisWorkflow, type WorkflowMilestone } from '$lib/server/agents/workflow';
import { extractSiteUrl } from '$lib/server/site-url-extractor';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { Database } from '$lib/database.types';

const supabaseAdmin = createClient<Database>(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);
const SCREENSHOT_BUCKET = 'milestone-screenshots';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const { repository_id } = await request.json();

	if (!repository_id) {
		throw error(400, 'Repository ID required');
	}

	// Check and deduct credits before processing
	const creditResult = await checkAndDeductCredits(user.id, 'quick_analyze', repository_id);
	if (!creditResult.success) {
		throw error(402, {
			message: creditResult.error || 'Insufficient credits',
			credits_required: CREDIT_COSTS.quick_analyze,
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
		// Fetch commits from the repository (limited to 100 commits with diffs)
		const commits: Commit[] = [];
		const maxCommits = 100; // Only analyze the most recent 100 commits
		// Cloudflare Workers has a 50 subrequest limit (free plan)
		// Reserve ~10 for: listCommits, repo access check, OpenAI call + retries
		const maxCommitsWithDiff = 40; // Get diffs for top 40 commits to stay under subrequest limit

		// Fetch recent commits (up to 100)
		const { data } = await octokit.repos.listCommits({
			owner: repo.repo_owner,
			repo: repo.repo_name,
			per_page: maxCommits
		});

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

		secureLog.info(`Fetched ${commits.length} commits`);

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
						const truncatedPatch =
							patch.length > remaining
								? patch.substring(0, remaining) + '\n... (truncated)'
								: patch;

						diffParts.push(fileHeader + truncatedPatch);
						totalDiffLength += fileHeader.length + truncatedPatch.length;
					}

					commit.diff = diffParts.join('\n');
				}
			} catch (err: any) {
				// Enhanced error logging for debugging
				const errorStatus = err?.status || err?.response?.status;
				const errorMessage = err?.message || String(err);
				const errorDetails = err?.response?.data || err;

				// Check for Cloudflare subrequest limit error
				const errorMsg = (errorMessage || '').toLowerCase();
				const detailsMsg = (errorDetails?.message || String(errorDetails || '')).toLowerCase();
				const isSubrequestLimit =
					errorMsg.includes('too many subrequests') ||
					detailsMsg.includes('too many subrequests') ||
					(errorStatus === 500 &&
						(errorMsg.includes('subrequest') || detailsMsg.includes('subrequest')));

				if (isSubrequestLimit) {
					const subrequestError = new Error('Too many subrequests');
					(subrequestError as any).isSubrequestLimit = true;
					throw subrequestError;
				}

				secureLog.error(`Error fetching commit ${commit.sha}:`, {
					status: errorStatus,
					message: errorMessage
				});

				// Check for specific error types
				if (err instanceof Error || typeof err === 'object') {
					if (
						errorStatus === 500 ||
						errorMsg.includes('500') ||
						errorMsg.includes('internal server error')
					) {
						secureLog.warn(
							`GitHub API 500 error for commit - may indicate permission issue for private repos`
						);
						return;
					}

					if (errorStatus === 403 || errorMsg.includes('403') || errorMsg.includes('forbidden')) {
						secureLog.warn(
							'Permission denied for commit - GitHub App may need additional permissions for private repos'
						);
						throw new Error(
							'GitHub App permission denied. Please ensure the app has "Contents" read permission for private repositories.'
						);
					}

					if (errorStatus === 429 || errorMsg.includes('rate limit')) {
						secureLog.warn('GitHub API rate limit hit, stopping diff fetches');
						throw err;
					}

					if (errorStatus === 404 || errorMsg.includes('404') || errorMsg.includes('not found')) {
						secureLog.warn('Commit not found, skipping diff');
						return;
					}
				}

				secureLog.warn('Failed to fetch diff for commit, continuing without diff');
			}
		};

		// Fetch diffs sequentially to avoid hitting Cloudflare's subrequest limit
		const commitsToFetchDiffs = commits.slice(0, maxCommitsWithDiff);
		const concurrencyLimit = 1;
		let hitSubrequestLimit = false;
		let consecutiveFailures = 0;
		const maxConsecutiveFailures = 5;

		for (let i = 0; i < commitsToFetchDiffs.length; i += concurrencyLimit) {
			if (hitSubrequestLimit) break;

			const batch = commitsToFetchDiffs.slice(i, i + concurrencyLimit);

			const results = await Promise.allSettled(
				batch.map(async (commit) => {
					try {
						await fetchCommitDiff(commit);
						return { success: true, hasDiff: !!commit.diff };
					} catch (err) {
						if (
							err instanceof Error &&
							(err.message.includes('Too many subrequests') ||
								(err as any).isSubrequestLimit)
						) {
							throw err;
						}
						if (err instanceof Error && err.message.includes('permission denied')) {
							throw err;
						}
						return { success: false, hasDiff: false };
					}
				})
			);

			const batchResults = results.map((r) =>
				r.status === 'fulfilled' ? r.value : { success: false, hasDiff: false }
			);
			const batchSuccess = batchResults.some((r) => r.success && r.hasDiff);

			if (batchSuccess) {
				consecutiveFailures = 0;
			} else {
				consecutiveFailures++;
				if (consecutiveFailures >= maxConsecutiveFailures) {
					secureLog.warn(
						`Stopping diff fetches after ${consecutiveFailures} consecutive failures - likely a permissions issue for private repos`
					);
					break;
				}
			}

			const hasCriticalError = results.some(
				(result) =>
					result.status === 'rejected' &&
					result.reason instanceof Error &&
					(result.reason.message.includes('Too many subrequests') ||
						(result.reason as any).isSubrequestLimit ||
						result.reason.message.includes('permission denied'))
			);

			if (hasCriticalError) {
				const error = results.find((r) => r.status === 'rejected')?.reason;
				if (error instanceof Error && error.message.includes('permission denied')) {
					throw error;
				}
				hitSubrequestLimit = true;
				const commitsWithDiffs = commits.filter((c) => c.diff).length;
				secureLog.warn(
					`Hit subrequest limit at commit batch. Successfully fetched ${commitsWithDiffs} commits with diffs.`
				);
				break;
			}

			if (i + concurrencyLimit < commitsToFetchDiffs.length) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		// Sort commits by date for chronological analysis
		const commitsForAnalysis = commits.sort((a, b) => {
			return new Date(a.date).getTime() - new Date(b.date).getTime();
		});

		const commitsWithDiffs = commitsForAnalysis.filter((c) => c.diff).length;
		const commitsWithoutDiffs = commitsForAnalysis.length - commitsWithDiffs;
		secureLog.info(
			`Analyzing ${commitsForAnalysis.length} commits (${commitsWithDiffs} with diffs, ${commitsWithoutDiffs} without diffs)`
		);

		if (commitsForAnalysis.length === 0) {
			throw error(400, 'No commits available for analysis');
		}

		// Get or extract site URL for screenshots
		let siteUrl = repo.site_url;
		let siteUrlSource = repo.site_url_source;

		if (!siteUrl && octokit) {
			const extracted = await extractSiteUrl(octokit, repo.repo_owner, repo.repo_name);
			siteUrl = extracted.url;
			siteUrlSource = extracted.source;

			if (siteUrl) {
				await locals.supabase
					.from('repositories')
					.update({
						site_url: siteUrl,
						site_url_source: siteUrlSource
					})
					.eq('id', repository_id);
			}
		}

		// Get browser binding from platform (Cloudflare Browser Rendering)
		const browserBinding = platform?.env?.BROWSER;

		// Run the multi-agent analysis workflow
		secureLog.info('Starting multi-agent analysis workflow...');

		const workflowResult = await runAnalysisWorkflow({
			commits: commitsForAnalysis.map((c) => ({
				sha: c.sha,
				message: c.message,
				diff: c.diff,
				date: c.date,
				author: c.author,
				files_changed: c.files_changed,
				additions: c.additions,
				deletions: c.deletions
			})),
			siteUrl: siteUrl || undefined,
			browserBinding,
			maxScreenshots: 2
		});

		secureLog.info(
			`Workflow complete: ${workflowResult.milestones.length} milestones, ${workflowResult.analysisDetails.screenshotsCaptured} screenshots`
		);

		// Clear existing quick milestones for this repo
		await locals.supabase
			.from('milestones')
			.delete()
			.eq('repository_id', repository_id)
			.eq('source', 'quick');

		// Insert new milestones and process screenshots
		let insertedMilestoneIds: string[] = [];
		let screenshotCount = 0;

		if (workflowResult.milestones.length > 0) {
			const milestonesToInsert = workflowResult.milestones
				.filter((m) => m.commitDate)
				.map((m: WorkflowMilestone) => ({
					repository_id,
					title: m.title,
					description: m.description,
					commit_sha: m.commitSha,
					milestone_date: m.commitDate.split('T')[0],
					x_post_suggestion: m.xPostSuggestion,
					milestone_type: m.milestoneType || 'other',
					source: 'quick'
				}));

			const { data: insertedData, error: insertError } = await locals.supabase
				.from('milestones')
				.insert(milestonesToInsert as Milestone[])
				.select('id');

			if (insertError) {
				secureLog.error('Insert milestones error:', insertError);
			} else if (insertedData) {
				insertedMilestoneIds = insertedData.map((m: { id: string }) => m.id);
			}

			// Upload screenshots to Supabase Storage and update milestones
			for (let i = 0; i < workflowResult.milestones.length; i++) {
				const milestone = workflowResult.milestones[i];
				const milestoneId = insertedMilestoneIds[i];

				if (milestone.screenshotBase64 && milestoneId) {
					try {
						// Convert base64 to Uint8Array
						const binaryString = atob(milestone.screenshotBase64);
						const imageData = new Uint8Array(binaryString.length);
						for (let j = 0; j < binaryString.length; j++) {
							imageData[j] = binaryString.charCodeAt(j);
						}

						// Generate filename
						const timestamp = Date.now();
						const shortSha = milestone.commitSha.slice(0, 7);
						const filename = `${repository_id}/${timestamp}-${shortSha}-${i}.png`;

						// Upload to Supabase Storage
						const { error: uploadError } = await supabaseAdmin.storage
							.from(SCREENSHOT_BUCKET)
							.upload(filename, imageData, {
								contentType: 'image/png',
								upsert: true
							});

						if (uploadError) {
							secureLog.error(`Screenshot upload failed: ${uploadError.message}`);
							continue;
						}

						// Get public URL
						const { data: urlData } = supabaseAdmin.storage
							.from(SCREENSHOT_BUCKET)
							.getPublicUrl(filename);

						// Update milestone with screenshot URL
						await supabaseAdmin
							.from('milestones')
							.update({ screenshot_url: urlData.publicUrl })
							.eq('id', milestoneId);

						screenshotCount++;
						secureLog.info(`Screenshot uploaded for milestone: ${milestone.title}`);
					} catch (screenshotErr) {
						secureLog.warn(`Failed to upload screenshot for "${milestone.title}":`, screenshotErr);
					}
				}
			}
		}

		// Update last_analyzed_at
		await locals.supabase
			.from('repositories')
			.update({ last_analyzed_at: new Date().toISOString() } as Partial<Repository>)
			.eq('id', repository_id);

		const commitsWithDiffsCount = commitsForAnalysis.filter((c) => c.diff).length;

		return json({
			success: true,
			milestones_count: workflowResult.milestones.length,
			commits_analyzed: commitsForAnalysis.length,
			commits_with_diffs: commitsWithDiffsCount,
			total_commits: commits.length,
			screenshots_captured: screenshotCount,
			credits_remaining: creditResult.newBalance,
			warning: hitSubrequestLimit
				? `Subrequest limit reached. Analyzed ${commitsWithDiffsCount} commits with diffs out of ${commits.length} total.`
				: undefined
		});
	} catch (err) {
		// Refund credits on failure
		if (creditsDeducted) {
			await refundCredits(user.id, 'quick_analyze', 'Refund due to analysis failure');
		}

		// Check for subrequest limit - this is expected and handled gracefully
		if (err instanceof Error) {
			const errorMsg = err.message.toLowerCase();
			if (errorMsg.includes('too many subrequests') || errorMsg.includes('subrequest')) {
				secureLog.warn('Subrequest limit reached, but continuing with available commits');
			}
		}

		// Use sanitized error handling
		handleError(err, 'Analysis');
	}
};
