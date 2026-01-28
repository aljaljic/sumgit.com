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
		History,
		Code
	} from '@lucide/svelte';
	import logo from '$lib/assets/logo.png';
	import IconTimeline from '$lib/components/icons/IconTimeline.svelte';
	import { invalidateAll } from '$app/navigation';
	import PurchaseCreditsDialog from '$lib/components/PurchaseCreditsDialog.svelte';
	import ShareEmbedDialog from '$lib/components/ShareEmbedDialog.svelte';
	import { CREDIT_COSTS } from '$lib/credits';

	let { data } = $props();

	let isAnalyzing = $state(false);
	let showPurchaseDialog = $state(false);
	let showEmbedDialog = $state(false);

	async function analyzeTimeline() {
		if (isAnalyzing) return;

		isAnalyzing = true;
		try {
			const response = await fetch('/api/analyze-timeline', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ repository_id: data.repository.id })
			});

			if (response.status === 402) {
				// Insufficient credits
				const errorData = await response.json().catch(() => ({}));
				showPurchaseDialog = true;
				return;
			}

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
	<header class="border-b border-border/40 px-4 py-3 sm:px-6 sm:py-4">
		<div class="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center gap-2 sm:gap-4">
				<Button href="/project/{data.repository.id}" variant="ghost" size="sm" class="gap-2 px-2 sm:px-3">
					<ArrowLeft class="h-4 w-4" />
					<span class="hidden sm:inline">Back</span>
				</Button>
				<Separator orientation="vertical" class="hidden h-6 sm:block" />
				<img src={logo} alt="SumGit" class="h-6 w-6 shrink-0 rounded-md sm:h-7 sm:w-7" />
			</div>
			<div class="flex items-center justify-between gap-3 sm:justify-end">
				<div class="flex items-center gap-2">
					<Clock class="h-4 w-4 text-emerald-500" />
					<span class="text-sm font-medium">Timeline</span>
				</div>
				{#if data.milestones.length > 0}
					<Button
						onclick={() => (showEmbedDialog = true)}
						variant="outline"
						size="sm"
						class="gap-2"
					>
						<Code class="h-4 w-4" />
						<span class="hidden sm:inline">Embed</span>
					</Button>
				{/if}
				<Button
					onclick={analyzeTimeline}
					disabled={isAnalyzing}
					size="sm"
					class="gap-2"
				>
					{#if isAnalyzing}
						<Loader2 class="h-4 w-4 animate-spin" />
						<span class="hidden xs:inline">Analyzing...</span>
						<span class="xs:hidden">...</span>
					{:else}
						<History class="h-4 w-4" />
						<span class="hidden sm:inline">Analyze Full History</span>
						<span class="sm:hidden">Analyze</span>
					{/if}
				</Button>
			</div>
		</div>
	</header>

	<!-- Main content -->
	<main class="flex-1 px-4 py-6 sm:px-6 sm:py-8">
		<div class="mx-auto max-w-4xl">
			<!-- Repository info -->
			<div class="mb-6 sm:mb-8">
				<div class="flex items-center gap-3">
					<h1 class="text-xl font-bold sm:text-2xl">{data.repository.repo_name} Timeline</h1>
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
				<div class="mt-3">
					<IconTimeline size={40} />
				</div>
			</div>

			<!-- Empty state -->
			{#if data.milestones.length === 0}
				<div class="flex flex-col items-center justify-center py-12 text-center sm:py-20">
					<div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary/50 sm:h-16 sm:w-16">
						<Clock class="h-7 w-7 text-muted-foreground sm:h-8 sm:w-8" />
					</div>
					<h3 class="mb-2 text-base font-semibold sm:text-lg">No milestones yet</h3>
					<p class="mb-6 max-w-sm px-4 text-sm text-muted-foreground sm:px-0 sm:text-base">
						Analyze your repository first to generate milestones
					</p>
					<Button href="/project/{data.repository.id}" variant="outline" class="gap-2">
						<ArrowLeft class="h-4 w-4" />
						Go to Project
					</Button>
				</div>
			{:else}
				<!-- Timeline View: Grouped by Year/Month -->
				<div class="space-y-6 sm:space-y-8">
					{#each Object.entries(data.groupedMilestones).sort((a, b) => Number(b[0]) - Number(a[0])) as [year, months]}
						<div>
							<!-- Year Header -->
							<h2 class="text-lg font-bold mb-3 text-emerald-500 sm:text-xl sm:mb-4">{year}</h2>

							{#each Object.entries(months).sort((a, b) => monthOrder(b[0]) - monthOrder(a[0])) as [month, days]}
								<div class="mb-5 sm:mb-6">
									<!-- Month Header with summary -->
									<div class="flex items-center gap-2 mb-3 sm:gap-3">
										<Badge variant="secondary">{month}</Badge>
										<span class="text-xs text-muted-foreground sm:text-sm">
											{countMilestones(days)} milestone{countMilestones(days) === 1 ? '' : 's'}
										</span>
									</div>

									<!-- Milestones in this month as bullet list -->
									<div class="relative pl-4 border-l-2 border-emerald-500/30 sm:pl-6">
										{#each Object.entries(days).sort((a, b) => Number(b[0]) - Number(a[0])).flatMap(([_, m]) => m) as milestone}
											<div class="relative mb-4 pl-4 sm:mb-3">
												<!-- Bullet point -->
												<div
													class="absolute left-[-9px] top-1.5 h-3 w-3 rounded-full border-2 border-emerald-500 bg-background"
												></div>

												<!-- Milestone content -->
												<div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
													<Badge variant="outline" class="w-fit text-xs shrink-0">
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

<PurchaseCreditsDialog
	bind:open={showPurchaseDialog}
	onOpenChange={(open) => (showPurchaseDialog = open)}
/>

<ShareEmbedDialog
	bind:open={showEmbedDialog}
	onOpenChange={(open) => (showEmbedDialog = open)}
	repositoryId={data.repository.id}
	contentType="timeline"
/>
