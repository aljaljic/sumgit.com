<script lang="ts">
	import type { Milestone, Repository } from '$lib/database.types';
	import WidgetBranding from './WidgetBranding.svelte';

	interface Props {
		repository: Repository;
		milestones: Milestone[];
		showBranding?: boolean;
		showDate?: boolean;
		showCommit?: boolean;
		textColor?: string;
		textSize?: string;
	}

	let { repository, milestones, showBranding = true, showDate = true, showCommit = true, textColor, textSize }: Props = $props();

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
		<div class="header-label">
			<svg width="40" height="40" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
				<circle fill="#76C2AF" cx="32" cy="32" r="32"/>
				<path fill="#231F20" opacity="0.2" d="M24.6,41.9c0.4,1.1-0.2,2-1.4,2h-2c-1.1,0-2.3-0.9-2.6-2l-3.2-10c-0.4-1.1,0.2-2,1.4-2h2c1.1,0,2.3,0.9,2.6,2L24.6,41.9z"/>
				<path fill="#231F20" opacity="0.2" d="M24,46.9c0.4,1.1-0.2,2-1.4,2h-2c-1.1,0-2-0.1-2.4-1.2l-3.5-10.8c-0.4-1.1,0.2-2,1.4-2h2c1.1,0,2.3,0.9,2.6,2L24,46.9z"/>
				<path fill="#C75C5C" d="M24.6,39.9c0.4,1.1-0.2,2-1.4,2h-2c-1.1,0-2.3-0.9-2.6-2l-3.2-10c-0.4-1.1,0.2-2,1.4-2h2c1.1,0,2.3,0.9,2.6,2L24.6,39.9z"/>
				<path fill="#4F5D73" d="M24,44.9c0.4,1.1-0.2,2-1.4,2h-2c-1.1,0-2.2-0.5-2.6-1.6l-3.3-10.4c-0.4-1.1,0.2-2,1.4-2h2c1.1,0,2.3,0.9,2.6,2L24,44.9z"/>
				<path fill="#231F20" opacity="0.2" d="M48,28.9V18.5c0-0.8-0.7-1.5-1.5-1.5c-0.8,0-1.5,0.7-1.5,1.5v1c-2.8,2.5-6.3,6.4-16,6.4H18h-2h-2c-1.1,0-2,0.9-2,2c-1.1,0-2,0.9-2,2v6c0,1.1,0.9,2,2,2c0,1.1,0.9,2,2,2h1h1h2h11c9.7,0,13.2,3.9,16,6.4v1.1c0,0.8,0.7,1.5,1.5,1.5c0.8,0,1.5-0.7,1.5-1.5V36.9c1.1,0,2-0.9,2-2v-4C50,29.8,49.1,28.9,48,28.9z"/>
				<path fill="#E0E0D1" d="M50,32.9c0,1.1-0.9,2-2,2h-8c-1.1,0-2-0.9-2-2v-4c0-1.1,0.9-2,2-2h8c1.1,0,2,0.9,2,2V32.9z"/>
				<path fill="#4F5D73" d="M22,33.9c0,1.1-0.9,2-2,2h-8c-1.1,0-2-0.9-2-2v-6c0-1.1,0.9-2,2-2h8c1.1,0,2,0.9,2,2V33.9z"/>
				<path fill="#FFFFFF" d="M46.1,16.6c-3,2.3-6.1,7.3-17.1,7.3H16l-1,14h14c11,0,14.1,5,17.1,7.3V16.6z"/>
				<path fill="#C75C5C" d="M18,37.9c0,0-0.9,0-2,0h-2c-1.1,0-2-0.9-2-2v-10c0-1.1,0.9-2,2-2h2c1.1,0,2,0,2,0V37.9z"/>
				<path fill="#4F5D73" d="M48,45.4c0,0.8-0.7,1.5-1.5,1.5l0,0c-0.8,0-1.5-0.7-1.5-1.5V16.5c0-0.8,0.7-1.5,1.5-1.5l0,0c0.8,0,1.5,0.7,1.5,1.5V45.4z"/>
			</svg>
			<span>Latest Changes</span>
		</div>
	</div>

	{#if milestones.length === 0}
		<div class="empty">No milestones to display</div>
	{:else}
		<div class="milestone-list">
			{#each milestones.slice(0, 10) as milestone}
				<div class="milestone-card">
					<div class="milestone-content">
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
							{:else}
								<span class="type-badge" style="background: rgba(107, 114, 128, 0.1); color: #6b7280;">Other</span>
							{/if}
							<p class="milestone-text" style={`${textColor ? `color: ${textColor};` : ''}${textSize ? `font-size: ${textSize};` : ''}`}>{milestone.x_post_suggestion || milestone.title}</p>
						</div>
						{#if showDate || showCommit}
							<div class="milestone-meta">
								{#if showDate}
									<span class="date">{formatDate(milestone.milestone_date)}</span>
								{/if}
								{#if showCommit && milestone.commit_sha}
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

	.header-label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 16px;
		font-weight: 600;
		color: var(--widget-fg);
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
		padding: 14px;
		background: var(--widget-card-bg);
		border-radius: 10px;
		border: 1px solid var(--widget-border);
		border-left: 3px solid var(--widget-accent);
		transition: transform 0.2s ease, box-shadow 0.2s ease, border-left-color 0.2s ease;
	}

	.milestone-content {
		display: flex;
		flex-direction: column;
		gap: 8px;
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
		align-items: center;
		gap: 12px;
		font-size: 12px;
		color: var(--widget-muted);
	}

	.date {
		font-weight: 500;
		white-space: nowrap;
	}

	.commit {
		font-family: monospace;
		font-size: inherit;
		color: inherit;
	}

	.more {
		margin: 12px 0 0 0;
		text-align: center;
		font-size: 12px;
		color: var(--widget-muted);
		font-weight: 500;
	}
</style>
