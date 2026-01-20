import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Repository, Milestone } from '$lib/database.types';
import type { StoryChapter, NarrativeStyleId } from '$lib/types/story';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw redirect(303, '/');
	}

	const { id } = params;

	// Fetch repository details
	const { data: repository, error: repoError } = await locals.supabase
		.from('repositories')
		.select('*')
		.eq('id', id)
		.eq('user_id', user.id)
		.single();

	if (repoError || !repository) {
		throw error(404, 'Repository not found');
	}

	// Fetch milestones ordered by date
	const { data: milestones, error: milestonesError } = await locals.supabase
		.from('milestones')
		.select('*')
		.eq('repository_id', id)
		.order('milestone_date', { ascending: true });

	if (milestonesError) {
		console.error('Error fetching milestones:', milestonesError);
	}

	// Fetch existing story for this repository
	const { data: existingStory } = await locals.supabase
		.from('stories')
		.select('*')
		.eq('repository_id', id)
		.eq('user_id', user.id)
		.order('created_at', { ascending: false })
		.limit(1)
		.single();

	const typedMilestones = (milestones ?? []) as Milestone[];
	const typedRepository = repository as Repository;

	return {
		repository: typedRepository,
		milestones: typedMilestones,
		existingStory: existingStory
			? {
					id: existingStory.id as string,
					repository_id: existingStory.repository_id as string,
					user_id: existingStory.user_id as string,
					narrative_style: existingStory.narrative_style as NarrativeStyleId,
					chapters: existingStory.chapters as unknown as StoryChapter[],
					share_token: existingStory.share_token as string | null,
					is_public: existingStory.is_public as boolean,
					created_at: existingStory.created_at as string
				}
			: null
	};
};
