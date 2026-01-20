import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { redirect, type Handle } from '@sveltejs/kit';
import type { Database } from '$lib/database.types';

// Security headers to add to all responses
const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'X-XSS-Protection': '1; mode=block',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
	'Content-Security-Policy': [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https://*.supabase.co https://avatars.githubusercontent.com",
		"font-src 'self'",
		"connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.openai.com",
		"frame-src 'self' https://js.stripe.com",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'"
	].join('; ')
};

// Security headers for embed routes (allow framing from any origin)
const EMBED_SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'X-XSS-Protection': '1; mode=block',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
	'Content-Security-Policy': [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https://*.supabase.co https://avatars.githubusercontent.com",
		"font-src 'self'",
		"connect-src 'self' https://*.supabase.co wss://*.supabase.co",
		"frame-ancestors *",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'"
	].join('; ')
};

// Add HSTS header only in production
const HSTS_HEADER = 'max-age=31536000; includeSubDomains';

export const handle: Handle = async ({ event, resolve }) => {
	// Force HTTPS in production (redirect HTTP to HTTPS)
	if (import.meta.env.PROD) {
		const proto = event.request.headers.get('x-forwarded-proto');
		if (proto === 'http') {
			const httpsUrl = event.url.href.replace('http://', 'https://');
			throw redirect(301, httpsUrl);
		}
	}

	event.locals.supabase = createServerClient<Database>(
		PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_ANON_KEY,
		{
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (cookiesToSet) => {
					cookiesToSet.forEach(({ name, value, options }) => {
						event.cookies.set(name, value, { ...options, path: '/' });
					});
				}
			}
		}
	);

	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();

		if (!session) {
			return { session: null, user: null };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();

		if (error) {
			return { session: null, user: null };
		}

		return { session, user };
	};

	const response = await resolve(event, {
		filterSerializedResponseHeaders(name) {
			// Only allow content-range, remove x-supabase-api-version to prevent version disclosure
			return name === 'content-range';
		}
	});

	// Check if this is an embed route
	const isEmbedRoute = event.url.pathname.startsWith('/embed/');

	// Use embed-specific headers for embed routes, otherwise use default security headers
	const headersToApply = isEmbedRoute ? EMBED_SECURITY_HEADERS : SECURITY_HEADERS;
	for (const [header, value] of Object.entries(headersToApply)) {
		response.headers.set(header, value);
	}

	// Add HSTS only in production (for all routes)
	if (import.meta.env.PROD) {
		response.headers.set('Strict-Transport-Security', HSTS_HEADER);
	}

	return response;
};
