import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Repository, Milestone, DbRecap } from '$lib/database.types';
import type { RepoRecap } from '$lib/types/recap';

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

	// Fetch existing recap if any
	const { data: recapData } = await locals.supabase
		.from('recaps')
		.select('*')
		.eq('repository_id', id)
		.single();

	const typedMilestones = (milestones ?? []) as Milestone[];
	const typedRepository = repository as Repository;
	const existingRecap = recapData ? (recapData as DbRecap).recap_data as unknown as RepoRecap : null;

	return {
		repository: typedRepository,
		milestones: typedMilestones,
		existingRecap
	};
};
