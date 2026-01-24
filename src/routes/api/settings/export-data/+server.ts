import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Fetch all user data in parallel
		const [
			profileResult,
			repositoriesResult,
			milestonesResult,
			storiesResult,
			transactionsResult,
			installationsResult,
			shareTokensResult,
			creditBalanceResult
		] = await Promise.all([
			// Profile (exclude sensitive tokens)
			locals.supabase
				.from('profiles')
				.select('id, github_username, created_at')
				.eq('id', user.id)
				.single(),

			// Repositories
			locals.supabase.from('repositories').select('*').eq('user_id', user.id),

			// Milestones (via repositories)
			locals.supabase
				.from('milestones')
				.select('*, repository:repositories!inner(user_id)')
				.eq('repository.user_id', user.id),

			// Stories
			locals.supabase.from('stories').select('*').eq('user_id', user.id),

			// Credit transactions (exclude Stripe IDs for security)
			locals.supabase
				.from('credit_transactions')
				.select('id, amount, balance_after, transaction_type, operation_type, description, created_at')
				.eq('user_id', user.id)
				.order('created_at', { ascending: false }),

			// GitHub installations
			locals.supabase
				.from('github_installations')
				.select('id, installation_id, account_login, account_type, created_at')
				.eq('user_id', user.id),

			// Share tokens (exclude actual tokens for security)
			locals.supabase
				.from('share_tokens')
				.select('id, content_type, config, is_active, view_count, created_at, updated_at')
				.eq('user_id', user.id),

			// Credit balance
			locals.supabase
				.from('credit_balances')
				.select('balance, lifetime_purchased, lifetime_used, created_at, updated_at')
				.eq('user_id', user.id)
				.single()
		]);

		// Clean up milestone data (remove nested repository info used for filtering)
		const milestones = (milestonesResult.data ?? []).map(({ repository, ...milestone }) => milestone);

		const exportData = {
			exportedAt: new Date().toISOString(),
			user: {
				id: user.id,
				email: user.email
			},
			profile: profileResult.data,
			creditBalance: creditBalanceResult.data,
			repositories: repositoriesResult.data ?? [],
			milestones,
			stories: storiesResult.data ?? [],
			transactions: transactionsResult.data ?? [],
			installations: installationsResult.data ?? [],
			shareTokens: shareTokensResult.data ?? []
		};

		// Return as downloadable JSON file
		return new Response(JSON.stringify(exportData, null, 2), {
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="sumgit-export-${new Date().toISOString().split('T')[0]}.json"`
			}
		});
	} catch (err) {
		console.error('Export data error:', err);
		throw error(500, 'Failed to export data');
	}
};
