import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { Database } from '$lib/database.types';
import { secureLog } from '$lib/server/logger';
import {
	processMessage,
	createInitialState,
	getInitialGreeting,
	setStateProcessing,
	setStateCompleted,
	setStateError,
	generateEncryptionKey,
	exportKey,
	importKey,
	decryptPassword,
	type ThreadState
} from '$lib/server/chatkit/handler';
import { runAnalysisWorkflow } from '$lib/server/agents/workflow';
import { getInstallationOctokit } from '$lib/github-app';
import type { Commit } from '$lib/openai';

const supabaseAdmin = createClient<Database>(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);

// Thread expiry time (1 hour)
const THREAD_EXPIRY_MS = 60 * 60 * 1000;

/**
 * ChatKit Protocol Handler
 *
 * Handles:
 * - POST with action: 'create_thread' - Creates a new conversation thread
 * - POST with action: 'send_message' - Sends a message to a thread
 * - POST with action: 'get_thread' - Gets thread state and messages
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { action } = body;

	switch (action) {
		case 'create_thread':
			return handleCreateThread(body, user.id, locals);

		case 'send_message':
			return handleSendMessage(body, user.id, locals, platform);

		case 'get_thread':
			return handleGetThread(body, user.id);

		default:
			throw error(400, `Unknown action: ${action}`);
	}
};

/**
 * Create a new conversation thread
 */
async function handleCreateThread(
	body: { repository_id: string },
	userId: string,
	locals: App.Locals
) {
	const { repository_id } = body;

	if (!repository_id) {
		throw error(400, 'repository_id is required');
	}

	// Verify user owns the repository
	const { data: repo } = await locals.supabase
		.from('repositories')
		.select('id, site_url')
		.eq('id', repository_id)
		.eq('user_id', userId)
		.single();

	if (!repo) {
		throw error(404, 'Repository not found');
	}

	// Generate thread ID and encryption key
	const threadId = crypto.randomUUID();
	const encryptionKey = await generateEncryptionKey();
	const exportedKey = await exportKey(encryptionKey);

	// Create initial state
	const initialState = createInitialState(repository_id, repo.site_url || undefined);

	// Calculate expiry time
	const expiresAt = new Date(Date.now() + THREAD_EXPIRY_MS).toISOString();

	// Store thread in database
	const { error: insertError } = await supabaseAdmin.from('chatkit_threads').insert({
		user_id: userId,
		repository_id: repository_id,
		thread_id: threadId,
		state: initialState as any,
		encryption_key: exportedKey,
		expires_at: expiresAt
	});

	if (insertError) {
		secureLog.error('Failed to create thread:', insertError);
		throw error(500, 'Failed to create thread');
	}

	// Return thread ID and initial greeting
	return json({
		thread_id: threadId,
		messages: [
			{
				role: 'assistant',
				content: getInitialGreeting()
			}
		],
		expires_at: expiresAt
	});
}

/**
 * Send a message to a thread
 */
async function handleSendMessage(
	body: { thread_id: string; message: string },
	userId: string,
	locals: App.Locals,
	platform: App.Platform | undefined
) {
	const { thread_id, message } = body;

	if (!thread_id || !message) {
		throw error(400, 'thread_id and message are required');
	}

	// Get thread from database
	const { data: thread } = await supabaseAdmin
		.from('chatkit_threads')
		.select('*')
		.eq('thread_id', thread_id)
		.eq('user_id', userId)
		.single();

	if (!thread) {
		throw error(404, 'Thread not found');
	}

	// Check if thread is expired
	if (new Date(thread.expires_at) < new Date()) {
		throw error(410, 'Thread has expired. Please create a new conversation.');
	}

	// Import encryption key
	const encryptionKey = await importKey(thread.encryption_key);
	const currentState = thread.state as unknown as ThreadState;

	// Process the message
	const result = await processMessage(message, currentState, encryptionKey);

	// Update thread state
	const { error: updateError } = await supabaseAdmin
		.from('chatkit_threads')
		.update({ state: result.newState as any })
		.eq('thread_id', thread_id);

	if (updateError) {
		secureLog.error('Failed to update thread state:', updateError);
	}

	// If credentials are complete, trigger the workflow
	if (result.shouldTriggerWorkflow && result.credentials) {
		// Run workflow in background (don't await)
		triggerAuthenticatedWorkflow(
			thread_id,
			userId,
			result.newState.repositoryId,
			result.credentials,
			locals,
			platform
		).catch((err) => {
			secureLog.error('Background workflow failed:', err);
		});
	}

	return json({
		thread_id,
		messages: [
			{
				role: 'assistant',
				content: result.response
			}
		]
	});
}

/**
 * Get thread state and messages
 */
async function handleGetThread(body: { thread_id: string }, userId: string) {
	const { thread_id } = body;

	if (!thread_id) {
		throw error(400, 'thread_id is required');
	}

	const { data: thread } = await supabaseAdmin
		.from('chatkit_threads')
		.select('*')
		.eq('thread_id', thread_id)
		.eq('user_id', userId)
		.single();

	if (!thread) {
		throw error(404, 'Thread not found');
	}

	const state = thread.state as unknown as ThreadState;

	return json({
		thread_id,
		state: state.conversationState,
		expires_at: thread.expires_at,
		is_expired: new Date(thread.expires_at) < new Date()
	});
}

/**
 * Trigger the authenticated screenshot workflow
 */
async function triggerAuthenticatedWorkflow(
	threadId: string,
	userId: string,
	repositoryId: string,
	credentials: { loginUrl: string; username: string; password: string },
	locals: App.Locals,
	platform: App.Platform | undefined
) {
	try {
		// Update state to processing
		await supabaseAdmin
			.from('chatkit_threads')
			.update({
				state: setStateProcessing({
					conversationState: 'processing',
					repositoryId,
					createdAt: new Date().toISOString()
				}) as any
			})
			.eq('thread_id', threadId);

		// Get repository details
		const { data: repo } = await locals.supabase
			.from('repositories')
			.select('*')
			.eq('id', repositoryId)
			.eq('user_id', userId)
			.single();

		if (!repo) {
			throw new Error('Repository not found');
		}

		// Get GitHub installation
		const { data: installations } = await locals.supabase
			.from('github_installations')
			.select('*')
			.eq('user_id', userId);

		if (!installations || installations.length === 0) {
			throw new Error('No GitHub installation found');
		}

		// Find working installation
		let octokit = null;
		for (const installation of installations) {
			try {
				const testOctokit = await getInstallationOctokit(installation.installation_id);
				await testOctokit.repos.get({
					owner: repo.repo_owner,
					repo: repo.repo_name
				});
				octokit = testOctokit;
				break;
			} catch {
				continue;
			}
		}

		if (!octokit) {
			throw new Error('No GitHub installation has access to this repository');
		}

		// Fetch commits
		const commits: Commit[] = [];
		const { data: commitData } = await octokit.repos.listCommits({
			owner: repo.repo_owner,
			repo: repo.repo_name,
			per_page: 20 // Fewer commits for authenticated screenshots
		});

		for (const commit of commitData) {
			const message = (commit.commit.message ?? '').split('\n')[0] ?? '';
			if (message.toLowerCase().startsWith('merge')) continue;

			commits.push({
				sha: commit.sha,
				message,
				date: commit.commit.author?.date ?? new Date().toISOString(),
				author: commit.commit.author?.name ?? 'Unknown'
			});
		}

		// Get browser binding
		const browserBinding = platform?.env?.BROWSER;

		// Run workflow with authentication
		const workflowResult = await runAnalysisWorkflow({
			commits: commits.slice(0, 10),
			siteUrl: repo.site_url || credentials.loginUrl,
			browserBinding,
			maxScreenshots: 3,
			authentication: credentials
		});

		secureLog.info(
			`Authenticated workflow complete: ${workflowResult.milestones.length} milestones, ${workflowResult.analysisDetails.screenshotsCaptured} screenshots`
		);

		// Update state to completed
		await supabaseAdmin
			.from('chatkit_threads')
			.update({
				state: setStateCompleted({
					conversationState: 'completed',
					repositoryId,
					createdAt: new Date().toISOString()
				}) as any
			})
			.eq('thread_id', threadId);
	} catch (err) {
		secureLog.error('Authenticated workflow failed:', err);

		// Update state to error
		await supabaseAdmin
			.from('chatkit_threads')
			.update({
				state: setStateError(
					{
						conversationState: 'error',
						repositoryId,
						createdAt: new Date().toISOString()
					},
					err instanceof Error ? err.message : 'Unknown error'
				) as any
			})
			.eq('thread_id', threadId);
	}
}
