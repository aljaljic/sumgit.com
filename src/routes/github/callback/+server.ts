import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyInstallation } from '$lib/github-app';
import type { GitHubInstallation } from '$lib/database.types';

// GitHub App installation callback
// GitHub redirects here after a user installs or configures the app
export const GET: RequestHandler = async ({ url, locals, cookies }) => {
	const { session, user } = await locals.safeGetSession();

	const installationId = url.searchParams.get('installation_id') || cookies.get('pending_installation_id');
	// setupAction can be 'install', 'update', or 'request' - we handle all the same way

	if (!session || !user) {
		// Store the installation_id in a cookie and redirect to login
		if (installationId) {
			cookies.set('pending_installation_id', installationId, {
				path: '/',
				maxAge: 60 * 10, // 10 minutes
				httpOnly: true,
				sameSite: 'lax',
				secure: process.env.NODE_ENV === 'production'
			});
		}
		// Redirect to login with next parameter to come back here
		const callbackUrl = `/github/callback${url.search}`;
		throw redirect(303, `/?error=auth_required&next=${encodeURIComponent(callbackUrl)}`);
	}

	// Clear the cookie if it exists
	if (cookies.get('pending_installation_id')) {
		cookies.delete('pending_installation_id', { path: '/' });
	}

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
