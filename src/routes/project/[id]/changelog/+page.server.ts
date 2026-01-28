import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Repository, Milestone } from '$lib/database.types';

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

	// Fetch milestones ordered by date descending
	const { data: milestones, error: milestonesError } = await locals.supabase
		.from('milestones')
		.select('*')
		.eq('repository_id', id)
		.order('milestone_date', { ascending: false });

	if (milestonesError) {
		console.error('Error fetching milestones:', milestonesError);
	}

	const typedMilestones = (milestones ?? []) as Milestone[];
	const typedRepository = repository as Repository;

	return {
		repository: typedRepository,
		milestones: typedMilestones
	};
};
