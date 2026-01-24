<script lang="ts">
	import type { Milestone, Repository } from '$lib/database.types';
	import WidgetBranding from './WidgetBranding.svelte';

	interface Props {
		repository: Repository;
		milestones: Milestone[];
		showBranding?: boolean;
	}

	let { repository, milestones, showBranding = true }: Props = $props();

	// Group milestones by year and month
	type GroupedMilestones = Record<string, Record<string, Milestone[]>>;

	let groupedMilestones = $derived.by(() => {
		const grouped: GroupedMilestones = {};

		for (const milestone of milestones) {
			const date = new Date(milestone.milestone_date);
			const year = date.getFullYear().toString();
			const month = date.toLocaleString('en-US', { month: 'long' });

			if (!grouped[year]) grouped[year] = {};
			if (!grouped[year][month]) grouped[year][month] = [];
			grouped[year][month].push(milestone);
		}

		return grouped;
	});

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}

	function monthOrder(month: string): number {
		const months = [
			'January',
			'February',
			'March',
			'April',
			'May',
			'June',
			'July',
			'August',
			'September',
			'October',
			'November',
			'December'
		];
		return months.indexOf(month);
	}
</script>

<div class="widget-timeline">
	<div class="header">
		<h2 class="title">
			{repository.repo_owner}/{repository.repo_name}
		</h2>
		<span class="subtitle">Timeline</span>
	</div>

	{#if milestones.length === 0}
		<div class="empty">No milestones to display</div>
	{:else}
		<div class="timeline">
			{#each Object.entries(groupedMilestones)
				.sort((a, b) => Number(b[0]) - Number(a[0]))
				.slice(0, 3) as [year, months]}
				<div class="year-section">
					<div class="year-header">{year}</div>
					{#each Object.entries(months)
						.sort((a, b) => monthOrder(b[0]) - monthOrder(a[0]))
						.slice(0, 4) as [month, items]}
						<div class="month-section">
							<span class="month-badge">{month}</span>
							<div class="month-items">
								{#each items.slice(0, 5) as milestone}
									<div class="timeline-item">
										<div class="timeline-dot"></div>
										<div class="timeline-content">
											<span class="item-date">{formatDate(milestone.milestone_date)}</span>
											<p class="item-text">{milestone.x_post_suggestion || milestone.title}</p>
										</div>
									</div>
								{/each}
								{#if items.length > 5}
									<div class="more-items">+{items.length - 5} more</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	{/if}

	<WidgetBranding show={showBranding} />
</div>

<style>
	.widget-timeline {
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

	.timeline {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.year-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.year-header {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--widget-accent);
	}

	.month-section {
		margin-left: 8px;
	}

	.month-badge {
		display: inline-block;
		padding: 3px 10px;
		font-size: 11px;
		font-weight: 600;
		background: var(--widget-accent-light);
		border: 1px solid var(--widget-accent);
		border-radius: 6px;
		color: var(--widget-accent);
		margin-bottom: 10px;
	}

	.month-items {
		border-left: 2px solid var(--widget-accent);
		padding-left: 16px;
		margin-left: 4px;
	}

	.timeline-item {
		position: relative;
		padding-bottom: 14px;
		cursor: default;
	}

	.timeline-dot {
		position: absolute;
		left: -21px;
		top: 4px;
		width: 10px;
		height: 10px;
		background: var(--widget-bg);
		border: 2px solid var(--widget-accent);
		border-radius: 50%;
		transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
	}

	.timeline-item:hover .timeline-dot {
		background: var(--widget-accent);
		box-shadow: 0 0 0 4px var(--widget-accent-light);
		transform: scale(1.2);
	}

	@media (prefers-reduced-motion: reduce) {
		.timeline-dot {
			transition: none;
		}
		.timeline-item:hover .timeline-dot {
			transform: none;
		}
	}

	.timeline-content {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.item-date {
		font-size: 11px;
		color: var(--widget-muted);
		font-weight: 500;
	}

	.item-text {
		margin: 0;
		font-size: 13px;
		line-height: 1.4;
		color: var(--widget-fg);
	}

	.more-items {
		font-size: 11px;
		color: var(--widget-muted);
		padding-top: 4px;
		font-weight: 500;
	}
</style>
