import { Agent, computerTool } from '@openai/agents';
import type { CloudflareComputer } from '../cloudflare-computer';

/**
 * Creates a Screenshot Agent that uses computer-use-preview for intelligent screenshot capture.
 * The agent can navigate, interact with the page, and capture optimal screenshots.
 *
 * @param browserComputer - The CloudflareComputer instance for browser interactions
 */
export function createScreenshotAgent(browserComputer: CloudflareComputer) {
	return new Agent({
		name: 'screenshot-agent',
		model: 'computer-use-preview',
		instructions: `You are a screenshot capture specialist. Your task is to capture the best possible screenshot of a web application to showcase a specific feature or milestone.

YOUR CAPABILITIES:
- Navigate the page by scrolling
- Click on elements to reveal features
- Wait for animations and loading to complete
- Capture screenshots at optimal moments

SCREENSHOT GUIDELINES:
1. First, observe the current page state
2. Look for the feature mentioned in the task
3. Position the viewport to best showcase the feature:
   - Scroll to center the relevant content
   - If there's a hero section with the feature, focus on that
   - Avoid capturing headers/footers if they obscure the main content
4. Wait for any animations or loading indicators to complete
5. Capture the screenshot when the page looks its best

INTERACTION TIPS:
- If a feature requires interaction to be visible (like a dropdown or modal), click to reveal it
- Wait 1-2 seconds after interactions for animations to complete
- If the page requires scrolling, scroll smoothly to find the best view
- Prefer landscape viewport captures for most features

WHAT NOT TO DO:
- Don't try to log in or fill out forms with sensitive data
- Don't navigate away from the main site
- Don't click on external links
- Don't interact with cookie banners if they can be ignored

After positioning the page optimally, your final action should be to take a screenshot.`,
		tools: [computerTool({ computer: browserComputer })]
	});
}

/**
 * Instructions for specific milestone types
 */
export const MILESTONE_SCREENSHOT_HINTS: Record<string, string> = {
	feature: 'Look for new UI elements, buttons, or sections that showcase this feature.',
	bugfix:
		'Try to show the area of the application where the bug was fixed, if visually apparent.',
	refactor: 'Show the main interface - refactors often improve overall polish.',
	docs: 'Navigate to the documentation section if visible.',
	config: 'Show the settings or configuration area if applicable.',
	other: 'Find the most representative view of the application.'
};

/**
 * Generate a prompt for the screenshot agent based on milestone details
 */
export function generateScreenshotPrompt(
	title: string,
	description: string,
	milestoneType: string
): string {
	const hint = MILESTONE_SCREENSHOT_HINTS[milestoneType] || MILESTONE_SCREENSHOT_HINTS.other;

	return `Capture a screenshot showcasing the following milestone:

MILESTONE: ${title}
DESCRIPTION: ${description}
TYPE: ${milestoneType}

HINT: ${hint}

Please:
1. First observe the current page
2. Navigate/scroll to find the best view of this feature
3. Position the viewport optimally
4. Wait for any animations to complete
5. Capture the screenshot

Take your time to find the best angle that showcases this milestone effectively.`;
}
