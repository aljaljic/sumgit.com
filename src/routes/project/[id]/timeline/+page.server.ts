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

	// Fetch all milestones ordered by date (oldest first for timeline)
	const { data: milestones, error: milestonesError } = await locals.supabase
		.from('milestones')
		.select('*')
		.eq('repository_id', id)
		.order('milestone_date', { ascending: true });

	if (milestonesError) {
		console.error('Error fetching milestones:', milestonesError);
	}

	const typedMilestones = (milestones ?? []) as Milestone[];
	const typedRepository = repository as Repository;

	// Group milestones by year/month/day
	type GroupedMilestones = Record<string, Record<string, Record<string, Milestone[]>>>;
	const groupedMilestones: GroupedMilestones = {};

	for (const milestone of typedMilestones) {
		const date = new Date(milestone.milestone_date);
		const year = date.getFullYear().toString();
		const month = date.toLocaleString('en-US', { month: 'long' });
		const day = date.getDate().toString();

		if (!groupedMilestones[year]) {
			groupedMilestones[year] = {};
		}
		if (!groupedMilestones[year][month]) {
			groupedMilestones[year][month] = {};
		}
		if (!groupedMilestones[year][month][day]) {
			groupedMilestones[year][month][day] = [];
		}
		groupedMilestones[year][month][day].push(milestone);
	}

	return {
		repository: typedRepository,
		milestones: typedMilestones,
		groupedMilestones
	};
};
