<script lang="ts">
	import type { Milestone, Repository } from '$lib/database.types';
	import WidgetBranding from './WidgetBranding.svelte';

	interface Props {
		repository: Repository;
		milestones: Milestone[];
		showBranding?: boolean;
	}

	let { repository, milestones, showBranding = true }: Props = $props();

	// Calculate stats from milestones
	let stats = $derived.by(() => {
		if (milestones.length === 0) {
			return {
				totalMilestones: 0,
				firstDate: null,
				lastDate: null,
				activeMonths: 0
			};
		}

		const dates = milestones.map((m) => new Date(m.milestone_date)).sort((a, b) => a.getTime() - b.getTime());
		const firstDate = dates[0];
		const lastDate = dates[dates.length - 1];

		// Calculate active months
		const uniqueMonths = new Set(
			dates.map((d) => `${d.getFullYear()}-${d.getMonth()}`)
		);

		return {
			totalMilestones: milestones.length,
			firstDate,
			lastDate,
			activeMonths: uniqueMonths.size
		};
	});

	// Get top milestones (first 3)
	let topMilestones = $derived(milestones.slice(0, 3));

	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', {
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<div class="widget-recap">
	<div class="header">
		<h2 class="title">
			{repository.repo_owner}/{repository.repo_name}
		</h2>
		<span class="subtitle">Project Recap</span>
	</div>

	{#if milestones.length === 0}
		<div class="empty">No milestones to display</div>
	{:else}
		<!-- Hero Stat -->
		<div class="hero-stat">
			<span class="hero-number">{stats.totalMilestones}</span>
			<span class="pulse-dot"></span>
		</div>
		<span class="hero-label">TOTAL MILESTONES</span>

		<!-- Stats Grid -->
		<div class="stats-grid">
			<div class="stat-card">
				<span class="stat-value">{stats.activeMonths}</span>
				<span class="stat-label">Active Months</span>
			</div>
			{#if stats.firstDate && stats.lastDate}
				<div class="stat-card">
					<span class="stat-value stat-range">
						{formatDate(stats.firstDate)} - {formatDate(stats.lastDate)}
					</span>
					<span class="stat-label">Activity Period</span>
				</div>
			{/if}
		</div>

		<!-- Top Milestones -->
		{#if topMilestones.length > 0}
			<div class="top-milestones">
				<h3 class="section-header">Recent Highlights</h3>
				<div class="milestone-list">
					{#each topMilestones as milestone, index}
						<div class="milestone-item">
							<span class="milestone-number">{index + 1}</span>
							<p class="milestone-text">{milestone.x_post_suggestion || milestone.title}</p>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}

	<WidgetBranding show={showBranding} />
</div>

<style>
	.widget-recap {
		width: 100%;
	}

	.header {
		margin-bottom: 20px;
		text-align: center;
	}

	.title {
		margin: 0 0 4px 0;
		font-size: 18px;
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

	/* Hero Stat */
	.hero-stat {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin-bottom: 4px;
	}

	.hero-number {
		font-size: 56px;
		font-weight: 700;
		color: var(--widget-fg);
		line-height: 1;
	}

	.pulse-dot {
		width: 10px;
		height: 10px;
		background: var(--widget-accent);
		border-radius: 50%;
		animation: pulse 2s ease-in-out infinite;
		box-shadow: 0 0 8px var(--widget-accent);
	}

	@media (prefers-reduced-motion: reduce) {
		.pulse-dot {
			animation: none;
		}
	}

	.hero-label {
		display: block;
		text-align: center;
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--widget-muted);
		margin-bottom: 20px;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
		margin-bottom: 20px;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 14px 10px;
		background: var(--widget-card-bg);
		border: 1px solid var(--widget-border);
		border-radius: 10px;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.stat-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--widget-shadow-hover);
	}

	@media (prefers-reduced-motion: reduce) {
		.stat-card {
			transition: none;
		}
		.stat-card:hover {
			transform: none;
		}
	}

	.stat-value {
		font-size: 24px;
		font-weight: 700;
		color: var(--widget-accent);
	}

	.stat-value.stat-range {
		font-size: 13px;
		font-weight: 600;
	}

	.stat-label {
		font-size: 11px;
		color: var(--widget-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.top-milestones {
		margin-top: 8px;
	}

	.section-header {
		margin: 0 0 12px 0;
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--widget-muted);
	}

	.milestone-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.milestone-item {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 12px;
		background: var(--widget-card-bg);
		border: 1px solid var(--widget-border);
		border-radius: 10px;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.milestone-item:hover {
		transform: translateY(-1px);
		box-shadow: var(--widget-shadow-hover);
	}

	@media (prefers-reduced-motion: reduce) {
		.milestone-item {
			transition: none;
		}
		.milestone-item:hover {
			transform: none;
		}
	}

	.milestone-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: var(--widget-accent-light);
		color: var(--widget-accent);
		font-size: 12px;
		font-weight: 600;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.milestone-text {
		margin: 0;
		font-size: 13px;
		line-height: 1.4;
		color: var(--widget-fg);
	}
</style>
