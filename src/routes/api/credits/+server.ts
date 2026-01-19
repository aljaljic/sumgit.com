import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserCredits } from '$lib/server/credits';

export const GET: RequestHandler = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const credits = await getUserCredits(user.id);

	if (!credits) {
		// Return default values if no credit record exists yet
		return json({
			balance: 0,
			lifetime_purchased: 0,
			lifetime_used: 0
		});
	}

	return json({
		balance: credits.balance,
		lifetime_purchased: credits.lifetime_purchased,
		lifetime_used: credits.lifetime_used
	});
};
