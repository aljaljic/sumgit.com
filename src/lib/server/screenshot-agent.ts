import OpenAI from 'openai';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';
import { secureLog } from './logger';

const openai = new OpenAI({
	apiKey: PRIVATE_OPENAI_API_KEY,
	fetch: globalThis.fetch,
	timeout: 30000,
	maxRetries: 0
});

export interface ScreenshotTarget {
	should_screenshot: boolean;
	url_path: string;
	element_selector: string | null;
	viewport: { width: number; height: number };
	full_page: boolean;
	reason: string;
}

const SCREENSHOT_AGENT_PROMPT = `You are an expert at determining how to capture screenshots of web applications to showcase new features.

Given a feature description and the base URL of a deployed web application, determine:
1. Whether this feature is likely visible and worth screenshotting
2. What page/URL path would show this feature
3. Whether to capture a specific element or the full page
4. The ideal viewport size

IMPORTANT GUIDELINES:
- Only suggest screenshots for USER-FACING features that would be visible in a browser
- Skip: API changes, backend features, database changes, refactors, config updates
- For features that might require authentication (dashboard, settings, etc.), still provide the path
- Be conservative - if unsure whether the feature is visible, set should_screenshot to false

Common page patterns:
- Landing page features: "/" or "/home"
- Dashboard features: "/dashboard" or "/app"
- Settings/config features: "/settings" or "/preferences"
- Authentication: "/login" or "/signup"
- Documentation: "/docs" or "/help"
- Product pages: "/product" or "/features"

Viewport recommendations:
- Desktop standard: 1280x800
- Hero sections: 1280x720
- Full page layouts: 1280x900
- Mobile features: 375x812

Respond with JSON only:
{
  "should_screenshot": boolean,
  "url_path": string (e.g., "/" or "/dashboard"),
  "element_selector": string | null (CSS selector like ".hero-section" or null for full viewport),
  "viewport": { "width": number, "height": number },
  "full_page": boolean,
  "reason": string (brief explanation of your decision)
}`;

export async function determineScreenshotTarget(
	featureTitle: string,
	featureDescription: string,
	baseUrl: string,
	repoName: string
): Promise<ScreenshotTarget> {
	const userMessage = `Feature: ${featureTitle}
Description: ${featureDescription}
Base URL: ${baseUrl}
Repository: ${repoName}

Determine the best screenshot target for this feature.`;

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-5-mini',
			messages: [
				{ role: 'system', content: SCREENSHOT_AGENT_PROMPT },
				{ role: 'user', content: userMessage }
			],
			response_format: { type: 'json_object' },
			max_completion_tokens: 500
		});

		const content = response.choices[0]?.message?.content;
		if (!content) {
			secureLog.warn('Screenshot agent returned empty response');
			return getDefaultTarget(false, 'Empty AI response');
		}

		const parsed = JSON.parse(content) as ScreenshotTarget;

		// Validate the response
		if (typeof parsed.should_screenshot !== 'boolean') {
			return getDefaultTarget(false, 'Invalid AI response format');
		}

		secureLog.info(`Screenshot agent decision: ${parsed.should_screenshot ? 'capture' : 'skip'} - ${parsed.reason}`);

		return {
			should_screenshot: parsed.should_screenshot,
			url_path: parsed.url_path || '/',
			element_selector: parsed.element_selector || null,
			viewport: parsed.viewport || { width: 1280, height: 800 },
			full_page: parsed.full_page ?? false,
			reason: parsed.reason || 'No reason provided'
		};
	} catch (error) {
		secureLog.error('Screenshot agent error:', error);
		return getDefaultTarget(false, 'AI error - skipping screenshot');
	}
}

function getDefaultTarget(shouldScreenshot: boolean, reason: string): ScreenshotTarget {
	return {
		should_screenshot: shouldScreenshot,
		url_path: '/',
		element_selector: null,
		viewport: { width: 1280, height: 800 },
		full_page: false,
		reason
	};
}
