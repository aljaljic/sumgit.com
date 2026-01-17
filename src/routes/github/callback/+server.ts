import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyInstallation } from '$lib/github-app';
import type { GitHubInstallation } from '$lib/database.types';

// GitHub App installation callback
// GitHub redirects here after a user installs or configures the app
export const GET: RequestHandler = async ({ url, locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		// Store the installation_id in a cookie and redirect to login
		throw redirect(303, '/?error=auth_required');
	}

	const installationId = url.searchParams.get('installation_id');
	// setupAction can be 'install', 'update', or 'request' - we handle all the same way

	if (!installationId) {
		throw error(400, 'Missing installation_id');
	}

	const installationIdNum = parseInt(installationId, 10);

	if (isNaN(installationIdNum)) {
		throw error(400, 'Invalid installation_id');
	}

	// Verify the installation exists and get account info
	const verification = await verifyInstallation(installationIdNum);

	if (!verification.valid || !verification.account) {
		throw error(400, 'Invalid or inaccessible installation');
	}

	// Check if this installation already exists for this user
	const { data: existing } = await locals.supabase
		.from('github_installations')
		.select('id')
		.eq('installation_id', installationIdNum)
		.single();

	if (existing) {
		// Installation already exists, just redirect to dashboard
		throw redirect(303, '/dashboard?installation=existing');
	}

	// Store the installation
	const installationData: Partial<GitHubInstallation> = {
		user_id: user.id,
		installation_id: installationIdNum,
		account_login: verification.account.login,
		account_type: verification.account.type
	};

	const { error: insertError } = await locals.supabase
		.from('github_installations')
		.insert(installationData as GitHubInstallation);

	if (insertError) {
		console.error('Failed to save installation:', insertError);
		throw error(500, 'Failed to save GitHub App installation');
	}

	// Redirect to dashboard with success message
	throw redirect(303, '/dashboard?installation=success');
};
