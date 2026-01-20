/**
 * Centralized error handling with sanitized user-facing messages
 * Prevents internal error details from leaking to clients
 */

import { error } from '@sveltejs/kit';
import { secureLog } from './logger';

// Map of internal error patterns to user-friendly messages
const ERROR_MAPPINGS: Array<{ pattern: RegExp; message: string; status: number }> = [
	// Authentication errors
	{ pattern: /unauthorized|unauthenticated|not authenticated/i, message: 'Please sign in to continue', status: 401 },
	{ pattern: /forbidden|access denied|permission denied/i, message: 'Access denied', status: 403 },
	{ pattern: /invalid token|token expired|jwt/i, message: 'Session expired. Please sign in again', status: 401 },

	// Rate limiting
	{ pattern: /rate limit|too many requests/i, message: 'Too many requests. Please try again later', status: 429 },

	// Resource errors
	{ pattern: /not found|does not exist/i, message: 'Resource not found', status: 404 },
	{ pattern: /already exists|duplicate/i, message: 'Resource already exists', status: 409 },

	// Validation errors
	{ pattern: /invalid|validation failed|required/i, message: 'Invalid request', status: 400 },

	// External service errors
	{ pattern: /openai|ai service|timeout|connection error|econnrefused|etimedout/i, message: 'Service temporarily unavailable. Please try again', status: 503 },
	{ pattern: /github|api rate limit/i, message: 'GitHub service temporarily unavailable. Please try again later', status: 503 },
	{ pattern: /stripe/i, message: 'Payment service temporarily unavailable. Please try again', status: 503 },
	{ pattern: /supabase|database/i, message: 'Service temporarily unavailable. Please try again', status: 503 },

	// Credit errors
	{ pattern: /insufficient credits/i, message: 'Insufficient credits', status: 402 },

	// Network errors
	{ pattern: /network|fetch failed|socket/i, message: 'Network error. Please check your connection', status: 503 }
];

// Generic fallback message
const GENERIC_ERROR = { message: 'An error occurred. Please try again', status: 500 };

/**
 * Get a sanitized error message and status code for a given error
 */
export function getSanitizedError(err: unknown): { message: string; status: number } {
	const errorMessage = err instanceof Error ? err.message : String(err);

	for (const { pattern, message, status } of ERROR_MAPPINGS) {
		if (pattern.test(errorMessage)) {
			return { message, status };
		}
	}

	return GENERIC_ERROR;
}

/**
 * Handle an error with sanitized output for the user
 * Logs the full error server-side for debugging
 *
 * @param err - The caught error
 * @param context - Context string for logging (e.g., 'Analysis', 'Story Generation')
 * @throws HttpError with sanitized message
 */
export function handleError(err: unknown, context: string): never {
	// Log the full error server-side with sanitization
	secureLog.error(`${context} error:`, err);

	// Get sanitized error for user
	const { message, status } = getSanitizedError(err);

	throw error(status, message);
}

/**
 * Handle an error and return a JSON response instead of throwing
 * Useful for webhook handlers that need to return 200 regardless
 *
 * @param err - The caught error
 * @param context - Context string for logging
 * @returns Sanitized error info for logging/response
 */
export function handleErrorSilent(
	err: unknown,
	context: string
): { message: string; status: number } {
	// Log the full error server-side with sanitization
	secureLog.error(`${context} error:`, err);

	// Return sanitized error info
	return getSanitizedError(err);
}

/**
 * Create a typed error with a specific status code
 * Useful for throwing controlled errors that should pass through unchanged
 */
export function createError(status: number, message: string): never {
	throw error(status, message);
}

/**
 * Check if an error is a known/expected error type
 * Useful for deciding whether to refund credits, etc.
 */
export function isTransientError(err: unknown): boolean {
	const errorMessage = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

	return (
		errorMessage.includes('timeout') ||
		errorMessage.includes('connection') ||
		errorMessage.includes('network') ||
		errorMessage.includes('temporarily') ||
		errorMessage.includes('rate limit') ||
		errorMessage.includes('503') ||
		errorMessage.includes('502') ||
		errorMessage.includes('504')
	);
}
