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
					<div class="milestone-main">
						<span class="type-icon">
							{#if milestone.milestone_type === 'feature'}&#x2728;{:else if milestone.milestone_type === 'bugfix'}&#x1F41B;{:else if milestone.milestone_type === 'release'}&#x1F680;{:else}&#x1F4DD;{/if}
						</span>
						<p class="milestone-text">{milestone.x_post_suggestion || milestone.title}</p>
					</div>
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
		margin-bottom: 20px;
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
		gap: 10px;
	}

	.milestone-card {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
		padding: 14px;
		background: var(--widget-card-bg);
		border-radius: 10px;
		border: 1px solid var(--widget-border);
		border-left: 3px solid var(--widget-accent);
		transition: transform 0.2s ease, box-shadow 0.2s ease, border-left-color 0.2s ease;
	}

	.milestone-card:hover {
		transform: translateY(-1px);
		box-shadow: var(--widget-shadow-hover);
	}

	@media (prefers-reduced-motion: reduce) {
		.milestone-card {
			transition: none;
		}
		.milestone-card:hover {
			transform: none;
		}
	}

	.milestone-main {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		flex: 1;
		min-width: 0;
	}

	.type-icon {
		font-size: 16px;
		flex-shrink: 0;
		line-height: 1.4;
	}

	.milestone-text {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--widget-fg);
	}

	.milestone-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		font-size: 12px;
		color: var(--widget-muted);
		flex-shrink: 0;
	}

	.date {
		color: var(--widget-muted);
		font-weight: 500;
		white-space: nowrap;
	}

	.commit {
		font-family: monospace;
		font-size: 11px;
		color: var(--widget-accent);
	}

	.more {
		margin: 12px 0 0 0;
		text-align: center;
		font-size: 12px;
		color: var(--widget-muted);
		font-weight: 500;
	}
</style>
