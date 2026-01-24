import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { Database } from '$lib/database.types';

// Service role client for admin operations (can delete auth users)
const supabaseAdmin = createClient<Database>(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);

export const DELETE: RequestHandler = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const userId = user.id;

	try {
		// Delete in order to respect foreign key constraints
		// Each delete is wrapped individually to continue even if some tables are empty

		// 1. Delete share_tokens
		const { error: shareTokensError } = await supabaseAdmin
			.from('share_tokens')
			.delete()
			.eq('user_id', userId);
		if (shareTokensError) {
			console.error('Error deleting share_tokens:', shareTokensError);
		}

		// 2. Delete stories
		const { error: storiesError } = await supabaseAdmin
			.from('stories')
			.delete()
			.eq('user_id', userId);
		if (storiesError) {
			console.error('Error deleting stories:', storiesError);
		}

		// 3. Delete milestones (via repository IDs)
		// First get all repository IDs for this user
		const { data: repos } = await supabaseAdmin
			.from('repositories')
			.select('id')
			.eq('user_id', userId);

		if (repos && repos.length > 0) {
			const repoIds = repos.map(r => r.id);
			const { error: milestonesError } = await supabaseAdmin
				.from('milestones')
				.delete()
				.in('repository_id', repoIds);
			if (milestonesError) {
				console.error('Error deleting milestones:', milestonesError);
			}
		}

		// 4. Delete credit_transactions
		const { error: transactionsError } = await supabaseAdmin
			.from('credit_transactions')
			.delete()
			.eq('user_id', userId);
		if (transactionsError) {
			console.error('Error deleting credit_transactions:', transactionsError);
		}

		// 5. Delete repositories
		const { error: reposError } = await supabaseAdmin
			.from('repositories')
			.delete()
			.eq('user_id', userId);
		if (reposError) {
			console.error('Error deleting repositories:', reposError);
		}

		// 6. Delete credit_balances
		const { error: balanceError } = await supabaseAdmin
			.from('credit_balances')
			.delete()
			.eq('user_id', userId);
		if (balanceError) {
			console.error('Error deleting credit_balances:', balanceError);
		}

		// 7. Delete github_installations
		const { error: installationsError } = await supabaseAdmin
			.from('github_installations')
			.delete()
			.eq('user_id', userId);
		if (installationsError) {
			console.error('Error deleting github_installations:', installationsError);
		}

		// 8. Delete stripe_customers
		const { error: stripeError } = await supabaseAdmin
			.from('stripe_customers')
			.delete()
			.eq('user_id', userId);
		if (stripeError) {
			console.error('Error deleting stripe_customers:', stripeError);
		}

		// 9. Delete profiles
		const { error: profileError } = await supabaseAdmin
			.from('profiles')
			.delete()
			.eq('id', userId);
		if (profileError) {
			console.error('Error deleting profile:', profileError);
			throw error(500, 'Failed to delete profile');
		}

		// 10. Delete auth user
		const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
		if (authError) {
			console.error('Error deleting auth user:', authError);
			throw error(500, 'Failed to delete auth user');
		}

		return json({ success: true });
	} catch (err) {
		console.error('Delete account error:', err);
		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}
		throw error(500, 'Failed to delete account');
	}
};
