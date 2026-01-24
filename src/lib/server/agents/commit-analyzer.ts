import { Agent } from '@openai/agents';
import { z } from 'zod';

/**
 * Schema for analyzed commit output
 */
export const AnalyzedCommitSchema = z.object({
	sha: z.string().describe('The commit SHA'),
	summary: z.string().describe('Brief summary of what changed'),
	changeType: z
		.enum(['feature', 'bugfix', 'refactor', 'docs', 'config', 'other'])
		.describe('Type of change'),
	significance: z
		.number()
		.min(1)
		.max(10)
		.describe('Significance score from 1-10, where 10 is most significant')
});

export const CommitAnalysisOutputSchema = z.object({
	commits: z.array(AnalyzedCommitSchema).describe('Array of analyzed commits')
});

export type AnalyzedCommit = z.infer<typeof AnalyzedCommitSchema>;
export type CommitAnalysisOutput = z.infer<typeof CommitAnalysisOutputSchema>;

/**
 * Commit Analyzer Agent
 * Analyzes git commits and diffs to understand what changed and categorize the changes.
 */
export const commitAnalyzerAgent = new Agent({
	name: 'commit-analyzer',
	model: 'gpt-4o',
	instructions: `You are an expert at analyzing git commits and diffs to understand what changed in a codebase.

Your task is to analyze each commit and provide:
1. A concise summary of what changed
2. The type of change (feature, bugfix, refactor, docs, config, other)
3. A significance score from 1-10

GUIDELINES FOR CHANGE TYPES:
- feature: New user-facing functionality or capabilities
- bugfix: Fixes for existing bugs or issues
- refactor: Code restructuring without changing functionality
- docs: Documentation changes (README, comments, etc.)
- config: Configuration, build, or dependency changes
- other: Anything that doesn't fit the above categories

GUIDELINES FOR SIGNIFICANCE SCORING:
- 1-3: Minor changes (typos, small tweaks, config updates)
- 4-6: Moderate changes (bug fixes, small features, refactoring)
- 7-9: Major changes (significant features, architectural changes)
- 10: Landmark changes (major releases, breaking changes, major features)

FOCUS ON:
- User-visible changes get higher significance
- Changes that affect core functionality are more significant
- Look at the diff content to understand the actual changes
- Consider the commit message context

Be accurate and objective in your analysis. Do not inflate significance scores.`,
	outputType: CommitAnalysisOutputSchema
});

/**
 * Input format for commits to be analyzed
 */
export interface CommitInput {
	sha: string;
	message: string;
	diff?: string;
	date?: string;
	author?: string;
	files_changed?: number;
	additions?: number;
	deletions?: number;
}

/**
 * Format commits for the analyzer agent
 */
export function formatCommitsForAnalysis(commits: CommitInput[]): string {
	return commits
		.map((commit, index) => {
			let formatted = `
## Commit ${index + 1}
SHA: ${commit.sha}
Message: ${commit.message}
Date: ${commit.date || 'Unknown'}
Author: ${commit.author || 'Unknown'}`;

			if (commit.files_changed !== undefined) {
				formatted += `\nFiles Changed: ${commit.files_changed}`;
			}
			if (commit.additions !== undefined) {
				formatted += `\nAdditions: ${commit.additions}`;
			}
			if (commit.deletions !== undefined) {
				formatted += `\nDeletions: ${commit.deletions}`;
			}
			if (commit.diff) {
				// Truncate diff to avoid token limits
				const truncatedDiff =
					commit.diff.length > 1000 ? commit.diff.substring(0, 1000) + '\n... (truncated)' : commit.diff;
				formatted += `\nDiff:\n\`\`\`\n${truncatedDiff}\n\`\`\``;
			}

			return formatted;
		})
		.join('\n\n---\n');
}
