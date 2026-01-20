import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// In-memory rate limiter for auth attempts
// In production, consider using Redis or database-backed rate limiting
const authAttempts = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_AUTH_ATTEMPTS = 10; // 10 attempts per minute per IP

// Allowed redirect URL prefixes (prevent open redirect vulnerability)
const ALLOWED_REDIRECT_PREFIXES = ['/dashboard', '/project/', '/pricing', '/settings'];

/**
 * Sanitize and validate redirect URL to prevent open redirect attacks
 */
function sanitizeRedirectUrl(next: string | null): string {
	// Default to dashboard
	if (!next) return '/dashboard';

	// Must start with / (relative URL)
	if (!next.startsWith('/')) return '/dashboard';

	// Prevent protocol-relative URLs (//evil.com)
	if (next.startsWith('//')) return '/dashboard';

	// Prevent javascript: URLs encoded in path
	if (next.toLowerCase().includes('javascript:')) return '/dashboard';

	// Check against allowed prefixes
	const isAllowed = ALLOWED_REDIRECT_PREFIXES.some((prefix) => next.startsWith(prefix));
	if (!isAllowed) return '/dashboard';

	// Remove any query params that could be used for attacks
	// Only allow the path portion
	try {
		const url = new URL(next, 'https://example.com');
		return url.pathname;
	} catch {
		return '/dashboard';
	}
}

/**
 * Check rate limit for IP address
 * Returns true if request is allowed, false if rate limited
 */
function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const record = authAttempts.get(ip);

	if (!record) {
		// First attempt from this IP
		authAttempts.set(ip, { count: 1, windowStart: now });
		return true;
	}

	// Check if window has expired
	if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
		// Reset window
		authAttempts.set(ip, { count: 1, windowStart: now });
		return true;
	}

	// Check if limit exceeded
	if (record.count >= MAX_AUTH_ATTEMPTS) {
		return false;
	}

	// Increment counter
	record.count++;
	return true;
}

// Cleanup old rate limit entries periodically (every 5 minutes)
setInterval(
	() => {
		const now = Date.now();
		for (const [ip, record] of authAttempts.entries()) {
			if (now - record.windowStart > RATE_LIMIT_WINDOW_MS * 5) {
				authAttempts.delete(ip);
			}
		}
	},
	5 * 60 * 1000
);

export const GET: RequestHandler = async ({ url, locals, getClientAddress }) => {
	// Rate limiting by IP
	const clientIp = getClientAddress();
	if (!checkRateLimit(clientIp)) {
		// Return 429 Too Many Requests
		throw redirect(303, '/?error=rate_limited');
	}

	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next');

	// Validate and sanitize the redirect URL
	const safeRedirect = sanitizeRedirectUrl(next);

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			// Profile is created automatically by the database trigger
			throw redirect(303, safeRedirect);
		}
	}

	// Return to login page if there was an error
	throw redirect(303, '/');
};
