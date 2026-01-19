export interface LanguageStat {
	name: string;
	bytes: number;
	percentage: number;
	color: string;
}

export interface RecapStats {
	total_commits: number;
	total_milestones: number;
	first_commit_date: string;
	last_commit_date: string;
	active_months: number;
	// Code stats
	languages: LanguageStat[];
	total_lines_of_code: number;
	contributors: number;
}

export interface RecapSummary {
	headline: string; // Short punchy headline (max 100 chars)
	narrative: string; // 2-3 paragraph AI narrative
	top_milestones: Array<{ title: string; date: string; description: string }>;
	vibe_check: string; // One-liner for sharing
}

export interface RepoRecap {
	repository_id: string;
	repo_name: string;
	repo_owner: string;
	stats: RecapStats;
	summary: RecapSummary;
	generated_at: string;
}

export interface GenerateRecapResponse {
	success: boolean;
	recap?: RepoRecap;
	credits_remaining?: number;
	error?: string;
}
