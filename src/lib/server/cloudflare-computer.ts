import type { Computer } from '@openai/agents';
import puppeteer from '@cloudflare/puppeteer';
import type { BrowserWorker } from '@cloudflare/puppeteer';
import type { Browser, Page } from '@cloudflare/puppeteer';

type Button = 'left' | 'right' | 'wheel' | 'back' | 'forward';

/**
 * Computer interface implementation using Cloudflare Browser Rendering
 * for use with OpenAI's computer-use-preview model
 */
export class CloudflareComputer implements Computer {
	environment: 'browser' = 'browser';
	dimensions: [number, number] = [1280, 800];

	private browserBinding: BrowserWorker;
	private browser: Browser | null = null;
	private page: Page | null = null;
	private defaultWaitMs = 1000;

	constructor(browserBinding: BrowserWorker) {
		this.browserBinding = browserBinding;
	}

	async initialize(url: string): Promise<void> {
		this.browser = await puppeteer.launch(this.browserBinding);
		this.page = await this.browser.newPage();
		await this.page.setViewport({
			width: this.dimensions[0],
			height: this.dimensions[1],
			deviceScaleFactor: 2 // Retina quality
		});
		await this.page.goto(url, { waitUntil: 'networkidle0' });
	}

	async screenshot(): Promise<string> {
		if (!this.page) {
			throw new Error('Browser not initialized. Call initialize() first.');
		}
		const buffer = await this.page.screenshot({ encoding: 'base64' });
		return buffer as string;
	}

	async click(x: number, y: number, button: Button = 'left'): Promise<void> {
		if (!this.page) {
			throw new Error('Browser not initialized');
		}
		const puppeteerButton = button === 'left' ? 'left' : button === 'right' ? 'right' : 'middle';
		await this.page.mouse.click(x, y, { button: puppeteerButton });
	}

	async type(text: string): Promise<void> {
		if (!this.page) {
			throw new Error('Browser not initialized');
		}
		await this.page.keyboard.type(text);
	}

	async scroll(x: number, y: number, scrollX: number, scrollY: number): Promise<void> {
		if (!this.page) {
			throw new Error('Browser not initialized');
		}
		await this.page.mouse.move(x, y);
		await this.page.evaluate(
			({ sx, sy }) => window.scrollBy(sx, sy),
			{ sx: scrollX, sy: scrollY }
		);
	}

	async keypress(keys: string[]): Promise<void> {
		if (!this.page) {
			throw new Error('Browser not initialized');
		}
		for (const key of keys) {
			await this.page.keyboard.press(key as any);
		}
	}

	async wait(): Promise<void> {
		await new Promise((r) => setTimeout(r, this.defaultWaitMs));
	}

	async move(x: number, y: number): Promise<void> {
		if (!this.page) {
			throw new Error('Browser not initialized');
		}
		await this.page.mouse.move(x, y);
	}

	async doubleClick(x: number, y: number): Promise<void> {
		if (!this.page) {
			throw new Error('Browser not initialized');
		}
		await this.page.mouse.click(x, y, { clickCount: 2 });
	}

	async drag(path: [number, number][]): Promise<void> {
		if (!this.page) {
			throw new Error('Browser not initialized');
		}
		if (path.length < 2) return;
		await this.page.mouse.move(path[0][0], path[0][1]);
		await this.page.mouse.down();
		for (const [x, y] of path.slice(1)) {
			await this.page.mouse.move(x, y);
		}
		await this.page.mouse.up();
	}

	async cleanup(): Promise<void> {
		if (this.page) {
			await this.page.close();
			this.page = null;
		}
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
		}
	}

	/**
	 * Get the current page for direct access if needed
	 */
	getPage(): Page | null {
		return this.page;
	}
}
