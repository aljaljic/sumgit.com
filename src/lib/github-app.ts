import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import {
	PRIVATE_GITHUB_APP_ID,
	PRIVATE_GITHUB_APP_PRIVATEKEY,
	PRIVATE_GITHUB_APP_CLIENTID,
	PRIVATE_GITHUB_APP_SECRET
} from '$env/static/private';
import { PUBLIC_GITHUB_APP_NAME } from '$env/static/public';

// Create an authenticated Octokit instance for a specific installation
export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
	const auth = createAppAuth({
		appId: PRIVATE_GITHUB_APP_ID,
		privateKey: PRIVATE_GITHUB_APP_PRIVATEKEY,
		clientId: PRIVATE_GITHUB_APP_CLIENTID,
		clientSecret: PRIVATE_GITHUB_APP_SECRET
	});

	const installationAuth = await auth({
		type: 'installation',
		installationId
	});

	return new Octokit({
		auth: installationAuth.token
	});
}

// Get the GitHub App installation URL for a user to install the app
export function getInstallationUrl(state?: string, setupUrl?: string): string {
	const baseUrl = `https://github.com/apps/${PUBLIC_GITHUB_APP_NAME}/installations/new`;
	const params = new URLSearchParams();
	
	if (state) {
		params.set('state', state);
	}
	
	// Add setup_url to tell GitHub where to redirect after installation
	// This should match the callback URL configured in your GitHub App settings
	if (setupUrl) {
		params.set('setup_url', setupUrl);
	}
	
	const queryString = params.toString();
	return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

// Verify the installation belongs to the expected account
export async function verifyInstallation(installationId: number): Promise<{
	valid: boolean;
	account?: { login: string; type: string };
}> {
	try {
		const auth = createAppAuth({
			appId: PRIVATE_GITHUB_APP_ID,
			privateKey: PRIVATE_GITHUB_APP_PRIVATEKEY,
			clientId: PRIVATE_GITHUB_APP_CLIENTID,
			clientSecret: PRIVATE_GITHUB_APP_SECRET
		});

		const appAuth = await auth({ type: 'app' });
		const octokit = new Octokit({ auth: appAuth.token });

		const { data: installation } = await octokit.apps.getInstallation({
			installation_id: installationId
		});

		// Handle both User and Enterprise account types
		const account = installation.account;
		let login = '';
		let type = 'User';

		if (account && 'login' in account) {
			login = account.login;
			type = account.type ?? 'User';
		} else if (account && 'slug' in account) {
			login = account.slug;
			type = 'Enterprise';
		}

		return {
			valid: true,
			account: { login, type }
		};
	} catch (error) {
		console.error('Failed to verify installation:', error);
		return { valid: false };
	}
}

// List repositories accessible to an installation
export async function listInstallationRepos(installationId: number) {
	const octokit = await getInstallationOctokit(installationId);

	const { data } = await octokit.apps.listReposAccessibleToInstallation({
		per_page: 100
	});

	return data.repositories.map((repo) => ({
		id: repo.id,
		name: repo.name,
		full_name: repo.full_name,
		owner: { login: repo.owner?.login ?? '' },
		html_url: repo.html_url,
		description: repo.description,
		private: repo.private
	}));
}
