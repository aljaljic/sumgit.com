import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getInstallationOctokit } from '$lib/github-app';
import { analyzeMilestones, type Commit } from '$lib/openai';
import type { Repository, Milestone, GitHubInstallation } from '$lib/database.types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const { repository_id } = await request.json();

	if (!repository_id) {
		throw error(400, 'Repository ID required');
	}

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
		// Fetch commits from the repository
		const commits: Commit[] = [];
		let page = 1;
		const perPage = 100;
		const maxCommitsWithDiff = 20; // Reduced further - Cloudflare has ~50 subrequest limit, but we also have listCommits calls
		const maxCommitsToAnalyze = 100; // Limit commits sent to OpenAI

		// First, collect all commits - try to get stats from listCommits if available
		while (page <= 5) {
			const { data } = await octokit.repos.listCommits({
				owner: repo.repo_owner,
				repo: repo.repo_name,
				per_page: perPage,
				page
			});

			if (data.length === 0) break;

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

				// Note: listCommits doesn't include file stats or diffs, but we can use it
				// to get basic info without making additional API calls
				commits.push(commitData);
			}

			if (data.length < perPage) break;
			page++;
		}

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
				
				console.error(`Error fetching commit ${commit.sha}:`, {
					status: errorStatus,
					message: errorMessage,
					details: errorDetails
				});
				
				// Check for specific error types
				if (err instanceof Error || typeof err === 'object') {
					const errorMsg = errorMessage.toLowerCase();
					
					// Subrequest limit - stop processing
					if (errorMsg.includes('too many subrequests')) {
						throw err;
					}
					
					// GitHub API 500 errors - this might indicate permission issues for private repos
					if (errorStatus === 500 || errorMsg.includes('500') || errorMsg.includes('internal server error')) {
						console.warn(`GitHub API 500 error for commit ${commit.sha} - this may indicate a permission issue for private repos`);
						// For private repos, 500 might mean we don't have permission to access commit details
						// Continue without diff rather than failing completely
						return;
					}
					
					// 403 - Permission denied (common for private repos without proper permissions)
					if (errorStatus === 403 || errorMsg.includes('403') || errorMsg.includes('forbidden')) {
						console.warn(`Permission denied for commit ${commit.sha} - GitHub App may need additional permissions for private repos`);
						throw new Error('GitHub App permission denied. Please ensure the app has "Contents" read permission for private repositories.');
					}
					
					// Rate limit - stop processing
					if (errorStatus === 429 || errorMsg.includes('rate limit')) {
						console.warn(`GitHub API rate limit hit, stopping diff fetches`);
						throw err;
					}
					
					// 404 - commit not found
					if (errorStatus === 404 || errorMsg.includes('404') || errorMsg.includes('not found')) {
						console.warn(`Commit ${commit.sha} not found, skipping diff`);
						return;
					}
				}
				
				// For other errors, continue without diff
				console.warn(`Failed to fetch diff for commit ${commit.sha}, continuing without diff`);
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
						if (err instanceof Error && err.message.includes('Too many subrequests')) {
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
					console.warn(`Stopping diff fetches after ${consecutiveFailures} consecutive failures - likely a permissions issue for private repos`);
					break;
				}
			}

			// Check if any request hit the subrequest limit or permission error
			const hasCriticalError = results.some(
				(result) => 
					result.status === 'rejected' && 
					result.reason instanceof Error && 
					(result.reason.message.includes('Too many subrequests') ||
					 result.reason.message.includes('permission denied'))
			);

			if (hasCriticalError) {
				const error = results.find(r => r.status === 'rejected')?.reason;
				if (error instanceof Error && error.message.includes('permission denied')) {
					throw error; // Re-throw permission errors immediately
				}
				hitSubrequestLimit = true;
				lastSuccessfulIndex = i;
				console.warn(`Hit subrequest limit, stopping diff fetches at commit ${i + batch.length}`);
				break;
			}

			lastSuccessfulIndex = i + batch.length;

			// Small delay between batches to avoid rate limits
			if (i + concurrencyLimit < commitsToFetchDiffs.length) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		// Prioritize commits with diffs for OpenAI analysis
		// Sort: commits with diffs first, then by date
		const commitsForAnalysis = commits
			.sort((a, b) => {
				// Commits with diffs first
				if (a.diff && !b.diff) return -1;
				if (!a.diff && b.diff) return 1;
				// Then by date (newest first)
				return new Date(b.date).getTime() - new Date(a.date).getTime();
			})
			.slice(0, maxCommitsToAnalyze);

		// Analyze commits with OpenAI (using prioritized subset)
		// Add retry logic for connection errors
		let milestones: Milestone[] = [];
		const maxRetries = 2;
		let retryCount = 0;

		while (retryCount <= maxRetries) {
			try {
				milestones = await analyzeMilestones(`${repo.repo_owner}/${repo.repo_name}`, commitsForAnalysis);
				break; // Success, exit retry loop
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : String(err);
				const isConnectionError = errorMessage.includes('Connection error') || 
				                          errorMessage.includes('timeout') ||
				                          errorMessage.includes('ECONNREFUSED') ||
				                          errorMessage.includes('ETIMEDOUT');
				
				if (isConnectionError) {
					retryCount++;
					if (retryCount <= maxRetries) {
						console.warn(`OpenAI connection error, retrying (${retryCount}/${maxRetries})...`);
						// Wait before retrying (exponential backoff)
						await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
						continue;
					}
				}
				// Re-throw if not a connection error or max retries reached
				throw err;
			}
		}

		// Clear existing milestones for this repo
		await locals.supabase.from('milestones').delete().eq('repository_id', repository_id);

		// Insert new milestones
		if (milestones.length > 0) {
			const milestonesToInsert = milestones
				.filter((m) => m.milestone_date) // Filter out milestones without dates
				.map((m) => ({
					repository_id,
					title: m.title,
					description: m.description,
					commit_sha: m.commit_sha,
					milestone_date: (m.milestone_date ?? new Date().toISOString()).split('T')[0], // Just the date part
					x_post_suggestion: m.x_post_suggestion
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

		return json({
			success: true,
			milestones_count: milestones.length,
			commits_analyzed: commitsForAnalysis.length,
			total_commits: commits.length
		});
	} catch (err) {
		console.error('Analysis error:', err);
		
		// Provide more specific error messages
		if (err instanceof Error) {
			const errorMsg = err.message.toLowerCase();
			
			// Subrequest limit error
			if (errorMsg.includes('too many subrequests')) {
				throw error(429, 'Too many API requests. Please try again in a moment.');
			}
			
			// OpenAI/OpenAI-related errors
			if (errorMsg.includes('openai') || errorMsg.includes('connection error') || errorMsg.includes('timeout')) {
				throw error(503, 'AI analysis service temporarily unavailable. Please try again.');
			}
			
			// GitHub API errors
			if (errorMsg.includes('github') || errorMsg.includes('api rate limit')) {
				throw error(429, 'GitHub API rate limit reached. Please try again later.');
			}
			
			// Permission errors
			if (errorMsg.includes('403') || errorMsg.includes('forbidden') || errorMsg.includes('permission')) {
				throw error(403, 'Access denied. Please ensure the GitHub App has access to this repository.');
			}
			
			// Return the actual error message for debugging
			throw error(500, `Analysis failed: ${err.message}`);
		}
		
		throw error(500, 'Failed to analyze repository. Please check the logs for details.');
	}
};
