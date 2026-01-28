<script lang="ts">
	import type { Milestone, Repository } from '$lib/database.types';
	import WidgetBranding from './WidgetBranding.svelte';
	import IconChangelog from '$lib/components/icons/IconChangelog.svelte';
	import { milestoneTypeToCategory, type ChangelogCategory } from '$lib/types/changelog';

	interface Props {
		repository: Repository;
		milestones: Milestone[];
		showBranding?: boolean;
	}

	let { repository, milestones, showBranding = true }: Props = $props();

	// Group milestones by category
	let groupedMilestones = $derived.by(() => {
		const groups: Record<ChangelogCategory, Milestone[]> = {
			Added: [],
			Fixed: [],
			Changed: [],
			Documentation: [],
			Other: []
		};

		for (const milestone of milestones.slice(0, 10)) {
			const category = milestoneTypeToCategory(milestone.milestone_type);
			groups[category].push(milestone);
		}

		return groups;
	});

	// Get the latest date for the version
	let latestDate = $derived.by(() => {
		if (milestones.length === 0) return null;
		return new Date(milestones[0].milestone_date);
	});

	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});
	}

	function getCategoryColor(category: ChangelogCategory): string {
		switch (category) {
			case 'Added':
				return 'category-added';
			case 'Fixed':
				return 'category-fixed';
			case 'Changed':
				return 'category-changed';
			case 'Documentation':
				return 'category-docs';
			default:
				return 'category-other';
		}
	}
</script>

<div class="widget-changelog">
	<div class="header">
		<div class="header-label">
			<IconChangelog />
			<span>Changelog</span>
		</div>
	</div>

	{#if milestones.length === 0}
		<div class="empty">No changes to display</div>
	{:else}
		<!-- Version header -->
		<div class="version-header">
			<span class="version-badge">Latest</span>
			{#if latestDate}
				<span class="version-date">{formatDate(latestDate)}</span>
			{/if}
		</div>

		<!-- Changelog entries by category -->
		<div class="changelog-entries">
			{#each ['Added', 'Fixed', 'Changed', 'Documentation', 'Other'] as category}
				{@const entries = groupedMilestones[category as ChangelogCategory]}
				{#if entries.length > 0}
					<div class="category-section">
						<h3 class="category-header {getCategoryColor(category as ChangelogCategory)}">
							{category}
						</h3>
						<ul class="entry-list">
							{#each entries.slice(0, 3) as milestone}
								<li class="entry-item">
									<span class="entry-bullet">•</span>
									<span class="entry-text">{milestone.title}</span>
								</li>
							{/each}
							{#if entries.length > 3}
								<li class="entry-item entry-more">
									<span class="entry-bullet">+</span>
									<span class="entry-text">{entries.length - 3} more</span>
								</li>
							{/if}
						</ul>
					</div>
				{/if}
			{/each}
		</div>

		<!-- Stats -->
		<div class="stats-row">
			<div class="stat">
				<span class="stat-value">{milestones.length}</span>
				<span class="stat-label">Total Changes</span>
			</div>
		</div>
	{/if}

	<WidgetBranding show={showBranding} />
</div>

<style>
	.widget-changelog {
		width: 100%;
	}

	.header {
		margin-bottom: 16px;
	}

	.header-label {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-size: 18px;
		font-weight: 600;
		color: var(--widget-fg);
	}

	.empty {
		text-align: center;
		padding: 24px;
		color: var(--widget-muted);
	}

	.version-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin-bottom: 16px;
	}

	.version-badge {
		background: var(--widget-accent-light);
		color: var(--widget-accent);
		font-size: 12px;
		font-weight: 600;
		padding: 4px 12px;
		border-radius: 9999px;
	}

	.version-date {
		font-size: 13px;
		color: var(--widget-muted);
	}

	.changelog-entries {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: 16px;
	}

	.category-section {
		background: var(--widget-card-bg);
		border: 1px solid var(--widget-border);
		border-radius: 10px;
		padding: 12px;
	}

	.category-header {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0 0 8px 0;
		padding: 2px 8px;
		border-radius: 4px;
		display: inline-block;
	}

	.category-added {
		background: rgba(16, 185, 129, 0.1);
		color: #10b981;
	}

	.category-fixed {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
	}

	.category-changed {
		background: rgba(59, 130, 246, 0.1);
		color: #3b82f6;
	}

	.category-docs {
		background: rgba(168, 85, 247, 0.1);
		color: #a855f7;
	}

	.category-other {
		background: rgba(249, 115, 22, 0.1);
		color: #f97316;
	}

	.entry-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.entry-item {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		font-size: 12px;
		color: var(--widget-fg);
		padding: 2px 0;
	}

	.entry-bullet {
		color: var(--widget-muted);
		flex-shrink: 0;
	}

	.entry-text {
		line-height: 1.4;
	}

	.entry-more {
		color: var(--widget-muted);
		font-style: italic;
	}

	.stats-row {
		display: flex;
		justify-content: center;
		margin-top: 8px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.stat-value {
		font-size: 20px;
		font-weight: 700;
		color: var(--widget-accent);
	}

	.stat-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--widget-muted);
	}
</style>
