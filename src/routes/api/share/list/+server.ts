import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET: List user's share tokens
export const GET: RequestHandler = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	// Optional filter by repository_id
	const repositoryId = url.searchParams.get('repository_id');

	let query = locals.supabase
		.from('share_tokens')
		.select(
			`
			*,
			repositories (
				repo_name,
				repo_owner
			)
		`
		)
		.eq('user_id', user.id)
		.order('created_at', { ascending: false });

	if (repositoryId) {
		query = query.eq('repository_id', repositoryId);
	}

	const { data: tokens, error: queryError } = await query;

	if (queryError) {
		console.error('Failed to fetch share tokens:', queryError);
		throw error(500, 'Failed to fetch share tokens');
	}

	// Transform the data to include repository info at top level
	const transformedTokens = (tokens || []).map((token) => ({
		...token,
		repository_name: (token.repositories as { repo_name: string } | null)?.repo_name,
		repository_owner: (token.repositories as { repo_owner: string } | null)?.repo_owner,
		repositories: undefined // Remove nested object
	}));

	return json({ tokens: transformedTokens });
};
