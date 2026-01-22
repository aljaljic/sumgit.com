import OpenAI from 'openai';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';

// Configure OpenAI client for Cloudflare Workers
const openai = new OpenAI({
	apiKey: PRIVATE_OPENAI_API_KEY,
	fetch: globalThis.fetch, // Explicit fetch for Cloudflare Workers
	timeout: 120000, // 120 seconds (within Workers duration limits)
	maxRetries: 0 // Disable SDK retries - we handle retries manually to avoid hitting CF subrequest limits
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

export interface MilestoneInput {
	title: string;
	description: string;
	commit_sha: string;
	milestone_date: string;
	x_post_suggestion: string;
	milestone_type: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'config' | 'other';
}

const SYSTEM_PROMPT = `You are an indie hacker who builds in public. You understand the grind of solo development - the late nights, the "just one more feature" mentality, shipping fast and iterating faster.

Analyze commit messages to find moments worth sharing. Commit messages alone are sufficient to identify milestones.

A milestone is a SIGNIFICANT commit that represents a real achievement worth sharing:
- Major new features or functionality
- Important bug fixes (user-facing or critical issues)
- Significant performance improvements
- Major UI/UX overhauls
- New integrations or third-party services added
- Version releases or major deploys
- Project kickoffs or pivots
- Architectural changes or major refactors

Be SELECTIVE - only include commits that represent meaningful progress. Quality over quantity.

Skip:
- Merge commits
- "WIP" or incomplete work
- Typo fixes and minor text changes
- Small tweaks, adjustments, or iterations
- Routine maintenance or dependency updates
- Code formatting or linting fixes
- Minor bug fixes or edge cases
- Incremental progress that isn't a complete feature

For each milestone, provide:
1. title: Concise title (max 60 chars)
2. description: Brief description of what was achieved
3. commit_sha: The 7-char commit SHA
4. milestone_date: The commit date (ISO format)
5. x_post_suggestion: A casual, indie-hacker style tweet (max 280 chars) in first person.
6. milestone_type: Classify as one of: "feature", "bugfix", "refactor", "docs", "config", "other"

   MILESTONE TYPE CLASSIFICATION:
   - "feature": NEW user-facing functionality that users can see or interact with
     Examples: new UI components, new pages, new user features, new integrations users can use
     NOT a feature: API changes, backend refactors, performance improvements, infrastructure
   - "bugfix": Fixes to broken functionality, error corrections
   - "refactor": Code improvements without changing functionality, performance optimizations
   - "docs": Documentation updates, README changes, comments
   - "config": Configuration changes, CI/CD updates, dependency updates, tooling
   - "other": Everything else that doesn't fit above categories

   VOICE:
   - You're a solo dev or small team shipping stuff
   - Raw, unfiltered, real talk about the build
   - Share the struggle, not just the wins
   - lowercase preferred, feels more authentic
   - NEVER use hashtags
   - NEVER use excessive emojis (0-1 max)
   - Naturally mention the project/repo name

   GOOD INDIE HACKER VIBES:
   - "finally shipped dark mode on [project]. took way longer than expected but we're live"
   - "3am debugging session on [project]. the bug? i forgot to await a promise. classic"
   - "[project] day 47: auth works. users can actually log in now. shipping > perfection"
   - "rewrote the entire search in [project]. old code was haunting me. feels clean now"
   - "small w for [project]: page loads 2x faster. turns out loading 500 items on mount was... not ideal"
   - "just pushed a fix that's been bothering me for weeks on [project]. one less thing in the backlog"

   NEVER DO THIS:
   - "🚀 Excited to announce our new feature! #buildinpublic #startup"
   - Corporate announcements or marketing speak
   - Overly polished PR statements
   - Humble bragging

Return JSON: { "milestones": [...] }`;

// Helper function to group commits by month
function groupCommitsByMonth(commits: Commit[]): Map<string, Commit[]> {
	const groups = new Map<string, Commit[]>();

	for (const commit of commits) {
		const date = new Date(commit.date);
		const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

		if (!groups.has(key)) {
			groups.set(key, []);
		}
		groups.get(key)!.push(commit);
	}

	return groups;
}

// Analyze commits in optimized batches to minimize subrequests
// Cloudflare Workers have subrequest limits, so we batch into 1-2 API calls max
export async function analyzeCommitsInChunks(repoName: string, commits: Commit[]): Promise<MilestoneInput[]> {
	if (commits.length === 0) {
		return [];
	}

	// Sort commits chronologically for better context
	const sortedCommits = [...commits].sort((a, b) =>
		new Date(a.date).getTime() - new Date(b.date).getTime()
	);

	// Calculate date range for logging
	const monthlyGroups = groupCommitsByMonth(sortedCommits);
	const months = Array.from(monthlyGroups.keys()).sort();
	console.log(`Analyzing ${commits.length} commits across ${months.length} months (${months[0]} to ${months[months.length - 1]})`);

	// Try to analyze all commits in a single batch first
	// The analyzeMilestones function handles payload size limits internally
	console.log(`Attempting single-batch analysis for ${sortedCommits.length} commits`);

	try {
		const milestones = await analyzeMilestones(repoName, sortedCommits);
		console.log(`Single-batch analysis successful: ${milestones.length} milestones found`);
		return milestones;
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

		// If it's a payload size error, try splitting into 2 batches
		if (errorMsg.includes('payload') || errorMsg.includes('too large') || errorMsg.includes('413')) {
			console.log('Payload too large, splitting into 2 batches');

			const midpoint = Math.floor(sortedCommits.length / 2);
			const firstHalf = sortedCommits.slice(0, midpoint);
			const secondHalf = sortedCommits.slice(midpoint);

			const allMilestones: MilestoneInput[] = [];

			try {
				console.log(`Processing batch 1: ${firstHalf.length} commits`);
				const batch1Milestones = await analyzeMilestones(repoName, firstHalf);
				allMilestones.push(...batch1Milestones);
				console.log(`Batch 1 complete: ${batch1Milestones.length} milestones`);
			} catch (batch1Err) {
				console.error('Batch 1 error:', batch1Err);
			}

			try {
				console.log(`Processing batch 2: ${secondHalf.length} commits`);
				const batch2Milestones = await analyzeMilestones(repoName, secondHalf);
				allMilestones.push(...batch2Milestones);
				console.log(`Batch 2 complete: ${batch2Milestones.length} milestones`);
			} catch (batch2Err) {
				console.error('Batch 2 error:', batch2Err);
			}

			console.log(`Total milestones found: ${allMilestones.length}`);
			return allMilestones;
		}

		// Re-throw other errors
		throw err;
	}
}

export async function analyzeMilestones(repoName: string, commits: Commit[]): Promise<MilestoneInput[]> {
	if (commits.length === 0) {
		return [];
	}

	// Keep commits in chronological order for analysis
	// Limit to 100 commits per batch to stay within payload limits
	const sortedCommits = commits.slice(0, 100);

	// Build commits text - analyze based on commit messages only
	const commitsText = sortedCommits
		.map(c => `[${c.date}] ${c.sha.slice(0, 7)}: ${c.message}`)
		.join('\n');
	
	console.log(`OpenAI payload: ${sortedCommits.length} commits`);

	// Request validation
	if (!PRIVATE_OPENAI_API_KEY) {
		throw new Error('OpenAI API key is not configured');
	}

	if (commitsText.length === 0) {
		console.warn('No commit data to analyze');
		return [];
	}

	// Use AbortController for proper timeout handling on Cloudflare Workers
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 120000);

	try {
		const userMessage = `Analyze these commits from "${repoName}" and identify ONLY significant milestones worth sharing on X/Twitter.

Look for major features, important fixes, and real achievements. Be selective - only include commits that represent meaningful, complete work.

Aim for 3-10 milestones depending on activity level. Fewer high-quality milestones are better than many minor ones.

Commits:
${commitsText}

Return JSON: { "milestones": [...] }`;

		console.log(`Sending OpenAI request for ${sortedCommits.length} commits`);

		const response = await openai.chat.completions.create({
			model: 'gpt-5-mini',
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content: userMessage }
			],
			response_format: { type: 'json_object' },
			max_completion_tokens: 4000
		}, {
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		const content = response.choices[0]?.message?.content;
		if (!content) {
			console.warn('OpenAI returned empty response');
			return [];
		}

		const parsed = JSON.parse(content);
		const milestones = (parsed.milestones ?? []) as MilestoneInput[];
		console.log(`OpenAI analysis successful: ${milestones.length} milestones identified`);
		return milestones;
	} catch (error) {
		clearTimeout(timeoutId);

		// Handle AbortError from AbortController timeout
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error('OpenAI request timeout');
		}

		// Enhanced error logging
		interface ErrorDetails {
			message: string;
			name: string;
			repoName: string;
			commitsCount: number;
			payloadSize: number;
			status?: number;
			statusText?: string;
			responseData?: unknown;
		}

		const errorDetails: ErrorDetails = {
			message: error instanceof Error ? error.message : String(error),
			name: error instanceof Error ? error.name : 'Unknown',
			repoName,
			commitsCount: sortedCommits.length,
			payloadSize: new TextEncoder().encode(commitsText).length
		};

		// Check if it's an OpenAI API error with response details
		if (error && typeof error === 'object' && 'response' in error) {
			const apiError = error as { response?: { status?: number; statusText?: string; data?: unknown } };
			errorDetails.status = apiError.response?.status;
			errorDetails.statusText = apiError.response?.statusText;
			errorDetails.responseData = apiError.response?.data;
		}

		console.error('OpenAI analysis error:', errorDetails);
		
		// Categorize error types
		const errorMessage = errorDetails.message.toLowerCase();
		const isNetworkError = errorMessage.includes('connection error') || 
		                       errorMessage.includes('econnrefused') ||
		                       errorMessage.includes('etimedout') ||
		                       errorMessage.includes('network') ||
		                       errorMessage.includes('fetch failed');
		const isTimeoutError = errorMessage.includes('timeout') || 
		                      errorDetails.status === 408;
		const isApiError = errorDetails.status !== undefined && errorDetails.status >= 400 && errorDetails.status < 500; // 4xx errors
		const isServerError = errorDetails.status !== undefined && errorDetails.status >= 500; // 5xx errors
		const isPayloadError = errorMessage.includes('payload') || 
		                      errorMessage.includes('too large') ||
		                      errorDetails.status === 413;

		// Provide specific error messages based on error type
		if (isNetworkError || isTimeoutError) {
			// Retryable errors - preserve original error for retry logic
			throw error instanceof Error ? error : new Error(`OpenAI connection error: ${errorDetails.message}`);
		} else if (isPayloadError) {
			throw new Error(`Payload too large for OpenAI API. Try analyzing fewer commits. (${errorDetails.payloadSize} bytes)`);
		} else if (isApiError) {
			throw new Error(`OpenAI API error (${errorDetails.status}): ${errorDetails.message}. Check your API key and quota.`);
		} else if (isServerError) {
			throw new Error(`OpenAI server error (${errorDetails.status}): Service temporarily unavailable. Please try again later.`);
		}
		
		// Generic error fallback
		throw new Error(`Failed to analyze commits with OpenAI: ${errorDetails.message}`);
	}
}
