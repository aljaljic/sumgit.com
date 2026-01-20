import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';
import { getInstallationOctokit } from '$lib/github-app';
import type { Repository, Milestone, GitHubInstallation } from '$lib/database.types';
import type { RecapStats, RecapSummary, RepoRecap, LanguageStat } from '$lib/types/recap';
import { checkAndDeductCredits, refundCredits } from '$lib/server/credits';
import { CREDIT_COSTS } from '$lib/credits';
import { handleError } from '$lib/server/errors';
import { secureLog } from '$lib/server/logger';

const openai = new OpenAI({
	apiKey: PRIVATE_OPENAI_API_KEY,
	fetch: globalThis.fetch,
	timeout: 120000,
	maxRetries: 0
});

const RECAP_SYSTEM_PROMPT = `You are an indie hacker writing a recap of a developer's project journey. Write like you're celebrating a friend's achievements - authentic, encouraging, and real.

Given repository milestones, generate a JSON response with:

1. "headline" (max 100 chars): A punchy, celebratory headline. Examples:
   - "From zero to hero: 6 months of shipping"
   - "12 milestones, 1 epic journey"
   - "Built different: A year of relentless shipping"

2. "narrative" (2-3 paragraphs): An authentic story of the project's journey. Reference specific milestones naturally. Keep it conversational - like telling a friend about what you've built. Don't be overly corporate or formal. Celebrate the wins, acknowledge the grind.

3. "top_milestones" (array of 5 objects): Pick the 5 most significant milestones with:
   - "title": The milestone title
   - "date": The milestone date
   - "description": Brief why this mattered (1 sentence)

4. "vibe_check" (max 280 chars): A shareable one-liner that captures the essence of this project's journey. Make it memorable and quotable. Perfect for sharing on X/Twitter.

Return ONLY valid JSON in this exact format:
{
  "headline": "...",
  "narrative": "...",
  "top_milestones": [{"title": "...", "date": "...", "description": "..."}],
  "vibe_check": "..."
}`;

function calculateActiveMonths(firstDate: string, lastDate: string): number {
	const first = new Date(firstDate);
	const last = new Date(lastDate);
	const diffTime = Math.abs(last.getTime() - first.getTime());
	const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
	return Math.max(1, diffMonths);
}

// Common language colors from GitHub
const LANGUAGE_COLORS: Record<string, string> = {
	JavaScript: '#f1e05a',
	TypeScript: '#3178c6',
	Python: '#3572A5',
	Java: '#b07219',
	'C++': '#f34b7d',
	C: '#555555',
	'C#': '#239120',
	Ruby: '#701516',
	Go: '#00ADD8',
	Rust: '#dea584',
	Swift: '#F05138',
	Kotlin: '#A97BFF',
	PHP: '#4F5D95',
	HTML: '#e34c26',
	CSS: '#563d7c',
	SCSS: '#c6538c',
	Shell: '#89e051',
	Dockerfile: '#384d54',
	Vue: '#41b883',
	Svelte: '#ff3e00',
	Astro: '#ff5a03',
	Markdown: '#083fa1',
	JSON: '#292929',
	YAML: '#cb171e',
	SQL: '#e38c00',
	GraphQL: '#e10098',
	Lua: '#000080',
	Perl: '#0073c6',
	R: '#198CE7',
	Scala: '#c22d40',
	Elixir: '#6e4a7e',
	Clojure: '#db5855',
	Haskell: '#5e5086',
	OCaml: '#3be133',
	Dart: '#00B4AB',
	Zig: '#ec915c',
	Nim: '#ffc200',
	Julia: '#a270ba'
};

function getLanguageColor(language: string): string {
	return LANGUAGE_COLORS[language] || '#8b8b8b';
}

// Rough estimate: ~25 bytes per line of code on average
function estimateLinesOfCode(totalBytes: number): number {
	return Math.round(totalBytes / 25);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const { repository_id } = await request.json();

	if (!repository_id) {
		throw error(400, 'Repository ID required');
	}

	// Check and deduct credits before processing
	const creditResult = await checkAndDeductCredits(user.id, 'generate_recap', repository_id);
	if (!creditResult.success) {
		throw error(402, {
			message: creditResult.error || 'Insufficient credits',
			credits_required: CREDIT_COSTS.generate_recap,
			credits_available: creditResult.newBalance
		} as any);
	}

	let creditsDeducted = true;

	// Get repository
	const { data: repoData } = await locals.supabase
		.from('repositories')
		.select('*')
		.eq('id', repository_id)
		.eq('user_id', user.id)
		.single();

	const repo = repoData as Repository | null;

	if (!repo) {
		throw error(404, 'Repository not found');
	}

	// Get milestones (both quick and timeline)
	const { data: milestonesData } = await locals.supabase
		.from('milestones')
		.select('*')
		.eq('repository_id', repository_id)
		.order('milestone_date', { ascending: true });

	const milestones = (milestonesData ?? []) as Milestone[];

	if (milestones.length === 0) {
		// Refund credits if no milestones
		if (creditsDeducted) {
			await refundCredits(user.id, 'generate_recap', 'Refund - no milestones found');
		}
		throw error(400, 'No milestones found. Please analyze the repository first.');
	}

	// Get user's GitHub App installations
	const { data: installations } = await locals.supabase
		.from('github_installations')
		.select('*')
		.eq('user_id', user.id);

	const typedInstallations = (installations ?? []) as GitHubInstallation[];

	// Initialize stats with defaults
	let totalCommits = 0;
	let firstCommitDate = milestones[0]?.milestone_date || new Date().toISOString();
	let lastCommitDate = milestones[milestones.length - 1]?.milestone_date || new Date().toISOString();
	let languages: LanguageStat[] = [];
	let totalBytes = 0;
	let contributorsCount = 0;

	// Try to get actual stats from GitHub
	if (typedInstallations.length > 0) {
		for (const installation of typedInstallations) {
			try {
				const octokit = await getInstallationOctokit(installation.installation_id);

				// Get repository info for created_at date
				const { data: repoInfo } = await octokit.repos.get({
					owner: repo.repo_owner,
					repo: repo.repo_name
				});

				if (repoInfo.created_at) {
					firstCommitDate = repoInfo.created_at;
				}

				// Get languages
				const { data: languagesData } = await octokit.repos.listLanguages({
					owner: repo.repo_owner,
					repo: repo.repo_name
				});

				totalBytes = Object.values(languagesData).reduce((sum, bytes) => sum + bytes, 0);

				languages = Object.entries(languagesData)
					.map(([name, bytes]) => ({
						name,
						bytes,
						percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
						color: getLanguageColor(name)
					}))
					.sort((a, b) => b.bytes - a.bytes)
					.slice(0, 10); // Top 10 languages

				// Get contributor stats to calculate total commits
				const { data: contributors } = await octokit.repos.listContributors({
					owner: repo.repo_owner,
					repo: repo.repo_name,
					per_page: 100
				});

				contributorsCount = contributors.length;
				totalCommits = contributors.reduce((sum, c) => sum + (c.contributions || 0), 0);

				// Get most recent commit date
				const { data: recentCommits } = await octokit.repos.listCommits({
					owner: repo.repo_owner,
					repo: repo.repo_name,
					per_page: 1
				});

				if (recentCommits.length > 0 && recentCommits[0].commit.author?.date) {
					lastCommitDate = recentCommits[0].commit.author.date;
				}

				break; // Successfully got stats
			} catch (err) {
				secureLog.error('Error fetching GitHub stats:', err);
				continue;
			}
		}
	}

	// Fall back to milestone-based estimates if we couldn't get GitHub stats
	if (totalCommits === 0) {
		totalCommits = milestones.length * 10; // Rough estimate
	}
	if (contributorsCount === 0) {
		contributorsCount = 1; // At least the repo owner
	}

	try {
		// Build stats
		const stats: RecapStats = {
			total_commits: totalCommits,
			total_milestones: milestones.length,
			first_commit_date: firstCommitDate,
			last_commit_date: lastCommitDate,
			active_months: calculateActiveMonths(firstCommitDate, lastCommitDate),
			languages,
			total_lines_of_code: estimateLinesOfCode(totalBytes),
			contributors: contributorsCount
		};

		// Format milestones for the prompt
		const milestonesText = milestones
			.map((m) => `- [${m.milestone_date}] ${m.title}${m.description ? `: ${m.description}` : ''}`)
			.join('\n');

		const languagesText = stats.languages.length > 0
			? stats.languages.map((l) => `${l.name} (${l.percentage}%)`).join(', ')
			: 'Unknown';

		const userMessage = `Generate a recap for the project "${repo.repo_owner}/${repo.repo_name}".

Stats:
- ${stats.total_commits.toLocaleString()} total commits
- ${stats.total_milestones} milestones
- ${stats.active_months} months of development
- ~${stats.total_lines_of_code.toLocaleString()} lines of code
- ${stats.contributors} contributor${stats.contributors === 1 ? '' : 's'}
- Languages: ${languagesText}
- First commit: ${new Date(stats.first_commit_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
- Latest activity: ${new Date(stats.last_commit_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}

Milestones:
${milestonesText}

Create an engaging recap that celebrates this journey. Reference the tech stack and stats naturally in the narrative.`;

		const response = await openai.chat.completions.create({
			model: 'gpt-5-mini',
			messages: [
				{ role: 'system', content: RECAP_SYSTEM_PROMPT },
				{ role: 'user', content: userMessage }
			],
			response_format: { type: 'json_object' },
			max_completion_tokens: 2000
		});

		const content = response.choices[0]?.message?.content;
		if (!content) {
			throw error(500, 'Empty response from AI');
		}

		const parsed = JSON.parse(content) as RecapSummary;

		// Validate the response
		if (!parsed.headline || !parsed.narrative || !parsed.vibe_check) {
			throw error(500, 'Invalid recap format from AI');
		}

		// Ensure we have top milestones (default to first 5 if AI didn't pick)
		if (!parsed.top_milestones || parsed.top_milestones.length === 0) {
			parsed.top_milestones = milestones.slice(0, 5).map((m) => ({
				title: m.title,
				date: m.milestone_date,
				description: m.description || ''
			}));
		}

		const recap: RepoRecap = {
			repository_id,
			repo_name: repo.repo_name,
			repo_owner: repo.repo_owner,
			stats,
			summary: parsed,
			generated_at: new Date().toISOString()
		};

		return json({
			success: true,
			recap,
			credits_remaining: creditResult.newBalance
		});
	} catch (err) {
		// Refund credits on failure
		if (creditsDeducted) {
			await refundCredits(user.id, 'generate_recap', 'Refund due to recap generation failure');
		}

		// Use sanitized error handling
		handleError(err, 'Recap generation');
	}
};
