import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import type { Milestone } from '$lib/database.types';
import { checkAndDeductCredits, refundCredits } from '$lib/server/credits';
import { CREDIT_COSTS } from '$lib/credits';
import {
	type ChangelogGrouping,
	type Changelog,
	type ChangelogVersion,
	type ChangelogEntry,
	type ChangelogCategory,
	milestoneTypeToCategory,
	generateMarkdown
} from '$lib/types/changelog';

const openai = new OpenAI({
	apiKey: PRIVATE_OPENAI_API_KEY,
	fetch: globalThis.fetch,
	timeout: 60000,
	maxRetries: 0
});

// Supabase client with service role for database operations
const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);

export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { repository_id, grouping = 'date' } = body as {
		repository_id: string;
		grouping?: ChangelogGrouping;
	};

	if (!repository_id) {
		throw error(400, 'Repository ID required');
	}

	// Check and deduct credits before processing
	const creditResult = await checkAndDeductCredits(user.id, 'generate_changelog', repository_id);
	if (!creditResult.success) {
		throw error(402, {
			message: creditResult.error || 'Insufficient credits',
			credits_required: CREDIT_COSTS.generate_changelog,
			credits_available: creditResult.newBalance
		} as unknown as string);
	}

	let creditsDeducted = true;

	try {
		// Fetch repository details
		const { data: repository, error: repoError } = await locals.supabase
			.from('repositories')
			.select('*')
			.eq('id', repository_id)
			.eq('user_id', user.id)
			.single();

		if (repoError || !repository) {
			throw error(404, 'Repository not found');
		}

		// Fetch milestones ordered by date descending
		const { data: milestones, error: milestonesError } = await locals.supabase
			.from('milestones')
			.select('*')
			.eq('repository_id', repository_id)
			.order('milestone_date', { ascending: false });

		if (milestonesError) {
			console.error('Error fetching milestones:', milestonesError);
			throw error(500, 'Failed to fetch milestones');
		}

		const typedMilestones = (milestones ?? []) as Milestone[];

		if (typedMilestones.length === 0) {
			throw error(400, 'No milestones found. Analyze the repository first.');
		}

		// Generate changelog based on grouping
		const changelog = await generateChangelog(
			typedMilestones,
			grouping,
			`${repository.repo_owner}/${repository.repo_name}`
		);

		// Generate markdown
		const markdown = generateMarkdown(changelog, repository.github_repo_url);

		// Persist changelog to database
		await supabaseAdmin
			.from('changelogs')
			.upsert(
				{
					repository_id,
					user_id: user.id,
					grouping,
					changelog_data: changelog,
					markdown
				},
				{ onConflict: 'repository_id,user_id' }
			)
			.select()
			.single();

		return json({
			success: true,
			changelog,
			markdown,
			credits_remaining: creditResult.newBalance
		});
	} catch (err) {
		// Refund credits on failure
		if (creditsDeducted) {
			await refundCredits(user.id, 'generate_changelog', 'Refund due to changelog generation failure');
		}

		// Re-throw if it's already an error response
		if (err instanceof Error && 'status' in err) {
			throw err;
		}

		console.error('Changelog generation error:', err);
		throw error(500, 'Failed to generate changelog');
	}
};

async function generateChangelog(
	milestones: Milestone[],
	grouping: ChangelogGrouping,
	repoName: string
): Promise<Changelog> {
	// Group milestones based on the selected grouping
	const groups = groupMilestones(milestones, grouping);

	// Use AI to suggest semantic versions and polish entries
	const versionsWithSuggestions = await suggestVersions(groups, repoName);

	// Build the changelog structure
	const versions: ChangelogVersion[] = [];

	for (const [groupKey, groupMilestones] of versionsWithSuggestions) {
		const entries: Record<ChangelogCategory, ChangelogEntry[]> = {
			'Added': [],
			'Fixed': [],
			'Changed': [],
			'Documentation': [],
			'Other': []
		};

		for (const milestone of groupMilestones) {
			const category = milestoneTypeToCategory(milestone.milestone_type);
			entries[category].push({
				title: milestone.polished_title || milestone.title,
				description: milestone.description,
				commit_sha: milestone.commit_sha,
				date: milestone.milestone_date,
				category
			});
		}

		versions.push({
			version: groupMilestones[0]?.suggested_version || groupKey,
			date: groupMilestones[0]?.milestone_date.split('T')[0] || new Date().toISOString().split('T')[0],
			entries
		});
	}

	// Suggest next version based on the latest version
	const latestVersion = versions[0]?.version || '0.1.0';
	const suggestedNext = incrementVersion(latestVersion);

	return {
		versions,
		suggested_next_version: suggestedNext,
		generated_at: new Date().toISOString()
	};
}

function groupMilestones(
	milestones: Milestone[],
	grouping: ChangelogGrouping
): Map<string, Milestone[]> {
	const groups = new Map<string, Milestone[]>();

	for (const milestone of milestones) {
		let key: string;

		if (grouping === 'date') {
			// Group by exact date
			key = milestone.milestone_date.split('T')[0];
		} else if (grouping === 'month') {
			// Group by year-month
			const date = new Date(milestone.milestone_date);
			key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
		} else {
			// 'version' - will be enhanced by AI
			key = milestone.milestone_date.split('T')[0];
		}

		if (!groups.has(key)) {
			groups.set(key, []);
		}
		groups.get(key)!.push(milestone);
	}

	return groups;
}

interface EnhancedMilestone extends Milestone {
	suggested_version?: string;
	polished_title?: string;
}

async function suggestVersions(
	groups: Map<string, Milestone[]>,
	repoName: string
): Promise<Map<string, EnhancedMilestone[]>> {
	// Prepare data for AI
	const groupsArray = Array.from(groups.entries()).map(([key, milestones]) => ({
		group_key: key,
		milestones: milestones.map(m => ({
			title: m.title,
			description: m.description,
			type: m.milestone_type,
			date: m.milestone_date
		}))
	}));

	const prompt = `You are helping generate a changelog for "${repoName}".

Given these grouped milestones, suggest:
1. A semantic version for each group (based on the changes - breaking changes = major, new features = minor, fixes = patch)
2. A polished, concise title for each entry (max 80 chars, suitable for a changelog)

Groups:
${JSON.stringify(groupsArray, null, 2)}

Return JSON:
{
  "groups": [
    {
      "group_key": "2025-01-27",
      "suggested_version": "1.2.0",
      "entries": [
        { "original_title": "...", "polished_title": "..." }
      ]
    }
  ]
}

Rules:
- Start versions at 0.1.0 if this looks like early development
- Increment versions logically across groups (older groups = lower versions)
- Polish titles to be clear, concise, and action-oriented
- Use past tense for the polished titles (e.g., "Added", "Fixed", "Updated")`;

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-5-mini',
			messages: [
				{ role: 'user', content: prompt }
			],
			response_format: { type: 'json_object' },
			max_completion_tokens: 2000
		});

		const content = response.choices[0]?.message?.content;
		if (!content) {
			return enhanceWithDefaults(groups);
		}

		const parsed = JSON.parse(content);
		const aiGroups = parsed.groups as Array<{
			group_key: string;
			suggested_version: string;
			entries: Array<{ original_title: string; polished_title: string }>;
		}>;

		// Merge AI suggestions with original milestones
		const result = new Map<string, EnhancedMilestone[]>();

		for (const [key, milestones] of groups) {
			const aiGroup = aiGroups.find(g => g.group_key === key);
			const enhancedMilestones: EnhancedMilestone[] = milestones.map(m => {
				const aiEntry = aiGroup?.entries.find(e => e.original_title === m.title);
				return {
					...m,
					suggested_version: aiGroup?.suggested_version,
					polished_title: aiEntry?.polished_title || m.title
				};
			});
			result.set(key, enhancedMilestones);
		}

		return result;
	} catch (err) {
		console.error('AI version suggestion error:', err);
		return enhanceWithDefaults(groups);
	}
}

function enhanceWithDefaults(groups: Map<string, Milestone[]>): Map<string, EnhancedMilestone[]> {
	const result = new Map<string, EnhancedMilestone[]>();
	let versionCounter = 0;

	// Sort groups by date (oldest first for version assignment)
	const sortedKeys = Array.from(groups.keys()).sort();

	for (const key of sortedKeys) {
		const milestones = groups.get(key)!;
		const hasFeatures = milestones.some(m => m.milestone_type === 'feature');

		// Simple version increment logic
		versionCounter++;
		const version = hasFeatures
			? `0.${versionCounter}.0`
			: `0.${Math.max(1, versionCounter - 1)}.${versionCounter}`;

		const enhancedMilestones: EnhancedMilestone[] = milestones.map(m => ({
			...m,
			suggested_version: version,
			polished_title: m.title
		}));

		result.set(key, enhancedMilestones);
	}

	// Reverse to get newest first
	const reversed = new Map<string, EnhancedMilestone[]>();
	const reversedKeys = Array.from(result.keys()).reverse();
	for (const key of reversedKeys) {
		reversed.set(key, result.get(key)!);
	}

	return reversed;
}

function incrementVersion(version: string): string {
	const parts = version.replace(/^v/, '').split('.').map(Number);
	if (parts.length !== 3 || parts.some(isNaN)) {
		return '0.2.0';
	}

	// Increment minor version
	parts[1]++;
	parts[2] = 0;

	return parts.join('.');
}
