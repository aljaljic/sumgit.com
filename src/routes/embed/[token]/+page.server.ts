import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import type { WidgetConfig, WidgetContentType } from '$lib/types/share';
import type { Repository, Milestone, DbStory } from '$lib/database.types';

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);

export const load: PageServerLoad = async ({ params, url }) => {
	const { token } = params;

	// Read URL query params for styling
	const textColor = url.searchParams.get('textColor') || undefined;
	const textSize = url.searchParams.get('textSize') || undefined;

	if (!token) {
		throw error(400, 'Token required');
	}

	// Fetch the share token
	const { data: shareToken, error: tokenError } = await supabaseAdmin
		.from('share_tokens')
		.select('*')
		.eq('token', token)
		.eq('is_active', true)
		.single();

	if (tokenError || !shareToken) {
		throw error(404, 'Widget not found or has been disabled');
	}

	// Fetch repository
	const { data: repository } = await supabaseAdmin
		.from('repositories')
		.select('*')
		.eq('id', shareToken.repository_id)
		.single();

	if (!repository) {
		throw error(404, 'Repository not found');
	}

	// Increment view count (fire and forget)
	supabaseAdmin
		.from('share_tokens')
		.update({ view_count: (shareToken.view_count || 0) + 1 })
		.eq('id', shareToken.id)
		.then(() => {});

	// Fetch milestones
	const { data: milestones } = await supabaseAdmin
		.from('milestones')
		.select('*')
		.eq('repository_id', shareToken.repository_id)
		.order('milestone_date', { ascending: false });

	// For story type, also fetch the story
	let story: DbStory | null = null;
	if (shareToken.content_type === 'story') {
		const { data: storyData } = await supabaseAdmin
			.from('stories')
			.select('*')
			.eq('repository_id', shareToken.repository_id)
			.order('created_at', { ascending: false })
			.limit(1)
			.single();

		story = storyData;
	}

	return {
		token: shareToken.token,
		contentType: shareToken.content_type as WidgetContentType,
		config: shareToken.config as WidgetConfig,
		repository: repository as Repository,
		milestones: (milestones || []) as Milestone[],
		story,
		textColor,
		textSize
	};
};
