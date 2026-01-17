import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from './database.types';

export function createSupabaseClient(
	fetch: typeof globalThis.fetch,
	getServerCookies?: () => { name: string; value: string }[],
	setServerCookie?: (name: string, value: string, options: { path: string; maxAge: number }) => void
) {
	if (isBrowser()) {
		return createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { fetch }
		});
	}

	return createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		global: { fetch },
		cookies: {
			getAll: () => getServerCookies?.() ?? [],
			setAll: (cookies) => {
				cookies.forEach(({ name, value, options }) => {
					setServerCookie?.(name, value, {
						path: options.path ?? '/',
						maxAge: options.maxAge ?? 60 * 60 * 24 * 365
					});
				});
			}
		}
	});
}
