import { secureLog } from '../logger';

/**
 * Conversation states for credential collection
 */
export type ConversationState =
	| 'initial'
	| 'awaiting_login_url'
	| 'awaiting_username'
	| 'awaiting_password'
	| 'credentials_complete'
	| 'processing'
	| 'completed'
	| 'error';

/**
 * Thread state stored in database
 */
export interface ThreadState {
	conversationState: ConversationState;
	loginUrl?: string;
	username?: string;
	encryptedPassword?: string;
	repositoryId: string;
	siteUrl?: string;
	errorMessage?: string;
	createdAt: string;
}

/**
 * Message format for ChatKit
 */
export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

/**
 * Result of processing a message
 */
export interface ProcessMessageResult {
	response: string;
	newState: ThreadState;
	shouldTriggerWorkflow: boolean;
	credentials?: {
		loginUrl: string;
		username: string;
		password: string;
	};
}

/**
 * Encrypt a password for storage
 * Uses Web Crypto API for encryption
 */
export async function encryptPassword(password: string, key: CryptoKey): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(password);
	const iv = crypto.getRandomValues(new Uint8Array(12));

	const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

	// Combine IV and encrypted data
	const combined = new Uint8Array(iv.length + encrypted.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(encrypted), iv.length);

	return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a password from storage
 */
export async function decryptPassword(encryptedPassword: string, key: CryptoKey): Promise<string> {
	const combined = new Uint8Array(
		atob(encryptedPassword)
			.split('')
			.map((c) => c.charCodeAt(0))
	);

	const iv = combined.slice(0, 12);
	const data = combined.slice(12);

	const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);

	return new TextDecoder().decode(decrypted);
}

/**
 * Generate an encryption key for credential storage
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
	return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/**
 * Export key to string for storage
 */
export async function exportKey(key: CryptoKey): Promise<string> {
	const exported = await crypto.subtle.exportKey('raw', key);
	return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

/**
 * Import key from string
 */
export async function importKey(keyString: string): Promise<CryptoKey> {
	const keyData = new Uint8Array(
		atob(keyString)
			.split('')
			.map((c) => c.charCodeAt(0))
	);
	return crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM', length: 256 }, true, [
		'encrypt',
		'decrypt'
	]);
}

/**
 * Validate URL format
 */
function isValidUrl(urlString: string): boolean {
	try {
		const url = new URL(urlString);
		return url.protocol === 'https:' || url.protocol === 'http:';
	} catch {
		return false;
	}
}

/**
 * Validate that login URL matches the repository's site URL domain
 */
function validateLoginUrlDomain(loginUrl: string, siteUrl?: string): boolean {
	if (!siteUrl) return true; // Allow if no site URL is configured

	try {
		const loginDomain = new URL(loginUrl).hostname;
		const siteDomain = new URL(siteUrl).hostname;

		// Allow same domain or subdomains
		return loginDomain === siteDomain || loginDomain.endsWith('.' + siteDomain);
	} catch {
		return false;
	}
}

/**
 * Create initial thread state
 */
export function createInitialState(repositoryId: string, siteUrl?: string): ThreadState {
	return {
		conversationState: 'initial',
		repositoryId,
		siteUrl,
		createdAt: new Date().toISOString()
	};
}

/**
 * Get the initial greeting message
 */
export function getInitialGreeting(): string {
	return `Hi! I can help you capture screenshots of authenticated pages in your application.

To get started, I'll need some test account credentials. These will be encrypted and only used for this screenshot session (automatically deleted after 1 hour).

**What's the login URL for your application?**

For example: \`https://myapp.com/login\` or \`https://myapp.com/signin\``;
}

/**
 * Process a user message and return the response
 */
export async function processMessage(
	userMessage: string,
	currentState: ThreadState,
	encryptionKey?: CryptoKey
): Promise<ProcessMessageResult> {
	const message = userMessage.trim();
	let newState = { ...currentState };
	let response: string;
	let shouldTriggerWorkflow = false;
	let credentials: ProcessMessageResult['credentials'];

	switch (currentState.conversationState) {
		case 'initial':
		case 'awaiting_login_url': {
			// User is providing login URL
			if (!isValidUrl(message)) {
				response = `That doesn't look like a valid URL. Please provide the full login URL including the protocol.

For example: \`https://myapp.com/login\``;
				newState.conversationState = 'awaiting_login_url';
			} else if (!validateLoginUrlDomain(message, currentState.siteUrl)) {
				response = `The login URL domain doesn't match your configured site URL (${currentState.siteUrl}).

For security, please provide a login URL on the same domain, or update your repository's site URL first.`;
				newState.conversationState = 'awaiting_login_url';
			} else {
				newState.loginUrl = message;
				newState.conversationState = 'awaiting_username';
				response = `Got it! I'll use \`${message}\` for login.

**What's the username or email for the test account?**`;
			}
			break;
		}

		case 'awaiting_username': {
			if (message.length < 1) {
				response = `Please provide a valid username or email address.`;
			} else {
				newState.username = message;
				newState.conversationState = 'awaiting_password';
				response = `Thanks! The username is \`${message}\`.

**What's the password for this test account?**

(This will be encrypted and only used for this screenshot session)`;
			}
			break;
		}

		case 'awaiting_password': {
			if (message.length < 1) {
				response = `Please provide the password for the test account.`;
			} else {
				// Encrypt password if key provided
				if (encryptionKey) {
					try {
						newState.encryptedPassword = await encryptPassword(message, encryptionKey);
					} catch (err) {
						secureLog.error('Failed to encrypt password:', err);
						response = `There was an error securing your credentials. Please try again.`;
						newState.conversationState = 'awaiting_password';
						break;
					}
				}

				newState.conversationState = 'credentials_complete';
				response = `Perfect! I have all the credentials:

- **Login URL:** ${newState.loginUrl}
- **Username:** ${newState.username}
- **Password:** ********

I'll now capture screenshots while logged in. This may take a moment...

*Starting authenticated screenshot capture...*`;

				shouldTriggerWorkflow = true;

				// Only include credentials if we can decrypt them
				if (encryptionKey && newState.encryptedPassword) {
					credentials = {
						loginUrl: newState.loginUrl!,
						username: newState.username!,
						password: message // Use the original message, not encrypted
					};
				}
			}
			break;
		}

		case 'credentials_complete':
		case 'processing': {
			response = `I'm currently processing your request. Please wait while I capture the authenticated screenshots...

If you need to provide new credentials, please start a new conversation.`;
			break;
		}

		case 'completed': {
			response = `The screenshot capture has been completed! You can view the results on your project page.

If you need to capture more authenticated screenshots with different credentials, please start a new conversation.`;
			break;
		}

		case 'error': {
			response = `There was an error with the previous request: ${currentState.errorMessage || 'Unknown error'}

Would you like to try again? Please provide the login URL for your application.`;
			newState.conversationState = 'awaiting_login_url';
			newState.errorMessage = undefined;
			break;
		}

		default: {
			response = `I'm not sure how to help with that. Let's start fresh - what's the login URL for your application?`;
			newState.conversationState = 'awaiting_login_url';
		}
	}

	return {
		response,
		newState,
		shouldTriggerWorkflow,
		credentials
	};
}

/**
 * Update state to processing
 */
export function setStateProcessing(state: ThreadState): ThreadState {
	return {
		...state,
		conversationState: 'processing'
	};
}

/**
 * Update state to completed
 */
export function setStateCompleted(state: ThreadState): ThreadState {
	return {
		...state,
		conversationState: 'completed'
	};
}

/**
 * Update state to error
 */
export function setStateError(state: ThreadState, errorMessage: string): ThreadState {
	return {
		...state,
		conversationState: 'error',
		errorMessage
	};
}
