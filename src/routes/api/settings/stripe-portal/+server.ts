import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { stripe } from '$lib/stripe';

export const POST: RequestHandler = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	// Get user's Stripe customer ID
	const { data: stripeCustomer, error: fetchError } = await locals.supabase
		.from('stripe_customers')
		.select('stripe_customer_id')
		.eq('user_id', user.id)
		.single();

	if (fetchError || !stripeCustomer?.stripe_customer_id) {
		throw error(400, 'No billing history found. Purchase credits to enable billing management.');
	}

	try {
		// Create Stripe billing portal session
		const portalSession = await stripe.billingPortal.sessions.create({
			customer: stripeCustomer.stripe_customer_id,
			return_url: `${url.origin}/settings`
		});

		return json({ url: portalSession.url });
	} catch (err) {
		console.error('Stripe portal error:', err);
		throw error(500, 'Failed to create billing portal session');
	}
};
