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

		// Fetch up to 500 commits (5 pages)
		while (page <= 5) {
			const { data } = await octokit.repos.listCommits({
				owner: repo.repo_owner,
				repo: repo.repo_name,
				per_page: perPage,
				page
			});

			if (data.length === 0) break;

			for (const commit of data) {
				commits.push({
					sha: commit.sha,
					message: commit.commit.message.split('\n')[0] ?? '', // First line only
					date: commit.commit.author?.date ?? new Date().toISOString(),
					author: commit.commit.author?.name ?? 'Unknown'
				});
			}

			if (data.length < perPage) break;
			page++;
		}

		if (commits.length === 0) {
			throw error(400, 'No commits found in repository');
		}

		// Analyze commits with OpenAI
		const milestones = await analyzeMilestones(`${repo.repo_owner}/${repo.repo_name}`, commits);

		// Clear existing milestones for this repo
		await locals.supabase.from('milestones').delete().eq('repository_id', repository_id);

		// Insert new milestones
		if (milestones.length > 0) {
			const milestonesToInsert = milestones.map((m) => ({
				repository_id,
				title: m.title,
				description: m.description,
				commit_sha: m.commit_sha,
				milestone_date: m.milestone_date.split('T')[0], // Just the date part
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
			commits_analyzed: commits.length
		});
	} catch (err) {
		console.error('Analysis error:', err);
		if (err instanceof Error && err.message.includes('OpenAI')) {
			throw error(500, err.message);
		}
		throw error(500, 'Failed to analyze repository');
	}
};
