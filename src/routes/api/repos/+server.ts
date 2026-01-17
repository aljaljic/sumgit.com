import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listInstallationRepos } from '$lib/github-app';
import type { Repository, GitHubInstallation } from '$lib/database.types';

// GET: Fetch repositories accessible via GitHub App installations
export const GET: RequestHandler = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	// Get user's GitHub App installations
	const { data: installations } = await locals.supabase
		.from('github_installations')
		.select('*')
		.eq('user_id', user.id);

	const typedInstallations = (installations ?? []) as GitHubInstallation[];

	if (typedInstallations.length === 0) {
		return json([]);
	}

	// Fetch repos from all installations
	const allRepos: Array<{
		id: number;
		name: string;
		full_name: string;
		owner: { login: string };
		html_url: string;
		description: string | null;
		private: boolean;
		installation_id: number;
	}> = [];

	for (const installation of typedInstallations) {
		try {
			const repos = await listInstallationRepos(installation.installation_id);
			allRepos.push(
				...repos.map((repo) => ({
					...repo,
					installation_id: installation.installation_id
				}))
			);
		} catch (err) {
			console.error(`Failed to fetch repos for installation ${installation.installation_id}:`, err);
		}
	}

	return json(allRepos);
};

// POST: Add a repository to sumgit
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { github_repo_url, repo_name, repo_owner, installation_id } = body;

	if (!github_repo_url || !repo_name || !repo_owner) {
		throw error(400, 'Missing required fields');
	}

	// Verify the user owns this installation
	if (installation_id) {
		const { data: installation } = await locals.supabase
			.from('github_installations')
			.select('id')
			.eq('installation_id', installation_id)
			.eq('user_id', user.id)
			.single();

		if (!installation) {
			throw error(403, 'Installation not found or not authorized');
		}
	}

	// Check if repo already exists for this user
	const { data: existing } = await locals.supabase
		.from('repositories')
		.select('id')
		.eq('user_id', user.id)
		.eq('github_repo_url', github_repo_url)
		.single();

	if (existing) {
		throw error(409, 'Repository already connected');
	}

	// Insert new repository
	const { data: repo, error: insertError } = await locals.supabase
		.from('repositories')
		.insert({
			user_id: user.id,
			github_repo_url,
			repo_name,
			repo_owner
		} as Repository)
		.select()
		.single();

	if (insertError) {
		console.error('Insert error:', insertError);
		throw error(500, 'Failed to add repository');
	}

	return json(repo);
};

// DELETE: Remove a repository from sumgit
export const DELETE: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const { id } = await request.json();

	if (!id) {
		throw error(400, 'Repository ID required');
	}

	const { error: deleteError } = await locals.supabase
		.from('repositories')
		.delete()
		.eq('id', id)
		.eq('user_id', user.id);

	if (deleteError) {
		console.error('Delete error:', deleteError);
		throw error(500, 'Failed to delete repository');
	}

	return json({ success: true });
};
