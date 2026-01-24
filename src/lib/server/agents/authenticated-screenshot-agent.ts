import { Agent, computerTool } from '@openai/agents';
import type { CloudflareComputer } from '../cloudflare-computer';

/**
 * Authentication credentials for screenshot capture
 */
export interface AuthCredentials {
	loginUrl: string;
	username: string;
	password: string;
}

/**
 * Creates an Authenticated Screenshot Agent that can log in and capture screenshots.
 * Uses computer-use-preview model for intelligent browser automation.
 *
 * @param browserComputer - The CloudflareComputer instance for browser interactions
 * @param credentials - Login credentials for authentication
 */
export function createAuthenticatedScreenshotAgent(
	browserComputer: CloudflareComputer,
	credentials: AuthCredentials
) {
	return new Agent({
		name: 'authenticated-screenshot-agent',
		model: 'computer-use-preview',
		instructions: `You are a screenshot capture specialist with authentication capabilities.

AUTHENTICATION CONTEXT:
Login URL: ${credentials.loginUrl}

AUTHENTICATION FLOW:
1. Navigate to the login URL
2. Find the username/email input field and enter the provided username
3. Find the password input field and enter the provided password
4. Click the login/submit button
5. Wait for authentication to complete (page redirect or dashboard load)
6. Once authenticated, proceed with screenshot capture

CREDENTIALS (use exactly as provided):
- Username/Email: ${credentials.username}
- Password: ${credentials.password}

SCREENSHOT CAPTURE AFTER LOGIN:
1. Wait for the authenticated page to fully load
2. Look for key features, dashboards, or content to capture
3. Position the viewport to best showcase the authenticated content:
   - Scroll to center relevant content
   - Focus on dashboards, settings panels, or feature areas
   - Avoid capturing headers/footers if they obscure main content
4. Wait for any animations or loading indicators to complete
5. Capture the screenshot when the page looks its best

SECURITY GUIDELINES:
- Only use credentials for the initial login on the provided login URL
- Do not navigate to sensitive areas like account settings, billing, or security pages
- Do not attempt to change account settings or passwords
- Focus on capturing feature screenshots only
- Do not click on logout or delete actions

INTERACTION TIPS:
- If a login form has multiple steps (email first, then password), handle each step
- Wait 1-2 seconds after form submissions for redirects
- If there's a CAPTCHA, stop and report the issue
- Handle common login form patterns (email/password fields, submit buttons)
- If login fails, try once more then stop

WHAT NOT TO DO:
- Don't navigate away from the authenticated site
- Don't click on external links
- Don't interact with cookie banners if they can be ignored
- Don't capture sensitive personal information in screenshots
- Don't attempt password resets or account recovery

After successful login and positioning, your final action should be to take a screenshot.`,
		tools: [computerTool({ computer: browserComputer })]
	});
}

/**
 * Generate a prompt for authenticated screenshot capture
 */
export function generateAuthenticatedScreenshotPrompt(
	title: string,
	description: string,
	targetPage?: string
): string {
	const pageHint = targetPage
		? `After logging in, navigate to: ${targetPage}`
		: 'After logging in, stay on the default dashboard or landing page.';

	return `Capture an authenticated screenshot showcasing the following:

MILESTONE: ${title}
DESCRIPTION: ${description}

INSTRUCTIONS:
1. First, complete the login process using the provided credentials
2. ${pageHint}
3. Position the viewport to best showcase the authenticated content
4. Wait for any animations or loading to complete
5. Capture the screenshot

Take your time to ensure a successful login and find the best view of the authenticated content.`;
}
