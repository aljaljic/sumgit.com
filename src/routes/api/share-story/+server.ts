import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);

// Generate a URL-friendly share token
function generateShareToken(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	const array = new Uint8Array(12);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

// POST: Enable sharing for a story
export const POST: RequestHandler = async ({ request, locals, url }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const { story_id } = await request.json();

	if (!story_id) {
		throw error(400, 'Story ID required');
	}

	// Verify the user owns this story
	const { data: story } = await locals.supabase
		.from('stories')
		.select('id, user_id, share_token')
		.eq('id', story_id)
		.eq('user_id', user.id)
		.single();

	if (!story) {
		throw error(404, 'Story not found');
	}

	// If already has a share token, just make it public again
	let shareToken = story.share_token;
	if (!shareToken) {
		shareToken = generateShareToken();
	}

	// Update story with share token and make public
	const { error: updateError } = await supabaseAdmin
		.from('stories')
		.update({
			share_token: shareToken,
			is_public: true
		})
		.eq('id', story_id);

	if (updateError) {
		console.error('Failed to update story:', updateError);
		throw error(500, 'Failed to enable sharing');
	}

	const shareUrl = `${url.origin}/story/${shareToken}`;

	return json({
		success: true,
		share_token: shareToken,
		share_url: shareUrl
	});
};

// DELETE: Disable sharing for a story
export const DELETE: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const { story_id } = await request.json();

	if (!story_id) {
		throw error(400, 'Story ID required');
	}

	// Verify the user owns this story
	const { data: story } = await locals.supabase
		.from('stories')
		.select('id, user_id')
		.eq('id', story_id)
		.eq('user_id', user.id)
		.single();

	if (!story) {
		throw error(404, 'Story not found');
	}

	// Disable sharing (keep the token in case they want to re-enable)
	const { error: updateError } = await supabaseAdmin
		.from('stories')
		.update({
			is_public: false
		})
		.eq('id', story_id);

	if (updateError) {
		console.error('Failed to update story:', updateError);
		throw error(500, 'Failed to disable sharing');
	}

	return json({
		success: true
	});
};
