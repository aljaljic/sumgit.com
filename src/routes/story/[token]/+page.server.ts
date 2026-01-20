import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import type { StoryChapter, NarrativeStyleId } from '$lib/types/story';

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);

export const load: PageServerLoad = async ({ params }) => {
	const { token } = params;

	// Fetch public story by share token
	const { data: story, error: storyError } = await supabaseAdmin
		.from('stories')
		.select(
			`
			id,
			narrative_style,
			chapters,
			share_token,
			is_public,
			created_at,
			repository:repositories (
				id,
				repo_name,
				repo_owner
			)
		`
		)
		.eq('share_token', token)
		.eq('is_public', true)
		.single();

	if (storyError || !story) {
		throw error(404, 'Story not found or no longer shared');
	}

	const repository = story.repository as unknown as { id: string; repo_name: string; repo_owner: string };

	return {
		story: {
			id: story.id,
			narrative_style: story.narrative_style as NarrativeStyleId,
			chapters: story.chapters as StoryChapter[],
			share_token: story.share_token,
			is_public: story.is_public,
			created_at: story.created_at
		},
		repository: {
			id: repository.id,
			repo_name: repository.repo_name,
			repo_owner: repository.repo_owner
		}
	};
};
