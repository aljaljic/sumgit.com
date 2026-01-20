<script lang="ts">
	import type { Milestone, Repository } from '$lib/database.types';
	import WidgetBranding from './WidgetBranding.svelte';

	interface Props {
		repository: Repository;
		milestones: Milestone[];
		showBranding?: boolean;
	}

	let { repository, milestones, showBranding = true }: Props = $props();

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="widget-milestones">
	<div class="header">
		<h2 class="title">
			{repository.repo_owner}/{repository.repo_name}
		</h2>
		<span class="subtitle">{milestones.length} milestone{milestones.length === 1 ? '' : 's'}</span>
	</div>

	{#if milestones.length === 0}
		<div class="empty">No milestones to display</div>
	{:else}
		<div class="milestone-list">
			{#each milestones.slice(0, 10) as milestone}
				<div class="milestone-card">
					<p class="milestone-text">{milestone.x_post_suggestion || milestone.title}</p>
					<div class="milestone-meta">
						<span class="date">{formatDate(milestone.milestone_date)}</span>
						{#if milestone.commit_sha}
							<a
								href="{repository.github_repo_url}/commit/{milestone.commit_sha}"
								target="_blank"
								rel="noopener noreferrer"
								class="commit"
							>
								{milestone.commit_sha.slice(0, 7)}
							</a>
						{/if}
					</div>
				</div>
			{/each}
		</div>
		{#if milestones.length > 10}
			<p class="more">+{milestones.length - 10} more milestones</p>
		{/if}
	{/if}

	<WidgetBranding show={showBranding} />
</div>

<style>
	.widget-milestones {
		width: 100%;
	}

	.header {
		margin-bottom: 16px;
	}

	.title {
		margin: 0 0 4px 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--widget-fg);
	}

	.subtitle {
		font-size: 12px;
		color: var(--widget-muted);
	}

	.empty {
		text-align: center;
		padding: 24px;
		color: var(--widget-muted);
	}

	.milestone-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.milestone-card {
		padding: 12px;
		background: var(--widget-card-bg);
		border-radius: 6px;
		border: 1px solid var(--widget-border);
	}

	.milestone-text {
		margin: 0 0 8px 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--widget-fg);
	}

	.milestone-meta {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 12px;
		color: var(--widget-muted);
	}

	.date {
		color: var(--widget-muted);
	}

	.commit {
		font-family: monospace;
		color: var(--widget-accent);
	}

	.more {
		margin: 12px 0 0 0;
		text-align: center;
		font-size: 12px;
		color: var(--widget-muted);
	}
</style>
