import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { stripe } from '$lib/stripe';
import { getPackageById, CREDIT_PACKAGES } from '$lib/credits';
import { getOrCreateStripeCustomer, saveStripeCustomer } from '$lib/server/credits';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const { packageId } = await request.json();

	if (!packageId) {
		throw error(400, 'Package ID required');
	}

	const creditPackage = getPackageById(packageId);
	if (!creditPackage) {
		throw error(400, 'Invalid package ID');
	}

	try {
		// Get or create Stripe customer
		let stripeCustomerId = await getOrCreateStripeCustomer(user.id, user.email || '');

		if (!stripeCustomerId) {
			// Create new Stripe customer
			const customer = await stripe.customers.create({
				email: user.email || undefined,
				metadata: {
					user_id: user.id
				}
			});
			stripeCustomerId = customer.id;
			await saveStripeCustomer(user.id, stripeCustomerId);
		}

		// Create Stripe Checkout session
		const checkoutSession = await stripe.checkout.sessions.create({
			customer: stripeCustomerId,
			mode: 'payment',
			payment_method_types: ['card'],
			line_items: [
				{
					price_data: {
						currency: 'usd',
						product_data: {
							name: `${creditPackage.credits} Credits`,
							description: `Purchase ${creditPackage.credits} credits for SumGit`
						},
						unit_amount: creditPackage.price
					},
					quantity: 1
				}
			],
			metadata: {
				user_id: user.id,
				package_id: creditPackage.id,
				credits: creditPackage.credits.toString()
			},
			success_url: `${url.origin}/dashboard?purchase=success&credits=${creditPackage.credits}`,
			cancel_url: `${url.origin}/dashboard?purchase=cancelled`
		});

		return json({
			url: checkoutSession.url
		});
	} catch (err) {
		console.error('Checkout session error:', err);
		throw error(500, 'Failed to create checkout session');
	}
};
