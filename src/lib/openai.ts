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
	diff?: string; // Add diff field
}

export interface Milestone {
	title: string;
	description: string;
	commit_sha: string;
	milestone_date: string;
	x_post_suggestion: string;
}

const SYSTEM_PROMPT = `You are an expert at analyzing git commit history and identifying significant milestones in a software project. Your job is to find commits that represent meaningful achievements worth sharing on X (Twitter) for developers who "build in public".

IMPORTANT: You must analyze the ACTUAL CODE CHANGES (diffs) in each commit, not just the commit message. Many commits have misleading or generic messages. Look at what code actually changed to determine if it's a real milestone.

A milestone is a commit (or group of related commits) that represents:
- A new feature launch or major functionality (verify by checking if new code/files were added)
- Performance improvements (verify by checking if optimization code was added)
- Major bug fixes that affected users (verify by checking if critical logic was fixed)
- Architectural changes or refactors (verify by checking if structure/patterns changed)
- Version releases or deployments
- Integration of significant dependencies (verify by checking package files or new integrations)
- UI/UX improvements (verify by checking if UI components/styles changed)
- Security enhancements (verify by checking if security-related code was added)

NOT milestones (skip these):
- Minor typo fixes (verify: only small text changes)
- Code formatting changes (verify: only whitespace/formatting in diff)
- Routine dependency updates (verify: only version bumps in package files)
- WIP (work in progress) commits (verify: incomplete or commented-out code)
- Merge commits without substantial content (verify: no actual code changes)
- Generic "fix bug" commits without context (verify: no meaningful code changes)
- Commits where the message suggests a milestone but the diff shows no real changes

For each milestone you identify, provide:
1. A concise title (max 60 chars)
2. A brief description of what was achieved (based on the actual code changes)
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
		.map((c) => {
			let commitLine = `[${c.date}] ${c.sha.slice(0, 7)}: ${c.message}`;
			
			if (c.files_changed) {
				commitLine += ` (${c.files_changed} files, +${c.additions ?? 0}/-${c.deletions ?? 0})`;
			}
			
			// Include diff if available (this is crucial for intelligent analysis)
			if (c.diff) {
				commitLine += `\nCode changes:\n${c.diff}`;
			}
			
			return commitLine;
		})
		.join('\n\n---\n\n');

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{
					role: 'user',
					content: `Analyze the following commits from the repository "${repoName}" and identify significant milestones worth sharing on X. 

CRITICAL: Examine the actual code changes (diffs) for each commit, not just the commit message. Many commits have the same message or misleading messages. Only identify commits where the CODE CHANGES demonstrate a real milestone achievement.

Find the most impactful ones (aim for 5-15 milestones depending on the project's activity).

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
