import { PRIVATE_BROWSERLESS_APIKEY } from '$env/static/private';
import { secureLog } from './logger';
import type { ScreenshotTarget } from './screenshot-agent';

export interface ScreenshotResult {
	success: boolean;
	imageData?: Uint8Array;
	error?: string;
}

const BROWSERLESS_API_URL = 'https://chrome.browserless.io/screenshot';

/**
 * Capture a screenshot using Browserless v2 API
 */
export async function captureScreenshot(options: {
	url: string;
	target: ScreenshotTarget;
}): Promise<ScreenshotResult> {
	const { url, target } = options;

	if (!PRIVATE_BROWSERLESS_APIKEY) {
		secureLog.warn('Browserless API key not configured');
		return { success: false, error: 'Browserless API key not configured' };
	}

	const fullUrl = buildFullUrl(url, target.url_path);
	secureLog.info(`Capturing screenshot of: ${fullUrl}`);

	try {
		const requestBody: BrowserlessScreenshotRequest = {
			url: fullUrl,
			options: {
				type: 'png',
				fullPage: target.full_page,
				clip: target.element_selector ? undefined : {
					x: 0,
					y: 0,
					width: target.viewport.width,
					height: target.viewport.height
				}
			},
			viewport: {
				width: target.viewport.width,
				height: target.viewport.height,
				deviceScaleFactor: 2 // Retina quality
			},
			gotoOptions: {
				waitUntil: 'networkidle2',
				timeout: 15000
			}
		};

		// If targeting a specific element, use waitForSelector
		if (target.element_selector) {
			requestBody.waitForSelector = {
				selector: target.element_selector,
				timeout: 10000
			};
			// For element screenshots, we'll use full page and let the UI crop or display as needed
			requestBody.options.fullPage = true;
		}

		const response = await fetch(`${BROWSERLESS_API_URL}?token=${PRIVATE_BROWSERLESS_APIKEY}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			const errorText = await response.text();
			secureLog.error(`Browserless API error: ${response.status} - ${errorText}`);
			return {
				success: false,
				error: `Screenshot capture failed: ${response.status}`
			};
		}

		const arrayBuffer = await response.arrayBuffer();
		const imageData = new Uint8Array(arrayBuffer);

		if (imageData.length < 1000) {
			// Suspiciously small image, might be an error
			secureLog.warn('Screenshot appears to be too small, may have failed');
			return {
				success: false,
				error: 'Screenshot capture returned invalid data'
			};
		}

		secureLog.info(`Screenshot captured successfully: ${imageData.length} bytes`);
		return {
			success: true,
			imageData
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		secureLog.error(`Screenshot capture error: ${errorMessage}`);
		return {
			success: false,
			error: `Screenshot capture failed: ${errorMessage}`
		};
	}
}

function buildFullUrl(baseUrl: string, path: string): string {
	// Ensure baseUrl doesn't end with a slash
	const cleanBase = baseUrl.replace(/\/$/, '');
	// Ensure path starts with a slash
	const cleanPath = path.startsWith('/') ? path : `/${path}`;
	return `${cleanBase}${cleanPath}`;
}

interface BrowserlessScreenshotRequest {
	url: string;
	options: {
		type: 'png' | 'jpeg';
		fullPage: boolean;
		clip?: {
			x: number;
			y: number;
			width: number;
			height: number;
		};
	};
	viewport: {
		width: number;
		height: number;
		deviceScaleFactor: number;
	};
	gotoOptions: {
		waitUntil: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
		timeout: number;
	};
	waitForSelector?: {
		selector: string;
		timeout: number;
	};
}
