<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import {
		ArrowLeft,
		ExternalLink,
		GitCommit,
		Clock,
		Loader2,
		History
	} from '@lucide/svelte';
	import logo from '$lib/assets/logo.png';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let isAnalyzing = $state(false);

	async function analyzeTimeline() {
		if (isAnalyzing) return;

		isAnalyzing = true;
		try {
			const response = await fetch('/api/analyze-timeline', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ repository_id: data.repository.id })
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to analyze timeline');
			}

			// Refresh page data to show new milestones
			await invalidateAll();
		} catch (err) {
			console.error('Timeline analysis error:', err);
			alert(err instanceof Error ? err.message : 'Failed to analyze timeline');
		} finally {
			isAnalyzing = false;
		}
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	// Helper function for month ordering (newest first)
	function monthOrder(month: string): number {
		const months = ['January', 'February', 'March', 'April', 'May', 'June',
		                'July', 'August', 'September', 'October', 'November', 'December'];
		return months.indexOf(month);
	}

	// Helper function to count milestones in a month's days
	function countMilestones(days: Record<string, unknown[]>): number {
		return Object.values(days).reduce((sum, dayMilestones) => sum + dayMilestones.length, 0);
	}
</script>

<div class="flex min-h-screen flex-col">
	<!-- Header -->
	<header class="border-b border-border/40 px-6 py-4">
		<div class="mx-auto flex max-w-4xl items-center justify-between">
			<div class="flex items-center gap-4">
				<Button href="/project/{data.repository.id}" variant="ghost" size="sm" class="gap-2">
					<ArrowLeft class="h-4 w-4" />
					Back
				</Button>
				<Separator orientation="vertical" class="h-6" />
				<div class="flex items-center gap-2">
					<img src={logo} alt="sumgit" class="h-7 w-7 rounded-md" />
					<span class="font-semibold">{data.repository.repo_owner}/{data.repository.repo_name}</span>
				</div>
			</div>
			<div class="flex items-center gap-3">
				<div class="flex items-center gap-2">
					<Clock class="h-4 w-4 text-emerald-500" />
					<span class="text-sm font-medium">Timeline</span>
				</div>
				<Button
					onclick={analyzeTimeline}
					disabled={isAnalyzing}
					size="sm"
					class="gap-2"
				>
					{#if isAnalyzing}
						<Loader2 class="h-4 w-4 animate-spin" />
						Analyzing...
					{:else}
						<History class="h-4 w-4" />
						Analyze Full History
					{/if}
				</Button>
			</div>
		</div>
	</header>

	<!-- Main content -->
	<main class="flex-1 px-6 py-8">
		<div class="mx-auto max-w-4xl">
			<!-- Repository info -->
			<div class="mb-8">
				<div class="flex items-center gap-3">
					<h1 class="text-2xl font-bold">{data.repository.repo_name} Timeline</h1>
					<a
						href={data.repository.github_repo_url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-muted-foreground transition-colors hover:text-foreground"
					>
						<ExternalLink class="h-4 w-4" />
					</a>
				</div>
				<p class="mt-1 text-sm text-muted-foreground">
					{data.milestones.length} milestone{data.milestones.length === 1 ? '' : 's'} total
				</p>
			</div>

			<!-- Empty state -->
			{#if data.milestones.length === 0}
				<div class="flex flex-col items-center justify-center py-20 text-center">
					<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/50">
						<Clock class="h-8 w-8 text-muted-foreground" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">No milestones yet</h3>
					<p class="mb-6 max-w-sm text-muted-foreground">
						Analyze your repository first to generate milestones
					</p>
					<Button href="/project/{data.repository.id}" variant="outline" class="gap-2">
						<ArrowLeft class="h-4 w-4" />
						Go to Project
					</Button>
				</div>
			{:else}
				<!-- Timeline View: Grouped by Year/Month -->
				<div class="space-y-8">
					{#each Object.entries(data.groupedMilestones).sort((a, b) => Number(b[0]) - Number(a[0])) as [year, months]}
						<div>
							<!-- Year Header -->
							<h2 class="text-xl font-bold mb-4 text-emerald-500">{year}</h2>

							{#each Object.entries(months).sort((a, b) => monthOrder(b[0]) - monthOrder(a[0])) as [month, days]}
								<div class="mb-6">
									<!-- Month Header with summary -->
									<div class="flex items-center gap-3 mb-3">
										<Badge variant="secondary">{month}</Badge>
										<span class="text-sm text-muted-foreground">
											{countMilestones(days)} milestone{countMilestones(days) === 1 ? '' : 's'}
										</span>
									</div>

									<!-- Milestones in this month as bullet list -->
									<div class="relative pl-6 border-l-2 border-emerald-500/30">
										{#each Object.entries(days).sort((a, b) => Number(b[0]) - Number(a[0])).flatMap(([_, m]) => m) as milestone}
											<div class="relative mb-3 pl-4">
												<!-- Bullet point -->
												<div
													class="absolute left-[-9px] top-1.5 h-3 w-3 rounded-full border-2 border-emerald-500 bg-background"
												></div>

												<!-- Milestone content -->
												<div class="flex items-start gap-3">
													<Badge variant="outline" class="text-xs shrink-0">
														{formatDate(milestone.milestone_date)}
													</Badge>
													<div class="flex-1">
														<p class="text-sm leading-relaxed">
															{milestone.x_post_suggestion || milestone.title}
														</p>
														{#if milestone.commit_sha}
															<a
																href="{data.repository.github_repo_url}/commit/{milestone.commit_sha}"
																target="_blank"
																rel="noopener noreferrer"
																class="inline-flex items-center gap-1 text-xs text-muted-foreground mt-1 transition-colors hover:text-foreground"
															>
																<GitCommit class="h-3 w-3" />
																{milestone.commit_sha.slice(0, 7)}
															</a>
														{/if}
													</div>
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</main>
</div>
