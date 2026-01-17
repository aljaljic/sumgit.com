<script lang="ts">
	const milestones = [
		{ emoji: '🚀', title: 'Launched v2.0 to production', repo: 'acme/webapp', date: 'Jan 15' },
		{ emoji: '⚡', title: '3x faster API response times', repo: 'startup/backend', date: 'Jan 12' },
		{ emoji: '🔐', title: 'Added OAuth2 authentication', repo: 'dev/auth-service', date: 'Jan 10' },
		{ emoji: '🎉', title: 'Hit 10,000 GitHub stars', repo: 'oss/framework', date: 'Jan 8' },
		{ emoji: '🐛', title: 'Fixed critical memory leak', repo: 'corp/api', date: 'Jan 5' },
		{ emoji: '✨', title: 'Dark mode support shipped', repo: 'indie/app', date: 'Jan 3' },
		{ emoji: '📱', title: 'Mobile-first redesign complete', repo: 'team/frontend', date: 'Dec 28' },
		{ emoji: '🔄', title: 'Migrated to SvelteKit 2.0', repo: 'solo/project', date: 'Dec 22' },
	];
</script>

<div class="relative mt-16 w-full overflow-hidden">
	<!-- Gradient overlays for fade effect -->
	<div class="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-background to-transparent"></div>
	<div class="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-background to-transparent"></div>

	<div class="marquee-container flex">
		<div class="marquee-content flex gap-4">
			{#each milestones as milestone}
				<div class="flex-shrink-0 rounded-lg border border-border/40 bg-card/30 px-4 py-3 backdrop-blur-sm">
					<div class="flex items-center gap-3">
						<span class="text-xl">{milestone.emoji}</span>
						<div>
							<p class="whitespace-nowrap text-sm font-medium text-foreground">{milestone.title}</p>
							<p class="whitespace-nowrap text-xs text-muted-foreground">
								{milestone.repo} · {milestone.date}
							</p>
						</div>
					</div>
				</div>
			{/each}
		</div>
		<!-- Duplicate for seamless loop -->
		<div class="marquee-content flex gap-4" aria-hidden="true">
			{#each milestones as milestone}
				<div class="flex-shrink-0 rounded-lg border border-border/40 bg-card/30 px-4 py-3 backdrop-blur-sm">
					<div class="flex items-center gap-3">
						<span class="text-xl">{milestone.emoji}</span>
						<div>
							<p class="whitespace-nowrap text-sm font-medium text-foreground">{milestone.title}</p>
							<p class="whitespace-nowrap text-xs text-muted-foreground">
								{milestone.repo} · {milestone.date}
							</p>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.marquee-container {
		animation: marquee 40s linear infinite;
	}

	.marquee-content {
		padding-right: 1rem;
	}

	@keyframes marquee {
		0% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(-50%);
		}
	}

	/* Pause on hover */
	.marquee-container:hover {
		animation-play-state: paused;
	}
</style>
