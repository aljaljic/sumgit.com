import OpenAI from 'openai';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';

// Configure OpenAI client for Cloudflare Workers
const openai = new OpenAI({
	apiKey: PRIVATE_OPENAI_API_KEY,
	fetch: globalThis.fetch, // Explicit fetch for Cloudflare Workers
	timeout: 120000, // 120 seconds (within Workers duration limits)
	maxRetries: 2 // Client-level retries
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

const SYSTEM_PROMPT = `You are an expert at analyzing git commit history and identifying significant milestones worth sharing on social media for developers who "build in public".

Analyze commit messages to find achievements worth celebrating. When code diffs are provided, use them as additional context, but commit messages alone are sufficient to identify milestones.

A milestone is ANY commit that represents something worth sharing:
- New features or functionality added
- Bug fixes (especially user-facing ones)
- Performance improvements
- UI/UX improvements
- New integrations or dependencies
- Refactoring or code improvements
- Documentation updates
- Version releases or deployments
- Initial project setup or major restructuring

Be GENEROUS - developers want to celebrate their progress! If in doubt, include it.

Skip only:
- Merge commits with no description
- "WIP" or clearly incomplete work
- Trivial typo fixes

For each milestone, provide:
1. title: Concise title (max 60 chars)
2. description: Brief description of what was achieved
3. commit_sha: The 7-char commit SHA
4. milestone_date: The commit date (ISO format)
5. x_post_suggestion: A casual, story-driven tweet (max 280 chars) in first person.

   RULES:
   - NEVER use hashtags
   - NEVER use excessive emojis (0-1 max)
   - Write like you're texting a dev friend
   - lowercase is fine, feels more authentic
   - Naturally mention the project/repo name so readers know what app/site the update is for

   GOOD FORMATS:
   - Dev log: "just shipped dark mode on [project]. my eyes thank me after mass editing at midnight"
   - Mini-story: "spent 2 days on this auth bug in [project]. turns out i was hashing passwords twice"
   - Progress: "[project] small win: search actually works now. on to the hard stuff"
   - Learning: "TIL you can't trust browser localStorage during SSR. fixed the hydration errors in [project]"

   BAD (never do this):
   - "🚀 Just launched dark mode! #buildinpublic #indiehacker #coding"
   - "Excited to announce our new feature!"
   - Generic marketing speak

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

// Analyze commits in time-based chunks (by month)
export async function analyzeCommitsInChunks(repoName: string, commits: Commit[]): Promise<Milestone[]> {
	if (commits.length === 0) {
		return [];
	}

	// Group commits by month
	const monthlyGroups = groupCommitsByMonth(commits);
	const sortedMonths = Array.from(monthlyGroups.keys()).sort();

	console.log(`Analyzing ${commits.length} commits across ${sortedMonths.length} months`);

	const allMilestones: Milestone[] = [];

	// Process each month's commits
	for (const month of sortedMonths) {
		const monthCommits = monthlyGroups.get(month)!;
		console.log(`Analyzing ${month}: ${monthCommits.length} commits`);

		try {
			const milestones = await analyzeMilestones(repoName, monthCommits);
			allMilestones.push(...milestones);
			console.log(`Found ${milestones.length} milestones for ${month}`);
		} catch (err) {
			console.error(`Error analyzing ${month}:`, err);
			// Continue with other months even if one fails
		}

		// Small delay between chunks to avoid rate limits
		if (sortedMonths.indexOf(month) < sortedMonths.length - 1) {
			await new Promise(resolve => setTimeout(resolve, 500));
		}
	}

	console.log(`Total milestones found: ${allMilestones.length}`);
	return allMilestones;
}

export async function analyzeMilestones(repoName: string, commits: Commit[]): Promise<Milestone[]> {
	if (commits.length === 0) {
		return [];
	}

	// Prepare commits for analysis (limit context size)
	// Prioritize commits with diffs, then by impact (files changed, additions/deletions)
	const sortedCommits = commits
		.sort((a, b) => {
			// Commits with diffs first
			if (a.diff && !b.diff) return -1;
			if (!a.diff && b.diff) return 1;
			// Then by impact (files changed + lines changed)
			const aImpact = (a.files_changed ?? 0) + (a.additions ?? 0) + (a.deletions ?? 0);
			const bImpact = (b.files_changed ?? 0) + (b.additions ?? 0) + (b.deletions ?? 0);
			return bImpact - aImpact;
		})
		.slice(0, 100); // Limit to top 100 most promising commits

	// Constants for payload size management
	const MAX_DIFF_SIZE = 1000; // Max characters per commit diff
	const MAX_PAYLOAD_SIZE = 80 * 1024; // 80KB limit for commits text (leaving room for system prompt)

	// Build commits text with size limits
	let commitsText = '';
	let totalSize = 0;
	
	for (const c of sortedCommits) {
			let commitLine = `[${c.date}] ${c.sha.slice(0, 7)}: ${c.message}`;
			
			if (c.files_changed) {
				commitLine += ` (${c.files_changed} files, +${c.additions ?? 0}/-${c.deletions ?? 0})`;
			}
			
		// Include diff if available, but truncate to MAX_DIFF_SIZE
			if (c.diff) {
			const truncatedDiff = c.diff.length > MAX_DIFF_SIZE 
				? c.diff.substring(0, MAX_DIFF_SIZE) + '\n... (truncated)'
				: c.diff;
			commitLine += `\nCode changes:\n${truncatedDiff}`;
		}
		
		// Add separator for all but the first commit
		const separator = commitsText ? '\n\n---\n\n' : '';
		const commitWithSeparator = separator + commitLine;
		const commitSize = new TextEncoder().encode(commitWithSeparator).length;
		
		// Check if adding this commit would exceed the limit
		if (totalSize + commitSize > MAX_PAYLOAD_SIZE) {
			console.warn(`Payload size limit reached. Including ${commitsText.split('\n\n---\n\n').length} commits out of ${sortedCommits.length} total.`);
			break;
		}
		
		commitsText += commitWithSeparator;
		totalSize += commitSize;
	}
	
	// Log payload size for monitoring
	const finalPayloadSize = new TextEncoder().encode(commitsText).length;
	console.log(`OpenAI payload: ${finalPayloadSize} bytes (${(finalPayloadSize / 1024).toFixed(2)} KB) for ${commitsText.split('\n\n---\n\n').length} commits`);

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
		const userMessage = `Analyze these commits from "${repoName}" and identify milestones worth sharing on X/Twitter.

Look for features, fixes, improvements, and achievements. Be generous - developers want to celebrate their progress!

Aim for 5-15 milestones depending on activity level.

Commits:
${commitsText}

Return JSON: { "milestones": [...] }`;

		// Log request details
		const requestPayloadSize = new TextEncoder().encode(userMessage).length;
		console.log(`Sending OpenAI request: ${requestPayloadSize} bytes, ${commitsText.split('\n\n---\n\n').length} commits`);

		const response = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content: userMessage }
			],
			response_format: { type: 'json_object' },
			temperature: 0.7,
			max_tokens: 4000
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
		const milestones = (parsed.milestones ?? []) as Milestone[];
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
			commitsCount: commitsText.split('\n\n---\n\n').length,
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
