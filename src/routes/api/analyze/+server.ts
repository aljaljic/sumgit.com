import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { getInstallationOctokit } from '$lib/github-app';
import { analyzeMilestones, type Commit, type MilestoneInput } from '$lib/openai';
import type { Repository, Milestone, GitHubInstallation, Database } from '$lib/database.types';
import { checkAndDeductCredits, refundCredits, getUserCredits } from '$lib/server/credits';
import { CREDIT_COSTS } from '$lib/credits';
import { handleError } from '$lib/server/errors';
import { secureLog } from '$lib/server/logger';
import { processFeatureScreenshots, updateMilestonesWithScreenshots } from '$lib/server/screenshot-service';

// Service role client for admin operations (bypasses RLS)
const supabaseAdmin = createClient<Database>(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);

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
		const maxCommitsToAnalyze = 100; // Limit commits sent to OpenAI per chunk

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
				const { data: commitDetail, status } = await octokit.repos.getCommit({
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
				// Enhanced error logging for debugging
				const errorStatus = err?.status || err?.response?.status;
				const errorMessage = err?.message || String(err);
				const errorDetails = err?.response?.data || err;
				
				// Check for Cloudflare subrequest limit error
				// This can appear in different places in the error object
				const errorMsg = (errorMessage || '').toLowerCase();
				const detailsMsg = (errorDetails?.message || String(errorDetails || '')).toLowerCase();
				const isSubrequestLimit = errorMsg.includes('too many subrequests') || 
				                          detailsMsg.includes('too many subrequests') ||
				                          errorStatus === 500 && (errorMsg.includes('subrequest') || detailsMsg.includes('subrequest'));
				
				if (isSubrequestLimit) {
					// Re-throw as a special error that will be caught by the outer handler
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
					
					// GitHub API 500 errors - this might indicate permission issues for private repos
					if (errorStatus === 500 || errorMsg.includes('500') || errorMsg.includes('internal server error')) {
						secureLog.warn(`GitHub API 500 error for commit - may indicate permission issue for private repos`);
						// For private repos, 500 might mean we don't have permission to access commit details
						// Continue without diff rather than failing completely
						return;
					}
					
					// 403 - Permission denied (common for private repos without proper permissions)
					if (errorStatus === 403 || errorMsg.includes('403') || errorMsg.includes('forbidden')) {
						secureLog.warn('Permission denied for commit - GitHub App may need additional permissions for private repos');
						throw new Error('GitHub App permission denied. Please ensure the app has "Contents" read permission for private repositories.');
					}
					
					// Rate limit - stop processing
					if (errorStatus === 429 || errorMsg.includes('rate limit')) {
						secureLog.warn('GitHub API rate limit hit, stopping diff fetches');
						throw err;
					}
					
					// 404 - commit not found
					if (errorStatus === 404 || errorMsg.includes('404') || errorMsg.includes('not found')) {
						secureLog.warn('Commit not found, skipping diff');
						return;
					}
				}
				
				// For other errors, continue without diff
				secureLog.warn('Failed to fetch diff for commit, continuing without diff');
			}
		};

		// Fetch diffs sequentially to avoid hitting Cloudflare's subrequest limit
		// Note: Parallel requests each count as separate subrequests, so sequential is safer
		const commitsToFetchDiffs = commits.slice(0, maxCommitsWithDiff);
		const concurrencyLimit = 1; // Sequential to minimize subrequest count
		let hitSubrequestLimit = false;
		let lastSuccessfulIndex = 0;
		let consecutiveFailures = 0;
		const maxConsecutiveFailures = 5; // If 5 commits in a row fail, stop trying

		for (let i = 0; i < commitsToFetchDiffs.length; i += concurrencyLimit) {
			if (hitSubrequestLimit) break;

			const batch = commitsToFetchDiffs.slice(i, i + concurrencyLimit);
			
			const results = await Promise.allSettled(
				batch.map(async (commit) => {
					try {
						await fetchCommitDiff(commit);
						return { success: true, hasDiff: !!commit.diff };
					} catch (err) {
						// Check for subrequest limit error (can be in message or as a property)
						if (err instanceof Error && (
							err.message.includes('Too many subrequests') || 
							(err as any).isSubrequestLimit
						)) {
							throw err; // Re-throw to be caught by allSettled
						}
						if (err instanceof Error && err.message.includes('permission denied')) {
							throw err; // Re-throw permission errors
						}
						return { success: false, hasDiff: false };
					}
				})
			);

			// Check results
			const batchResults = results.map(r => r.status === 'fulfilled' ? r.value : { success: false, hasDiff: false });
			const batchSuccess = batchResults.some(r => r.success && r.hasDiff);
			
			if (batchSuccess) {
				consecutiveFailures = 0; // Reset counter on success
			} else {
				consecutiveFailures++;
				// If we're getting consistent failures, it might be a permissions issue
				if (consecutiveFailures >= maxConsecutiveFailures) {
					secureLog.warn(`Stopping diff fetches after ${consecutiveFailures} consecutive failures - likely a permissions issue for private repos`);
					break;
				}
			}

			// Check if any request hit the subrequest limit or permission error
			const hasCriticalError = results.some(
				(result) => 
					result.status === 'rejected' && 
					result.reason instanceof Error && 
					(result.reason.message.includes('Too many subrequests') ||
					 (result.reason as any).isSubrequestLimit ||
					 result.reason.message.includes('permission denied'))
			);

			if (hasCriticalError) {
				const error = results.find(r => r.status === 'rejected')?.reason;
				if (error instanceof Error && error.message.includes('permission denied')) {
					throw error; // Re-throw permission errors immediately
				}
				// Subrequest limit - continue with what we have
				hitSubrequestLimit = true;
				lastSuccessfulIndex = i;
				const commitsWithDiffs = commits.filter(c => c.diff).length;
				secureLog.warn(`Hit subrequest limit at commit batch. Successfully fetched ${commitsWithDiffs} commits with diffs.`);
				break;
			}

			lastSuccessfulIndex = i + batch.length;

			// Small delay between batches to avoid rate limits
			if (i + concurrencyLimit < commitsToFetchDiffs.length) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		// Sort commits by date for chronological analysis
		const commitsForAnalysis = commits.sort((a, b) => {
			return new Date(a.date).getTime() - new Date(b.date).getTime();
		});

		// Log summary of what we're analyzing
		const commitsWithDiffs = commitsForAnalysis.filter(c => c.diff).length;
		const commitsWithoutDiffs = commitsForAnalysis.length - commitsWithDiffs;
		secureLog.info(`Analyzing ${commitsForAnalysis.length} commits (${commitsWithDiffs} with diffs, ${commitsWithoutDiffs} without diffs)`);

		// Estimate payload size before sending (rough estimate)
		const estimatedPayloadSize = commitsForAnalysis.reduce((size, commit) => {
			let commitSize = commit.message.length + commit.date.length + commit.sha.length;
			if (commit.diff) {
				commitSize += Math.min(commit.diff.length, 1000); // Account for truncation
			}
			return size + commitSize;
		}, 0);
		
		secureLog.info(`Estimated payload size: ${(estimatedPayloadSize / 1024).toFixed(2)} KB`);

		// Ensure we have commits to analyze
		if (commitsForAnalysis.length === 0) {
			throw error(400, 'No commits available for analysis');
		}

		// Analyze commits with OpenAI
		// Always use single analysis for regular endpoint (max 100 commits fits in one call)
		// Chunked analysis is only for timeline endpoint with thousands of commits
		// This keeps subrequest count low: ~40 diff fetches + 1 OpenAI call + 2 Supabase calls
		let milestones: MilestoneInput[] = [];
		secureLog.info('Analysis mode: single (regular endpoint always uses single mode)');

		const maxRetries = 3;
		let retryCount = 0;
		let lastError: Error | null = null;

		while (retryCount <= maxRetries) {
			try {
				// Always use single analysis for regular endpoint
				milestones = await analyzeMilestones(`${repo.repo_owner}/${repo.repo_name}`, commitsForAnalysis);
				secureLog.info(`OpenAI analysis successful: ${milestones.length} milestones found`);
				break; // Success, exit retry loop
			} catch (err) {
				lastError = err instanceof Error ? err : new Error(String(err));
				const errorMessage = lastError.message.toLowerCase();

				// Check for retryable errors (network, timeout, connection issues)
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
						// Wait before retrying (exponential backoff with jitter)
						const backoffDelay = 1000 * retryCount + Math.random() * 1000;
						await new Promise((resolve) => setTimeout(resolve, backoffDelay));
						continue;
					} else {
						// Max retries reached, but try one more time
						secureLog.warn('Max retries reached for OpenAI, attempting final request...');
						try {
							milestones = await analyzeMilestones(`${repo.repo_owner}/${repo.repo_name}`, commitsForAnalysis);
							secureLog.info(`OpenAI analysis successful on final attempt: ${milestones.length} milestones found`);
							break; // Success on final attempt
						} catch (finalErr) {
							// If final attempt fails, throw with helpful message
							const finalErrorMsg = finalErr instanceof Error ? finalErr.message : String(finalErr);
							throw new Error(`OpenAI service unavailable after ${maxRetries + 1} attempts: ${finalErrorMsg}`);
						}
					}
				}
				// Re-throw if not a retryable error (API errors, validation errors, etc.)
				throw lastError;
			}
		}

		// If we exhausted retries without success, throw the last error
		if (milestones.length === 0 && lastError) {
			throw lastError;
		}

		// Clear existing quick milestones for this repo
		await locals.supabase.from('milestones').delete().eq('repository_id', repository_id).eq('source', 'quick');

		// Insert new milestones
		let insertedMilestoneIds: string[] = [];
		if (milestones.length > 0) {
			const milestonesToInsert = milestones
				.filter((m) => m.milestone_date) // Filter out milestones without dates
				.map((m) => ({
					repository_id,
					title: m.title,
					description: m.description,
					commit_sha: m.commit_sha,
					milestone_date: (m.milestone_date ?? new Date().toISOString()).split('T')[0], // Just the date part
					x_post_suggestion: m.x_post_suggestion,
					milestone_type: m.milestone_type || 'other',
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
		}

		// Update last_analyzed_at BEFORE screenshot processing to avoid Cloudflare subrequest limit
		const { error: updateError } = await supabaseAdmin
			.from('repositories')
			.update({ last_analyzed_at: new Date().toISOString() })
			.eq('id', repository_id);

		if (updateError) {
			secureLog.error('Failed to update last_analyzed_at:', updateError);
		}

		// Process screenshots for feature milestones (non-blocking, don't fail entire analysis)
		let screenshotCount = 0;
		try {
			if (insertedMilestoneIds.length > 0 && octokit) {
				const processedScreenshots = await processFeatureScreenshots(
					octokit,
					repo,
					milestones.filter((m) => m.milestone_date) // Same filter as milestonesToInsert
				);

				if (processedScreenshots.length > 0) {
					await updateMilestonesWithScreenshots(insertedMilestoneIds, processedScreenshots);
					screenshotCount = processedScreenshots.filter((p) => p.screenshotUrl).length;
					secureLog.info(`Captured ${screenshotCount} screenshots for feature milestones`);
				}
			}
		} catch (screenshotErr) {
			// Log but don't fail the analysis for screenshot errors
			secureLog.warn('Screenshot capture failed (non-fatal):', screenshotErr);
		}

		const commitsWithDiffsCount = commitsForAnalysis.filter(c => c.diff).length;

		return json({
			success: true,
			milestones_count: milestones.length,
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
