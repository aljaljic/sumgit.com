<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import {
		ArrowLeft,
		FileText,
		Loader2,
		Copy,
		Check,
		Share2,
		GitCommit,
		Calendar,
		Trophy,
		Clock,
		Code,
		Users
	} from '@lucide/svelte';
	import logo from '$lib/assets/logo.png';
	import PurchaseCreditsDialog from '$lib/components/PurchaseCreditsDialog.svelte';
	import type { RepoRecap } from '$lib/types/recap';

	let { data } = $props();

	let isGenerating = $state(false);
	let recap = $state<RepoRecap | null>(null);
	let errorMessage = $state<string | null>(null);
	let showPurchaseDialog = $state(false);
	let copied = $state(false);

	async function generateRecap() {
		if (isGenerating) return;

		isGenerating = true;
		errorMessage = null;

		try {
			const response = await fetch('/api/recap', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					repository_id: data.repository.id
				})
			});

			if (response.status === 402) {
				showPurchaseDialog = true;
				return;
			}

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to generate recap');
			}

			const result = await response.json();
			recap = result.recap;
		} catch (err) {
			console.error('Recap generation error:', err);
			errorMessage = err instanceof Error ? err.message : 'Failed to generate recap';
		} finally {
			isGenerating = false;
		}
	}

	function formatClipboardText(): string {
		if (!recap) return '';

		const topMilestonesText = recap.summary.top_milestones
			.map((m) => `- ${m.title}`)
			.join('\n');

		const languagesText = recap.stats.languages.length > 0
			? recap.stats.languages.slice(0, 5).map((l) => l.name).join(', ')
			: '';

		return `${recap.summary.headline}

${recap.summary.narrative}

Stats:
- ${recap.stats.total_commits.toLocaleString()} commits
- ~${recap.stats.total_lines_of_code.toLocaleString()} lines of code
- ${recap.stats.total_milestones} milestones
- ${recap.stats.active_months} months of building
- ${recap.stats.contributors} contributor${recap.stats.contributors === 1 ? '' : 's'}
${languagesText ? `- Languages: ${languagesText}` : ''}

Top milestones:
${topMilestonesText}

${recap.summary.vibe_check}

Built with sumgit.com`;
	}

	async function copyToClipboard() {
		const text = formatClipboardText();
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}

	function shareToX() {
		if (!recap) return;

		const text = `${recap.summary.vibe_check}\n\nBuilt with sumgit.com`;
		const encodedText = encodeURIComponent(text);
		const url = `https://twitter.com/intent/tweet?text=${encodedText}`;
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatNumber(num: number): string {
		if (num >= 1000000) {
			return (num / 1000000).toFixed(1) + 'M';
		}
		if (num >= 1000) {
			return (num / 1000).toFixed(1) + 'K';
		}
		return num.toLocaleString();
	}
</script>

<div class="flex min-h-screen flex-col bg-background">
	<!-- Header -->
	<header class="border-b border-border/40 px-4 py-3 sm:px-6 sm:py-4">
		<div class="mx-auto flex max-w-4xl items-center justify-between">
			<div class="flex items-center gap-2 sm:gap-4">
				<Button href="/project/{data.repository.id}" variant="ghost" size="sm" class="shrink-0">
					<ArrowLeft class="h-4 w-4" />
					<span class="ml-2 hidden sm:inline">Back</span>
				</Button>
				<Separator orientation="vertical" class="hidden h-6 sm:block" />
				<div class="flex min-w-0 items-center gap-2">
					<img src={logo} alt="sumgit" class="h-6 w-6 shrink-0 rounded-md sm:h-7 sm:w-7" />
					<span class="truncate text-sm font-semibold sm:text-base"
						>{data.repository.repo_owner}/{data.repository.repo_name}</span
					>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<FileText class="h-4 w-4 text-purple-500" />
				<span class="text-sm font-medium">Recap</span>
			</div>
		</div>
	</header>

	<!-- Main content -->
	<main class="flex flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
		<div class="mx-auto flex w-full max-w-4xl flex-1 flex-col">
			{#if data.milestones.length === 0}
				<!-- No milestones state -->
				<div class="flex flex-1 flex-col items-center justify-center py-20 text-center">
					<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/50">
						<FileText class="h-8 w-8 text-muted-foreground" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">No milestones yet</h3>
					<p class="mb-6 max-w-sm text-muted-foreground">
						Analyze your repository first to generate milestones, then come back to create your
						recap
					</p>
					<Button href="/project/{data.repository.id}" variant="outline" class="gap-2">
						<ArrowLeft class="h-4 w-4" />
						Go to Project
					</Button>
				</div>
			{:else if isGenerating}
				<!-- Loading state -->
				<div class="flex flex-1 flex-col items-center justify-center py-20 text-center">
					<Loader2 class="mb-4 h-12 w-12 animate-spin text-purple-500" />
					<h3 class="mb-2 text-lg font-semibold">Generating your recap...</h3>
					<p class="text-muted-foreground">Crunching the numbers and crafting your story</p>
				</div>
			{:else if errorMessage}
				<!-- Error state -->
				<div class="flex flex-1 flex-col items-center justify-center py-20 text-center">
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
					>
						<FileText class="h-8 w-8 text-destructive" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">Something went wrong</h3>
					<p class="mb-6 max-w-sm text-muted-foreground">{errorMessage}</p>
					<Button onclick={generateRecap} class="gap-2">
						<FileText class="h-4 w-4" />
						Try Again
					</Button>
				</div>
			{:else if recap}
				<!-- Recap view -->
				<div class="space-y-6">
					<!-- Headline -->
					<div class="text-center">
						<h1 class="text-2xl font-bold sm:text-3xl">{recap.summary.headline}</h1>
					</div>

					<!-- Stats cards row -->
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
						<Card class="border-border/40">
							<CardContent class="flex flex-col items-center p-3">
								<GitCommit class="mb-1 h-5 w-5 text-purple-500" />
								<span class="text-xl font-bold">{formatNumber(recap.stats.total_commits)}</span>
								<span class="text-xs text-muted-foreground">commits</span>
							</CardContent>
						</Card>
						<Card class="border-border/40">
							<CardContent class="flex flex-col items-center p-3">
								<Code class="mb-1 h-5 w-5 text-green-500" />
								<span class="text-xl font-bold">{formatNumber(recap.stats.total_lines_of_code)}</span>
								<span class="text-xs text-muted-foreground">lines of code</span>
							</CardContent>
						</Card>
						<Card class="border-border/40">
							<CardContent class="flex flex-col items-center p-3">
								<Trophy class="mb-1 h-5 w-5 text-amber-500" />
								<span class="text-xl font-bold">{recap.stats.total_milestones}</span>
								<span class="text-xs text-muted-foreground">milestones</span>
							</CardContent>
						</Card>
						<Card class="border-border/40">
							<CardContent class="flex flex-col items-center p-3">
								<Clock class="mb-1 h-5 w-5 text-blue-500" />
								<span class="text-xl font-bold">{recap.stats.active_months}</span>
								<span class="text-xs text-muted-foreground">months</span>
							</CardContent>
						</Card>
						<Card class="border-border/40">
							<CardContent class="flex flex-col items-center p-3">
								<Users class="mb-1 h-5 w-5 text-orange-500" />
								<span class="text-xl font-bold">{recap.stats.contributors}</span>
								<span class="text-xs text-muted-foreground">contributor{recap.stats.contributors === 1 ? '' : 's'}</span>
							</CardContent>
						</Card>
						<Card class="border-border/40">
							<CardContent class="flex flex-col items-center p-3">
								<FileText class="mb-1 h-5 w-5 text-cyan-500" />
								<span class="text-xl font-bold">{recap.stats.languages.length}</span>
								<span class="text-xs text-muted-foreground">language{recap.stats.languages.length === 1 ? '' : 's'}</span>
							</CardContent>
						</Card>
					</div>

					<!-- Languages -->
					{#if recap.stats.languages.length > 0}
						<Card class="border-border/40">
							<CardContent class="p-4">
								<h3 class="mb-3 text-sm font-medium text-muted-foreground">Languages</h3>
								<!-- Language bar -->
								<div class="mb-3 flex h-2 overflow-hidden rounded-full">
									{#each recap.stats.languages as lang}
										<div
											class="h-full"
											style="width: {lang.percentage}%; background-color: {lang.color};"
											title="{lang.name}: {lang.percentage}%"
										></div>
									{/each}
								</div>
								<!-- Language legend -->
								<div class="flex flex-wrap gap-x-4 gap-y-1">
									{#each recap.stats.languages as lang}
										<div class="flex items-center gap-1.5 text-sm">
											<span
												class="h-2.5 w-2.5 rounded-full"
												style="background-color: {lang.color};"
											></span>
											<span class="text-foreground">{lang.name}</span>
											<span class="text-muted-foreground">{lang.percentage}%</span>
										</div>
									{/each}
								</div>
							</CardContent>
						</Card>
					{/if}

					<!-- Narrative -->
					<Card class="border-border/40">
						<CardContent class="p-6">
							<p class="whitespace-pre-line leading-relaxed text-foreground/90">
								{recap.summary.narrative}
							</p>
						</CardContent>
					</Card>

					<!-- Top Milestones -->
					<div>
						<h2 class="mb-4 text-lg font-semibold">Top Milestones</h2>
						<div class="space-y-3">
							{#each recap.summary.top_milestones as milestone, index}
								<Card class="border-border/40">
									<CardContent class="flex items-start gap-4 p-4">
										<div
											class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-sm font-bold text-purple-500"
										>
											{index + 1}
										</div>
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2">
												<span class="font-medium">{milestone.title}</span>
											</div>
											<div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
												<Calendar class="h-3 w-3" />
												<span>{formatDate(milestone.date)}</span>
											</div>
											{#if milestone.description}
												<p class="mt-2 text-sm text-muted-foreground">{milestone.description}</p>
											{/if}
										</div>
									</CardContent>
								</Card>
							{/each}
						</div>
					</div>

					<!-- Vibe Check -->
					<Card class="border-purple-500/30 bg-purple-500/5">
						<CardContent class="p-6 text-center">
							<p class="text-lg font-medium italic text-foreground">"{recap.summary.vibe_check}"</p>
						</CardContent>
					</Card>

					<!-- Action buttons -->
					<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
						<Button onclick={copyToClipboard} variant="outline" class="gap-2">
							{#if copied}
								<Check class="h-4 w-4 text-green-500" />
								Copied!
							{:else}
								<Copy class="h-4 w-4" />
								Copy Recap
							{/if}
						</Button>
						<Button onclick={shareToX} variant="outline" class="gap-2">
							<Share2 class="h-4 w-4" />
							Share on X
						</Button>
					</div>
				</div>
			{:else}
				<!-- Generate recap state -->
				<div class="flex flex-1 flex-col items-center justify-center py-20 text-center">
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10"
					>
						<FileText class="h-8 w-8 text-purple-500" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">Generate Your Recap</h3>
					<p class="mb-6 max-w-sm text-muted-foreground">
						Create an all-time summary of your {data.milestones.length} milestone{data.milestones
							.length === 1
							? ''
							: 's'} with stats, an AI-generated narrative, and shareable quotes
					</p>
					<Button onclick={generateRecap} class="gap-2">
						{#if isGenerating}
							<Loader2 class="h-4 w-4 animate-spin" />
							Generating...
						{:else}
							<FileText class="h-4 w-4" />
							Generate Recap
						{/if}
					</Button>
				</div>
			{/if}
		</div>
	</main>
</div>

<PurchaseCreditsDialog
	bind:open={showPurchaseDialog}
	onOpenChange={(open) => (showPurchaseDialog = open)}
/>
