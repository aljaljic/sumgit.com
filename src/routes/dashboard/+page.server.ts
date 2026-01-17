import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Repository, GitHubInstallation } from '$lib/database.types';
import { PUBLIC_GITHUB_APP_NAME } from '$env/static/public';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw redirect(303, '/');
	}

	// Fetch user's connected repositories
	const { data: repositories, error } = await locals.supabase
		.from('repositories')
		.select('*')
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Error fetching repositories:', error);
	}

	// Fetch user's GitHub App installations
	const { data: installations } = await locals.supabase
		.from('github_installations')
		.select('*')
		.eq('user_id', user.id);

	// Check for installation success/existing message
	const installationStatus = url.searchParams.get('installation');

	return {
		repositories: (repositories ?? []) as Repository[],
		installations: (installations ?? []) as GitHubInstallation[],
		hasInstallation: (installations ?? []).length > 0,
		githubAppName: PUBLIC_GITHUB_APP_NAME,
		installationStatus
	};
};
