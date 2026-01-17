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

	try {
		// Add timeout to prevent hanging (120 seconds to match client timeout)
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => reject(new Error('OpenAI request timeout')), 120000);
		});

		const userMessage = `Analyze the following commits from the repository "${repoName}" and identify significant milestones worth sharing on X. 

CRITICAL: Examine the actual code changes (diffs) for each commit, not just the commit message. Many commits have the same message or misleading messages. Only identify commits where the CODE CHANGES demonstrate a real milestone achievement.

Find the most impactful ones (aim for 5-15 milestones depending on the project's activity).

Commits (newest first):
${commitsText}

Respond with a JSON object: { "milestones": [...] }`;

		// Log request details
		const requestPayloadSize = new TextEncoder().encode(userMessage).length;
		console.log(`Sending OpenAI request: ${requestPayloadSize} bytes, ${commitsText.split('\n\n---\n\n').length} commits`);

		const response = await Promise.race([
			openai.chat.completions.create({
				model: 'gpt-4o',
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{ role: 'user', content: userMessage }
				],
				response_format: { type: 'json_object' },
				temperature: 0.7,
				max_tokens: 4000
			}),
			timeoutPromise
		]);

		// Type guard to ensure we have a ChatCompletion, not a Stream
		if (!response || typeof response !== 'object' || !('choices' in response)) {
			throw new Error('Invalid response from OpenAI API');
		}

		const content = (response as { choices: Array<{ message?: { content?: string } }> }).choices[0]?.message?.content;
		if (!content) {
			console.warn('OpenAI returned empty response');
			return [];
		}

		const parsed = JSON.parse(content);
		const milestones = (parsed.milestones ?? []) as Milestone[];
		console.log(`OpenAI analysis successful: ${milestones.length} milestones identified`);
		return milestones;
	} catch (error) {
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
