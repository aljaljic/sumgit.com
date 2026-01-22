import type { Octokit } from '@octokit/rest';
import { secureLog } from './logger';

export interface SiteUrlResult {
	url: string | null;
	source: 'homepage' | 'readme' | 'package_json' | null;
}

/**
 * Extract deployed site URL from a GitHub repository
 * Checks in order of confidence:
 * 1. GitHub repo homepage field (highest confidence)
 * 2. package.json homepage field
 * 3. README patterns (Live at, Demo:, etc.)
 */
export async function extractSiteUrl(
	octokit: Octokit,
	owner: string,
	repo: string
): Promise<SiteUrlResult> {
	// 1. Try GitHub repo homepage field first (highest confidence)
	try {
		const { data: repoData } = await octokit.repos.get({ owner, repo });
		if (repoData.homepage && isValidUrl(repoData.homepage)) {
			secureLog.info(`Found site URL from repo homepage: ${repoData.homepage}`);
			return { url: repoData.homepage, source: 'homepage' };
		}
	} catch (err) {
		secureLog.warn('Failed to fetch repo data for homepage');
	}

	// 2. Try package.json homepage field
	try {
		const packageJsonUrl = await tryPackageJson(octokit, owner, repo);
		if (packageJsonUrl) {
			secureLog.info(`Found site URL from package.json: ${packageJsonUrl}`);
			return { url: packageJsonUrl, source: 'package_json' };
		}
	} catch (err) {
		secureLog.warn('Failed to fetch package.json');
	}

	// 3. Try README patterns
	try {
		const readmeUrl = await tryReadme(octokit, owner, repo);
		if (readmeUrl) {
			secureLog.info(`Found site URL from README: ${readmeUrl}`);
			return { url: readmeUrl, source: 'readme' };
		}
	} catch (err) {
		secureLog.warn('Failed to fetch README');
	}

	secureLog.info('No site URL found for repository');
	return { url: null, source: null };
}

async function tryPackageJson(
	octokit: Octokit,
	owner: string,
	repo: string
): Promise<string | null> {
	try {
		const { data } = await octokit.repos.getContent({
			owner,
			repo,
			path: 'package.json'
		});

		if ('content' in data && data.content) {
			const content = atob(data.content);
			const packageJson = JSON.parse(content);
			if (packageJson.homepage && isValidUrl(packageJson.homepage)) {
				return packageJson.homepage;
			}
		}
	} catch {
		// package.json doesn't exist or can't be parsed
	}
	return null;
}

async function tryReadme(
	octokit: Octokit,
	owner: string,
	repo: string
): Promise<string | null> {
	const readmeFiles = ['README.md', 'readme.md', 'README', 'readme'];

	for (const filename of readmeFiles) {
		try {
			const { data } = await octokit.repos.getContent({
				owner,
				repo,
				path: filename
			});

			if ('content' in data && data.content) {
				const content = atob(data.content);
				const url = extractUrlFromReadme(content);
				if (url) {
					return url;
				}
			}
		} catch {
			// This README file doesn't exist, try next
		}
	}
	return null;
}

function extractUrlFromReadme(content: string): string | null {
	// Common patterns for site URLs in READMEs
	const patterns = [
		// "Live at: https://example.com" or "Live: https://example.com"
		/live\s*(?:at)?:?\s*(https?:\/\/[^\s\)>\]]+)/i,
		// "Demo: https://example.com" or "Demo at: https://example.com"
		/demo\s*(?:at)?:?\s*(https?:\/\/[^\s\)>\]]+)/i,
		// "Website: https://example.com"
		/website:?\s*(https?:\/\/[^\s\)>\]]+)/i,
		// "Homepage: https://example.com"
		/homepage:?\s*(https?:\/\/[^\s\)>\]]+)/i,
		// "🌐 https://example.com" or similar emoji patterns
		/[🌐🔗🚀]\s*(https?:\/\/[^\s\)>\]]+)/,
		// "[Live Demo](https://example.com)"
		/\[(?:live\s*)?demo\]\((https?:\/\/[^\)]+)\)/i,
		// "[Website](https://example.com)"
		/\[website\]\((https?:\/\/[^\)]+)\)/i,
		// "[Visit](https://example.com)"
		/\[visit(?:\s+site)?\]\((https?:\/\/[^\)]+)\)/i
	];

	for (const pattern of patterns) {
		const match = content.match(pattern);
		if (match && match[1] && isValidUrl(match[1])) {
			// Clean up the URL (remove trailing punctuation, etc.)
			const cleanUrl = match[1].replace(/[.,;!?\s]+$/, '');
			return cleanUrl;
		}
	}

	return null;
}

function isValidUrl(urlString: string): boolean {
	try {
		const url = new URL(urlString);
		// Only accept http/https URLs
		if (!['http:', 'https:'].includes(url.protocol)) {
			return false;
		}
		// Exclude common non-site URLs
		const excludedHosts = [
			'github.com',
			'gitlab.com',
			'bitbucket.org',
			'npmjs.com',
			'npm.js.org',
			'pypi.org',
			'crates.io',
			'rubygems.org',
			'packagist.org'
		];
		if (excludedHosts.some(host => url.hostname.includes(host))) {
			return false;
		}
		return true;
	} catch {
		return false;
	}
}
