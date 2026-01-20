import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { stripe } from '$lib/stripe';
import { PRIVATE_STRIPE_WEBHOOK_SECRET } from '$env/static/private';
import { addCredits } from '$lib/server/credits';
import type Stripe from 'stripe';
import { secureLog } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.text();
	const signature = request.headers.get('stripe-signature');

	if (!signature) {
		throw error(400, 'Missing Stripe signature');
	}

	let event: Stripe.Event;

	try {
		event = stripe.webhooks.constructEvent(body, signature, PRIVATE_STRIPE_WEBHOOK_SECRET);
	} catch (err) {
		secureLog.error('Webhook signature verification failed:', err);
		throw error(400, 'Invalid signature');
	}

	// Handle the event
	switch (event.type) {
		case 'checkout.session.completed': {
			const session = event.data.object as Stripe.Checkout.Session;

			// Extract metadata
			const userId = session.metadata?.user_id;
			const credits = parseInt(session.metadata?.credits || '0');
			const packageId = session.metadata?.package_id;

			if (!userId || !credits) {
				secureLog.error('Missing metadata in checkout session:', session.id);
				break;
			}

			// Add credits to user account
			const result = await addCredits(
				userId,
				credits,
				'purchase',
				session.id,
				session.payment_intent as string,
				`Purchased ${credits} credits (${packageId})`
			);

			if (!result.success) {
				secureLog.error('Failed to add credits for session:', session.id, result.error);
			} else {
				secureLog.info(`Added ${credits} credits to user ${userId}. New balance: ${result.newBalance}`);
			}
			break;
		}

		case 'charge.refunded': {
			const charge = event.data.object as Stripe.Charge;

			// For refunds, we could deduct credits, but this requires more complex logic
			// to track which purchase was refunded. For now, log it for manual handling.
			secureLog.info('Charge refunded:', charge.id, 'Amount:', charge.amount_refunded);
			// In a production system, you'd want to:
			// 1. Look up the original transaction by payment_intent_id
			// 2. Deduct the corresponding credits
			// 3. Record the refund transaction
			break;
		}

		default:
			secureLog.info(`Unhandled event type: ${event.type}`);
	}

	return json({ received: true });
};
