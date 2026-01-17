import OpenAI from 'openai';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';

const openai = new OpenAI({
	apiKey: PRIVATE_OPENAI_API_KEY
});

export interface Commit {
	sha: string;
	message: string;
	date: string;
	author: string;
	files_changed?: number;
	additions?: number;
	deletions?: number;
}

export interface Milestone {
	title: string;
	description: string;
	commit_sha: string;
	milestone_date: string;
	x_post_suggestion: string;
}

const SYSTEM_PROMPT = `You are an expert at analyzing git commit history and identifying significant milestones in a software project. Your job is to find commits that represent meaningful achievements worth sharing on X (Twitter) for developers who "build in public".

A milestone is a commit (or group of related commits) that represents:
- A new feature launch or major functionality
- Performance improvements with measurable impact
- Major bug fixes that affected users
- Architectural changes or refactors
- Version releases or deployments
- Integration of significant dependencies
- UI/UX improvements
- Security enhancements

NOT milestones (skip these):
- Minor typo fixes
- Code formatting changes
- Routine dependency updates
- WIP (work in progress) commits
- Merge commits without substantial content
- Generic "fix bug" commits without context

For each milestone you identify, provide:
1. A concise title (max 60 chars)
2. A brief description of what was achieved
3. The commit SHA it relates to
4. The date of the milestone
5. A ready-to-post X/Twitter suggestion (max 280 chars) that sounds authentic and engaging, not salesy

Respond in JSON format with an array of milestones.`;

export async function analyzeMilestones(repoName: string, commits: Commit[]): Promise<Milestone[]> {
	if (commits.length === 0) {
		return [];
	}

	// Prepare commits for analysis (limit context size)
	const commitsText = commits
		.slice(0, 200) // Limit to last 200 commits to stay within context
		.map(
			(c) =>
				`[${c.date}] ${c.sha.slice(0, 7)}: ${c.message}${c.files_changed ? ` (${c.files_changed} files, +${c.additions ?? 0}/-${c.deletions ?? 0})` : ''}`
		)
		.join('\n');

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{
					role: 'user',
					content: `Analyze the following commits from the repository "${repoName}" and identify significant milestones worth sharing on X. Find the most impactful ones (aim for 5-15 milestones depending on the project's activity).

Commits (newest first):
${commitsText}

Respond with a JSON object: { "milestones": [...] }`
				}
			],
			response_format: { type: 'json_object' },
			temperature: 0.7,
			max_tokens: 4000
		});

		const content = response.choices[0]?.message?.content;
		if (!content) {
			return [];
		}

		const parsed = JSON.parse(content);
		return (parsed.milestones ?? []) as Milestone[];
	} catch (error) {
		console.error('OpenAI analysis error:', error);
		throw new Error('Failed to analyze commits with OpenAI');
	}
}
