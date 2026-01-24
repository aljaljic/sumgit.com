import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type {
	Profile,
	GitHubInstallation,
	CreditBalance,
	CreditTransaction,
	StripeCustomer
} from '$lib/database.types';

export interface TransactionWithRepo extends CreditTransaction {
	repository?: {
		repo_name: string;
		repo_owner: string;
	} | null;
}

export const load: PageServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw redirect(303, '/');
	}

	// Fetch all settings data in parallel
	const [
		profileResult,
		installationsResult,
		creditBalanceResult,
		transactionsResult,
		stripeCustomerResult
	] = await Promise.all([
		// Profile
		locals.supabase.from('profiles').select('*').eq('id', user.id).single(),

		// GitHub installations
		locals.supabase.from('github_installations').select('*').eq('user_id', user.id),

		// Credit balance
		locals.supabase.from('credit_balances').select('*').eq('user_id', user.id).single(),

		// Credit transactions with repository names (join)
		locals.supabase
			.from('credit_transactions')
			.select(
				`
				*,
				repository:repositories(repo_name, repo_owner)
			`
			)
			.eq('user_id', user.id)
			.order('created_at', { ascending: false })
			.limit(50),

		// Stripe customer (to check if billing portal is available)
		locals.supabase.from('stripe_customers').select('*').eq('user_id', user.id).single()
	]);

	return {
		profile: profileResult.data as Profile | null,
		installations: (installationsResult.data ?? []) as GitHubInstallation[],
		creditBalance: creditBalanceResult.data as CreditBalance | null,
		transactions: (transactionsResult.data ?? []) as TransactionWithRepo[],
		stripeCustomer: stripeCustomerResult.data as StripeCustomer | null,
		user: {
			id: user.id,
			email: user.email,
			avatar_url: user.user_metadata?.avatar_url,
			full_name: user.user_metadata?.full_name
		}
	};
};
