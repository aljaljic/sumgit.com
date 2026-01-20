import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);

// GET: Fetch widget data for a share token (public, with CORS)
export const GET: RequestHandler = async ({ params }) => {
	const { token } = params;

	if (!token) {
		throw error(400, 'Token required');
	}

	// Fetch the share token and related data
	const { data: shareToken, error: tokenError } = await supabaseAdmin
		.from('share_tokens')
		.select(
			`
			*,
			repositories (
				id,
				repo_name,
				repo_owner,
				github_repo_url
			)
		`
		)
		.eq('token', token)
		.eq('is_active', true)
		.single();

	if (tokenError || !shareToken) {
		throw error(404, 'Widget not found or has been disabled');
	}

	// Increment view count (fire and forget)
	supabaseAdmin
		.from('share_tokens')
		.update({ view_count: (shareToken.view_count || 0) + 1 })
		.eq('id', shareToken.id)
		.then(() => {});

	// Fetch milestones for the repository
	const { data: milestones } = await supabaseAdmin
		.from('milestones')
		.select('*')
		.eq('repository_id', shareToken.repository_id)
		.order('milestone_date', { ascending: false });

	// Build response based on content type
	const response: Record<string, unknown> = {
		token: shareToken.token,
		content_type: shareToken.content_type,
		config: shareToken.config,
		repository: shareToken.repositories,
		milestones: milestones || []
	};

	// For story type, also fetch the story
	if (shareToken.content_type === 'story') {
		const { data: story } = await supabaseAdmin
			.from('stories')
			.select('*')
			.eq('repository_id', shareToken.repository_id)
			.order('created_at', { ascending: false })
			.limit(1)
			.single();

		response.story = story;
	}

	// Return with CORS headers
	return json(response, {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
};

// OPTIONS: Handle CORS preflight
export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
};

// DELETE: Revoke (deactivate) a share token
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const { token } = params;

	if (!token) {
		throw error(400, 'Token required');
	}

	// Verify the user owns this share token
	const { data: shareToken } = await locals.supabase
		.from('share_tokens')
		.select('id, user_id')
		.eq('token', token)
		.eq('user_id', user.id)
		.single();

	if (!shareToken) {
		throw error(404, 'Share token not found');
	}

	// Deactivate the share token (soft delete)
	const { error: updateError } = await supabaseAdmin
		.from('share_tokens')
		.update({ is_active: false })
		.eq('id', shareToken.id);

	if (updateError) {
		console.error('Failed to revoke share token:', updateError);
		throw error(500, 'Failed to revoke share token');
	}

	return json({ success: true });
};
