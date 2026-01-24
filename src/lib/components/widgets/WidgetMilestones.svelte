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
						{#if milestone.milestone_type === 'feature'}
							<span class="type-badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">Feature</span>
						{:else if milestone.milestone_type === 'bugfix'}
							<span class="type-badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">Bugfix</span>
						{:else if milestone.milestone_type === 'refactor'}
							<span class="type-badge" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">Refactor</span>
						{:else if milestone.milestone_type === 'docs'}
							<span class="type-badge" style="background: rgba(168, 85, 247, 0.1); color: #a855f7;">Docs</span>
						{:else if milestone.milestone_type === 'config'}
							<span class="type-badge" style="background: rgba(249, 115, 22, 0.1); color: #f97316;">Config</span>
						{:else if milestone.milestone_type === 'release'}
							<span class="type-badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">Release</span>
						{/if}
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

	.type-badge {
		font-size: 11px;
		font-weight: 500;
		padding: 2px 8px;
		border-radius: 4px;
		flex-shrink: 0;
		white-space: nowrap;
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
