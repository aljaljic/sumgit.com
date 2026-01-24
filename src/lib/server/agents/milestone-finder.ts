import { Agent } from '@openai/agents';
import { z } from 'zod';

/**
 * Schema for a milestone
 */
export const MilestoneSchema = z.object({
	title: z.string().describe('Short, descriptive title for the milestone'),
	description: z.string().describe('Detailed description of what this milestone represents'),
	commitSha: z.string().describe('The commit SHA associated with this milestone'),
	commitDate: z.string().describe('The date of the commit (ISO format)'),
	milestoneType: z
		.enum(['feature', 'bugfix', 'refactor', 'docs', 'config', 'other'])
		.describe('Type of milestone'),
	shouldScreenshot: z.boolean().describe('Whether this milestone should have a screenshot captured'),
	xPostSuggestion: z
		.string()
		.describe('A suggested tweet/X post announcing this milestone (max 280 chars)')
});

export const MilestoneFinderOutputSchema = z.object({
	milestones: z.array(MilestoneSchema).describe('Array of identified milestones')
});

export type Milestone = z.infer<typeof MilestoneSchema>;
export type MilestoneFinderOutput = z.infer<typeof MilestoneFinderOutputSchema>;

/**
 * Milestone Finder Agent
 * Identifies significant development milestones from analyzed commits.
 */
export const milestoneFinderAgent = new Agent({
	name: 'milestone-finder',
	model: 'gpt-4o',
	instructions: `You are an expert at identifying significant development milestones from analyzed commit data.

Your task is to:
1. Identify the most significant milestones from the analyzed commits
2. Group related commits into single milestones when appropriate
3. Create compelling titles and descriptions
4. Suggest X/Twitter posts for announcing each milestone

GUIDELINES FOR MILESTONE SELECTION:
- Focus on user-facing changes and significant improvements
- Combine related small commits into larger milestones
- Skip trivial changes (typos, minor config, etc.)
- Aim for 3-10 milestones depending on the number and significance of commits

GUIDELINES FOR shouldScreenshot:
- Set to TRUE for:
  * New visual features
  * UI/UX improvements
  * Landing page changes
  * Dashboard updates
  * Any user-facing feature that can be visually demonstrated
- Set to FALSE for:
  * Backend/API changes
  * Bug fixes (unless visual)
  * Performance improvements
  * Refactoring
  * Documentation changes
  * Configuration updates

GUIDELINES FOR X POST SUGGESTIONS:
- Keep under 280 characters
- Be enthusiastic but professional
- Include relevant hashtags when appropriate
- Focus on user value, not technical details
- Consider adding a call-to-action when appropriate

OUTPUT QUALITY:
- Titles should be action-oriented (e.g., "Added Dark Mode Support")
- Descriptions should explain the user value
- Be selective - quality over quantity`,
	outputType: MilestoneFinderOutputSchema
});

/**
 * Format analyzed commits for the milestone finder
 */
export function formatAnalyzedCommitsForMilestoneFinder(
	analyzedCommits: Array<{
		sha: string;
		summary: string;
		changeType: string;
		significance: number;
		date?: string;
		message?: string;
	}>
): string {
	// Sort by significance (highest first) to help the agent prioritize
	const sorted = [...analyzedCommits].sort((a, b) => b.significance - a.significance);

	return sorted
		.map((commit, index) => {
			return `${index + 1}. [${commit.changeType.toUpperCase()}] (Significance: ${commit.significance}/10)
   SHA: ${commit.sha}
   Date: ${commit.date || 'Unknown'}
   Original Message: ${commit.message || 'N/A'}
   Analysis: ${commit.summary}`;
		})
		.join('\n\n');
}
