import { run } from '@openai/agents';
import type { BrowserWorker } from '@cloudflare/puppeteer';
import {
	commitAnalyzerAgent,
	formatCommitsForAnalysis,
	type CommitInput,
	type CommitAnalysisOutput
} from './commit-analyzer';
import {
	milestoneFinderAgent,
	formatAnalyzedCommitsForMilestoneFinder,
	type MilestoneFinderOutput
} from './milestone-finder';
import { createScreenshotAgent, generateScreenshotPrompt } from './screenshot-agent';
import {
	createAuthenticatedScreenshotAgent,
	generateAuthenticatedScreenshotPrompt
} from './authenticated-screenshot-agent';
import { CloudflareComputer } from '../cloudflare-computer';
import { secureLog } from '../logger';

/**
 * Authentication credentials for authenticated screenshots
 */
export interface AuthenticationCredentials {
	loginUrl: string;
	username: string;
	password: string;
}

/**
 * Input for the analysis workflow
 */
export interface WorkflowInput {
	commits: CommitInput[];
	siteUrl?: string;
	browserBinding?: BrowserWorker;
	maxScreenshots?: number;
	authentication?: AuthenticationCredentials;
}

/**
 * Result milestone with optional screenshot
 */
export interface WorkflowMilestone {
	title: string;
	description: string;
	commitSha: string;
	commitDate: string;
	milestoneType: string;
	xPostSuggestion: string;
	screenshotBase64?: string;
}

/**
 * Result of the analysis workflow
 */
export interface WorkflowResult {
	milestones: WorkflowMilestone[];
	analysisDetails: {
		totalCommits: number;
		analyzedCommits: number;
		milestonesFound: number;
		screenshotsCaptured: number;
	};
}

/**
 * Run the multi-agent analysis workflow
 *
 * Flow: Commits → Commit Analyzer Agent → Milestone Finder Agent → Screenshot Agent (for features)
 */
export async function runAnalysisWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
	const { commits, siteUrl, browserBinding, maxScreenshots = 2, authentication } = input;

	secureLog.info(`Starting analysis workflow with ${commits.length} commits`);

	// Step 1: Analyze commits with the Commit Analyzer Agent
	secureLog.info('Step 1: Analyzing commits...');
	const formattedCommits = formatCommitsForAnalysis(commits);

	let analysisResult: CommitAnalysisOutput;
	try {
		const result = await run(
			commitAnalyzerAgent,
			`Analyze the following ${commits.length} commits:\n\n${formattedCommits}`
		);
		analysisResult = result.finalOutput as CommitAnalysisOutput;
		secureLog.info(`Commit analysis complete: ${analysisResult.commits.length} commits analyzed`);
	} catch (error) {
		secureLog.error('Commit analysis failed:', error);
		throw new Error(
			`Commit analysis failed: ${error instanceof Error ? error.message : String(error)}`
		);
	}

	// Merge original commit data with analysis (to preserve dates)
	const commitsWithDates = analysisResult.commits.map((analyzed) => {
		const original = commits.find((c) => c.sha === analyzed.sha);
		return {
			...analyzed,
			date: original?.date,
			message: original?.message
		};
	});

	// Step 2: Find milestones with the Milestone Finder Agent
	secureLog.info('Step 2: Finding milestones...');
	const formattedAnalysis = formatAnalyzedCommitsForMilestoneFinder(commitsWithDates);

	let milestoneResult: MilestoneFinderOutput;
	try {
		const result = await run(
			milestoneFinderAgent,
			`Identify significant milestones from these analyzed commits:\n\n${formattedAnalysis}`
		);
		milestoneResult = result.finalOutput as MilestoneFinderOutput;
		secureLog.info(`Milestone finding complete: ${milestoneResult.milestones.length} milestones found`);
	} catch (error) {
		secureLog.error('Milestone finding failed:', error);
		throw new Error(
			`Milestone finding failed: ${error instanceof Error ? error.message : String(error)}`
		);
	}

	// Step 3: Capture screenshots for feature milestones (if browser binding available)
	const milestonesWithScreenshots: WorkflowMilestone[] = [];
	let screenshotsCaptured = 0;

	// Filter milestones that should get screenshots
	const screenshotCandidates = milestoneResult.milestones.filter(
		(m) => m.shouldScreenshot && m.milestoneType === 'feature'
	);

	// Only attempt screenshots if we have a site URL and browser binding
	const canCaptureScreenshots = siteUrl && browserBinding && screenshotCandidates.length > 0;

	if (canCaptureScreenshots) {
		const isAuthenticated = !!authentication;
		secureLog.info(
			`Step 3: Capturing ${isAuthenticated ? 'authenticated ' : ''}screenshots for ${Math.min(screenshotCandidates.length, maxScreenshots)} milestones...`
		);

		const milestonesToScreenshot = screenshotCandidates.slice(0, maxScreenshots);

		for (const milestone of milestonesToScreenshot) {
			const computer = new CloudflareComputer(browserBinding);
			let screenshotBase64: string | undefined;

			try {
				// Initialize browser with the appropriate URL
				const initialUrl = authentication ? authentication.loginUrl : siteUrl;
				await computer.initialize(initialUrl);

				let screenshotAgent;
				let screenshotPrompt;

				if (authentication) {
					// Use authenticated screenshot agent
					screenshotAgent = createAuthenticatedScreenshotAgent(computer, authentication);
					screenshotPrompt = generateAuthenticatedScreenshotPrompt(
						milestone.title,
						milestone.description
					);
				} else {
					// Use regular screenshot agent
					screenshotAgent = createScreenshotAgent(computer);
					screenshotPrompt = generateScreenshotPrompt(
						milestone.title,
						milestone.description,
						milestone.milestoneType
					);
				}

				// Run the screenshot agent
				await run(screenshotAgent, screenshotPrompt);

				// Capture final screenshot
				screenshotBase64 = await computer.screenshot();
				screenshotsCaptured++;

				secureLog.info(`Screenshot captured for: ${milestone.title}`);
			} catch (error) {
				secureLog.warn(`Screenshot failed for "${milestone.title}":`, error);
				// Continue without screenshot
			} finally {
				await computer.cleanup();
			}

			milestonesWithScreenshots.push({
				title: milestone.title,
				description: milestone.description,
				commitSha: milestone.commitSha,
				commitDate: milestone.commitDate,
				milestoneType: milestone.milestoneType,
				xPostSuggestion: milestone.xPostSuggestion,
				screenshotBase64
			});
		}

		// Add remaining milestones (those not selected for screenshots)
		const remainingMilestones = milestoneResult.milestones.filter(
			(m) => !milestonesToScreenshot.includes(m)
		);
		for (const milestone of remainingMilestones) {
			milestonesWithScreenshots.push({
				title: milestone.title,
				description: milestone.description,
				commitSha: milestone.commitSha,
				commitDate: milestone.commitDate,
				milestoneType: milestone.milestoneType,
				xPostSuggestion: milestone.xPostSuggestion,
				screenshotBase64: undefined
			});
		}
	} else {
		// No screenshots - just convert milestones
		if (!siteUrl) {
			secureLog.info('Step 3: Skipping screenshots (no site URL available)');
		} else if (!browserBinding) {
			secureLog.info('Step 3: Skipping screenshots (no browser binding available)');
		} else {
			secureLog.info('Step 3: Skipping screenshots (no feature milestones for screenshots)');
		}

		for (const milestone of milestoneResult.milestones) {
			milestonesWithScreenshots.push({
				title: milestone.title,
				description: milestone.description,
				commitSha: milestone.commitSha,
				commitDate: milestone.commitDate,
				milestoneType: milestone.milestoneType,
				xPostSuggestion: milestone.xPostSuggestion,
				screenshotBase64: undefined
			});
		}
	}

	secureLog.info(
		`Workflow complete: ${milestonesWithScreenshots.length} milestones, ${screenshotsCaptured} screenshots`
	);

	return {
		milestones: milestonesWithScreenshots,
		analysisDetails: {
			totalCommits: commits.length,
			analyzedCommits: analysisResult.commits.length,
			milestonesFound: milestoneResult.milestones.length,
			screenshotsCaptured
		}
	};
}

/**
 * Simple workflow without screenshots (for use when browser binding is unavailable)
 */
export async function runAnalysisWorkflowSimple(
	commits: CommitInput[]
): Promise<WorkflowResult> {
	return runAnalysisWorkflow({
		commits,
		siteUrl: undefined,
		browserBinding: undefined
	});
}
