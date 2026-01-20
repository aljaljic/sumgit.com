/**
 * Secure logging utility that sanitizes sensitive data before logging
 * Prevents credentials, tokens, and PII from appearing in logs
 */

// Patterns that match sensitive data to redact
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
	// API keys and secrets (various formats)
	{ pattern: /sk_live_[a-zA-Z0-9_-]+/g, replacement: 'sk_live_[REDACTED]' },
	{ pattern: /sk_test_[a-zA-Z0-9_-]+/g, replacement: 'sk_test_[REDACTED]' },
	{ pattern: /pk_live_[a-zA-Z0-9_-]+/g, replacement: 'pk_live_[REDACTED]' },
	{ pattern: /pk_test_[a-zA-Z0-9_-]+/g, replacement: 'pk_test_[REDACTED]' },
	{ pattern: /whsec_[a-zA-Z0-9_-]+/g, replacement: 'whsec_[REDACTED]' },
	{ pattern: /sk-[a-zA-Z0-9_-]{20,}/g, replacement: 'sk-[REDACTED]' }, // OpenAI keys
	{ pattern: /ghp_[a-zA-Z0-9_-]+/g, replacement: 'ghp_[REDACTED]' }, // GitHub PATs
	{ pattern: /ghs_[a-zA-Z0-9_-]+/g, replacement: 'ghs_[REDACTED]' }, // GitHub App tokens
	{ pattern: /gho_[a-zA-Z0-9_-]+/g, replacement: 'gho_[REDACTED]' }, // GitHub OAuth tokens

	// JWTs and session tokens (base64 patterns with dots)
	{ pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, replacement: '[JWT_REDACTED]' },

	// Supabase service role keys (typically base64)
	{
		pattern: /service_role['":\s]+[a-zA-Z0-9+/=]{40,}/gi,
		replacement: 'service_role: [REDACTED]'
	},

	// Bearer tokens
	{ pattern: /Bearer\s+[a-zA-Z0-9_.-]+/gi, replacement: 'Bearer [REDACTED]' },

	// Basic auth
	{ pattern: /Basic\s+[a-zA-Z0-9+/=]+/gi, replacement: 'Basic [REDACTED]' },

	// Email addresses (basic pattern)
	{
		pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
		replacement: '[EMAIL_REDACTED]'
	},

	// Credit card numbers (basic patterns)
	{ pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[CARD_REDACTED]' },

	// UUIDs in error contexts that might reveal user IDs (optional - uncomment if needed)
	// { pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, replacement: '[UUID_REDACTED]' },

	// Password-related strings
	{ pattern: /password['":\s]+[^\s'"]+/gi, replacement: 'password: [REDACTED]' },
	{ pattern: /secret['":\s]+[^\s'"]+/gi, replacement: 'secret: [REDACTED]' },

	// AWS credentials
	{ pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[AWS_KEY_REDACTED]' },

	// Private keys
	{ pattern: /-----BEGIN[^-]+PRIVATE KEY-----[\s\S]*?-----END[^-]+PRIVATE KEY-----/g, replacement: '[PRIVATE_KEY_REDACTED]' }
];

/**
 * Sanitize a string by redacting sensitive patterns
 */
export function sanitize(input: string): string {
	let result = input;
	for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
		result = result.replace(pattern, replacement);
	}
	return result;
}

/**
 * Sanitize an object recursively
 */
export function sanitizeObject(obj: unknown): unknown {
	if (obj === null || obj === undefined) {
		return obj;
	}

	if (typeof obj === 'string') {
		return sanitize(obj);
	}

	if (Array.isArray(obj)) {
		return obj.map(sanitizeObject);
	}

	if (typeof obj === 'object') {
		const sanitized: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			// Redact values of sensitive keys entirely
			const lowerKey = key.toLowerCase();
			if (
				lowerKey.includes('password') ||
				lowerKey.includes('secret') ||
				lowerKey.includes('token') ||
				lowerKey.includes('key') ||
				lowerKey.includes('authorization') ||
				lowerKey.includes('credential')
			) {
				sanitized[key] = '[REDACTED]';
			} else {
				sanitized[key] = sanitizeObject(value);
			}
		}
		return sanitized;
	}

	return obj;
}

/**
 * Secure logger that sanitizes output
 */
export const secureLog = {
	info(message: string, ...args: unknown[]): void {
		console.log(sanitize(message), ...args.map(sanitizeObject));
	},

	warn(message: string, ...args: unknown[]): void {
		console.warn(sanitize(message), ...args.map(sanitizeObject));
	},

	error(message: string, ...args: unknown[]): void {
		console.error(sanitize(message), ...args.map(sanitizeObject));
	},

	debug(message: string, ...args: unknown[]): void {
		if (import.meta.env.DEV) {
			console.debug(sanitize(message), ...args.map(sanitizeObject));
		}
	}
};

export default secureLog;
