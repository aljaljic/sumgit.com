export type ChangelogGrouping = 'version' | 'date' | 'month';

export type ChangelogCategory = 'Added' | 'Fixed' | 'Changed' | 'Documentation' | 'Other';

export interface ChangelogEntry {
	title: string;
	description: string | null;
	commit_sha: string | null;
	date: string;
	category: ChangelogCategory;
}

export interface ChangelogVersion {
	version: string;
	date: string;
	entries: Record<ChangelogCategory, ChangelogEntry[]>;
}

export interface Changelog {
	versions: ChangelogVersion[];
	suggested_next_version: string;
	generated_at: string;
}

export type ExportFormat = 'markdown' | 'github-release' | 'clipboard';

export interface GenerateChangelogRequest {
	repository_id: string;
	grouping: ChangelogGrouping;
}

export interface GenerateChangelogResponse {
	success: boolean;
	changelog?: Changelog;
	markdown?: string;
	error?: string;
	credits_remaining?: number;
}

// Maps milestone_type to changelog category
export function milestoneTypeToCategory(milestoneType: string | null): ChangelogCategory {
	switch (milestoneType) {
		case 'feature':
			return 'Added';
		case 'bugfix':
			return 'Fixed';
		case 'refactor':
			return 'Changed';
		case 'docs':
			return 'Documentation';
		case 'config':
		case 'other':
		default:
			return 'Other';
	}
}

// Generate markdown in Keep a Changelog format
export function generateMarkdown(changelog: Changelog, repoUrl: string): string {
	const lines: string[] = [
		'# Changelog',
		'',
		'All notable changes to this project will be documented in this file.',
		'',
		'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),',
		'and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).',
		''
	];

	for (const version of changelog.versions) {
		lines.push(`## [${version.version}] - ${version.date}`);
		lines.push('');

		const categories: ChangelogCategory[] = ['Added', 'Fixed', 'Changed', 'Documentation', 'Other'];

		for (const category of categories) {
			const entries = version.entries[category];
			if (entries && entries.length > 0) {
				lines.push(`### ${category}`);
				lines.push('');

				for (const entry of entries) {
					let line = `- ${entry.title}`;
					if (entry.commit_sha) {
						line += ` ([${entry.commit_sha.slice(0, 7)}](${repoUrl}/commit/${entry.commit_sha}))`;
					}
					lines.push(line);
				}
				lines.push('');
			}
		}
	}

	return lines.join('\n');
}

// Generate GitHub release format
export function generateGitHubRelease(changelog: Changelog, repoUrl: string): string {
	if (changelog.versions.length === 0) {
		return '';
	}

	const version = changelog.versions[0];
	const lines: string[] = ['## What\'s Changed', ''];

	const categoryLabels: Record<ChangelogCategory, string> = {
		'Added': 'New Features',
		'Fixed': 'Bug Fixes',
		'Changed': 'Changes',
		'Documentation': 'Documentation',
		'Other': 'Other'
	};

	const categories: ChangelogCategory[] = ['Added', 'Fixed', 'Changed', 'Documentation', 'Other'];

	for (const category of categories) {
		const entries = version.entries[category];
		if (entries && entries.length > 0) {
			lines.push(`### ${categoryLabels[category]}`);
			lines.push('');

			for (const entry of entries) {
				lines.push(`- ${entry.title}`);
			}
			lines.push('');
		}
	}

	lines.push(`**Full Changelog**: ${repoUrl}/commits`);

	return lines.join('\n');
}
