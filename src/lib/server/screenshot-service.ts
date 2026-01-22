import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { Database, Repository, Milestone } from '$lib/database.types';
import type { MilestoneInput } from '$lib/openai';
import type { Octokit } from '@octokit/rest';
import { extractSiteUrl } from './site-url-extractor';
import { determineScreenshotTarget, type ScreenshotTarget } from './screenshot-agent';
import { captureScreenshot } from './browserless';
import { secureLog } from './logger';

const supabaseAdmin = createClient<Database>(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);

const SCREENSHOT_BUCKET = 'milestone-screenshots';
const MAX_SCREENSHOTS_PER_ANALYSIS = 2; // Limit to stay under Cloudflare subrequest limits

export interface ProcessedMilestone {
	milestoneIndex: number;
	screenshotUrl: string | null;
	screenshotTarget: ScreenshotTarget | null;
}

/**
 * Process feature milestones for screenshot capture
 * Returns screenshot URLs for milestones that had successful captures
 */
export async function processFeatureScreenshots(
	octokit: Octokit,
	repository: Repository,
	milestones: MilestoneInput[]
): Promise<ProcessedMilestone[]> {
	const results: ProcessedMilestone[] = [];

	// Filter to only feature milestones
	const featureMilestones = milestones
		.map((m, index) => ({ milestone: m, index }))
		.filter(({ milestone }) => milestone.milestone_type === 'feature');

	if (featureMilestones.length === 0) {
		secureLog.info('No feature milestones found, skipping screenshot capture');
		return results;
	}

	secureLog.info(`Found ${featureMilestones.length} feature milestones for potential screenshot capture`);

	// Get or extract site URL
	let siteUrl = repository.site_url;
	let siteUrlSource = repository.site_url_source;

	if (!siteUrl) {
		const extracted = await extractSiteUrl(octokit, repository.repo_owner, repository.repo_name);
		siteUrl = extracted.url;
		siteUrlSource = extracted.source;

		// Cache the site URL in the repository
		if (siteUrl) {
			await supabaseAdmin
				.from('repositories')
				.update({
					site_url: siteUrl,
					site_url_source: siteUrlSource
				})
				.eq('id', repository.id);
		}
	}

	if (!siteUrl) {
		secureLog.info('No site URL found for repository, skipping screenshot capture');
		return results;
	}

	secureLog.info(`Using site URL: ${siteUrl} (source: ${siteUrlSource})`);

	// Process only the first N feature milestones to stay under subrequest limits
	const milestonesToProcess = featureMilestones.slice(0, MAX_SCREENSHOTS_PER_ANALYSIS);

	for (const { milestone, index } of milestonesToProcess) {
		try {
			// Determine screenshot target using AI
			const target = await determineScreenshotTarget(
				milestone.title,
				milestone.description,
				siteUrl,
				repository.repo_name
			);

			if (!target.should_screenshot) {
				secureLog.info(`Skipping screenshot for "${milestone.title}": ${target.reason}`);
				results.push({
					milestoneIndex: index,
					screenshotUrl: null,
					screenshotTarget: target
				});
				continue;
			}

			// Capture screenshot
			const screenshotResult = await captureScreenshot({
				url: siteUrl,
				target
			});

			if (!screenshotResult.success || !screenshotResult.imageData) {
				secureLog.warn(`Screenshot capture failed for "${milestone.title}": ${screenshotResult.error}`);
				results.push({
					milestoneIndex: index,
					screenshotUrl: null,
					screenshotTarget: target
				});
				continue;
			}

			// Upload to Supabase Storage
			const filename = generateFilename(repository.id, milestone.commit_sha || 'unknown', index);
			const uploadResult = await uploadScreenshot(screenshotResult.imageData, filename);

			if (!uploadResult.success) {
				secureLog.error(`Failed to upload screenshot: ${uploadResult.error}`);
				results.push({
					milestoneIndex: index,
					screenshotUrl: null,
					screenshotTarget: target
				});
				continue;
			}

			secureLog.info(`Screenshot uploaded for "${milestone.title}": ${uploadResult.url}`);
			results.push({
				milestoneIndex: index,
				screenshotUrl: uploadResult.url || null,
				screenshotTarget: target
			});
		} catch (error) {
			secureLog.error(`Error processing screenshot for milestone "${milestone.title}":`, error);
			results.push({
				milestoneIndex: index,
				screenshotUrl: null,
				screenshotTarget: null
			});
		}
	}

	return results;
}

/**
 * Update milestones with screenshot URLs after insertion
 */
export async function updateMilestonesWithScreenshots(
	milestoneIds: string[],
	processedScreenshots: ProcessedMilestone[]
): Promise<void> {
	for (const processed of processedScreenshots) {
		if (processed.screenshotUrl && milestoneIds[processed.milestoneIndex]) {
			const milestoneId = milestoneIds[processed.milestoneIndex];

			await supabaseAdmin
				.from('milestones')
				.update({
					screenshot_url: processed.screenshotUrl,
					screenshot_target: processed.screenshotTarget as unknown as Database['public']['Tables']['milestones']['Update']['screenshot_target']
				})
				.eq('id', milestoneId);
		}
	}
}

function generateFilename(repoId: string, commitSha: string, index: number): string {
	const timestamp = Date.now();
	const shortSha = commitSha.slice(0, 7);
	return `${repoId}/${timestamp}-${shortSha}-${index}.png`;
}

async function uploadScreenshot(
	imageData: Uint8Array,
	filename: string
): Promise<{ success: boolean; url?: string; error?: string }> {
	try {
		const { data, error } = await supabaseAdmin.storage
			.from(SCREENSHOT_BUCKET)
			.upload(filename, imageData, {
				contentType: 'image/png',
				upsert: true
			});

		if (error) {
			return { success: false, error: error.message };
		}

		// Get public URL
		const { data: urlData } = supabaseAdmin.storage
			.from(SCREENSHOT_BUCKET)
			.getPublicUrl(filename);

		return {
			success: true,
			url: urlData.publicUrl
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return { success: false, error: errorMessage };
	}
}
