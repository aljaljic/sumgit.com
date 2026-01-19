import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { CreditTransaction } from '$lib/database.types';

export const GET: RequestHandler = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const limit = parseInt(url.searchParams.get('limit') || '50');
	const offset = parseInt(url.searchParams.get('offset') || '0');

	const { data, error: fetchError } = await locals.supabase
		.from('credit_transactions')
		.select('*')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false })
		.range(offset, offset + limit - 1);

	if (fetchError) {
		console.error('Error fetching transactions:', fetchError);
		throw error(500, 'Failed to fetch transaction history');
	}

	const transactions = (data ?? []) as CreditTransaction[];

	return json({
		transactions,
		hasMore: transactions.length === limit
	});
};
