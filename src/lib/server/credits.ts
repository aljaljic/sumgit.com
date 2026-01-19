import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { Database, CreditBalance } from '$lib/database.types';
import { CREDIT_COSTS, type OperationType } from '$lib/credits';

// Service role client for admin operations
const supabaseAdmin = createClient<Database>(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);

export interface CreditCheckResult {
	success: boolean;
	balance: number;
	error?: string;
}

export interface DeductionResult {
	success: boolean;
	newBalance: number;
	error?: string;
}

/**
 * Get user's current credit balance
 */
export async function getUserCredits(userId: string): Promise<CreditBalance | null> {
	const { data, error } = await supabaseAdmin
		.from('credit_balances')
		.select('*')
		.eq('user_id', userId)
		.single();

	if (error) {
		console.error('Error fetching user credits:', error);
		return null;
	}

	return data;
}

/**
 * Check if user has sufficient credits and deduct them atomically
 * Returns the new balance if successful, or an error if not
 */
export async function checkAndDeductCredits(
	userId: string,
	operationType: OperationType,
	repositoryId?: string
): Promise<DeductionResult> {
	const cost = CREDIT_COSTS[operationType];

	const { data, error } = await supabaseAdmin.rpc('deduct_credits', {
		p_user_id: userId,
		p_amount: cost,
		p_operation_type: operationType,
		p_repository_id: repositoryId,
		p_description: `Used ${cost} credit(s) for ${operationType.replace('_', ' ')}`
	});

	if (error) {
		console.error('Error deducting credits:', error);
		return {
			success: false,
			newBalance: 0,
			error: 'Failed to process credit deduction'
		};
	}

	const result = data?.[0];
	if (!result) {
		return {
			success: false,
			newBalance: 0,
			error: 'Unexpected error during credit deduction'
		};
	}

	if (!result.success) {
		return {
			success: false,
			newBalance: result.new_balance,
			error: result.error_message || 'Insufficient credits'
		};
	}

	return {
		success: true,
		newBalance: result.new_balance
	};
}

/**
 * Refund credits when an operation fails
 */
export async function refundCredits(
	userId: string,
	operationType: OperationType,
	description?: string
): Promise<DeductionResult> {
	const amount = CREDIT_COSTS[operationType];

	const { data, error } = await supabaseAdmin.rpc('refund_credits', {
		p_user_id: userId,
		p_amount: amount,
		p_operation_type: operationType,
		p_description: description || `Refund for failed ${operationType.replace('_', ' ')}`
	});

	if (error) {
		console.error('Error refunding credits:', error);
		return {
			success: false,
			newBalance: 0,
			error: 'Failed to process refund'
		};
	}

	const result = data?.[0];
	if (!result) {
		return {
			success: false,
			newBalance: 0,
			error: 'Unexpected error during refund'
		};
	}

	return {
		success: result.success,
		newBalance: result.new_balance,
		error: result.error_message || undefined
	};
}

/**
 * Add credits to user account (for purchases)
 */
export async function addCredits(
	userId: string,
	amount: number,
	transactionType: 'purchase' | 'welcome_bonus' | 'admin_adjustment',
	stripeSessionId?: string,
	stripePaymentIntentId?: string,
	description?: string
): Promise<DeductionResult> {
	const { data, error } = await supabaseAdmin.rpc('add_credits', {
		p_user_id: userId,
		p_amount: amount,
		p_transaction_type: transactionType,
		p_stripe_session_id: stripeSessionId,
		p_stripe_payment_intent_id: stripePaymentIntentId,
		p_description: description || `Added ${amount} credits`
	});

	if (error) {
		console.error('Error adding credits:', error);
		return {
			success: false,
			newBalance: 0,
			error: 'Failed to add credits'
		};
	}

	const result = data?.[0];
	if (!result) {
		return {
			success: false,
			newBalance: 0,
			error: 'Unexpected error adding credits'
		};
	}

	return {
		success: result.success,
		newBalance: result.new_balance,
		error: result.error_message || undefined
	};
}

/**
 * Get or create Stripe customer ID for a user
 */
export async function getOrCreateStripeCustomer(
	userId: string,
	email: string
): Promise<string | null> {
	// Check if we already have a Stripe customer for this user
	const { data: existing } = await supabaseAdmin
		.from('stripe_customers')
		.select('stripe_customer_id')
		.eq('user_id', userId)
		.single();

	if (existing?.stripe_customer_id) {
		return existing.stripe_customer_id;
	}

	// Need to create a new Stripe customer - this will be done in the checkout endpoint
	// where we have access to the Stripe client
	return null;
}

/**
 * Save Stripe customer mapping
 */
export async function saveStripeCustomer(
	userId: string,
	stripeCustomerId: string
): Promise<boolean> {
	const { error } = await supabaseAdmin
		.from('stripe_customers')
		.upsert(
			{
				user_id: userId,
				stripe_customer_id: stripeCustomerId
			},
			{ onConflict: 'user_id' }
		);

	if (error) {
		console.error('Error saving Stripe customer:', error);
		return false;
	}

	return true;
}
