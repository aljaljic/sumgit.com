<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import {
		ArrowLeft,
		Loader2,
		RefreshCw,
		Copy,
		Check,
		ExternalLink,
		Calendar,
		GitCommit,
		Trash2,
		Share2,
		Clock,
		BookOpen,
		FileText,
		Code
	} from '@lucide/svelte';
	import { invalidateAll, goto } from '$app/navigation';
	import logo from '$lib/assets/logo.png';
	import PurchaseCreditsDialog from '$lib/components/PurchaseCreditsDialog.svelte';
	import ShareEmbedDialog from '$lib/components/ShareEmbedDialog.svelte';
	import { CREDIT_COSTS } from '$lib/credits';

	let { data } = $props();
	let isAnalyzing = $state(false);
	let copiedId = $state<string | null>(null);
	let isDeleting = $state(false);
	let showPurchaseDialog = $state(false);
	let showEmbedDialog = $state(false);
	let insufficientCreditsMessage = $state<string | null>(null);

	async function analyzeRepository() {
		isAnalyzing = true;
		insufficientCreditsMessage = null;
		try {
			const response = await fetch('/api/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ repository_id: data.repository.id })
			});

			if (response.ok) {
				await invalidateAll();
			} else if (response.status === 402) {
				// Insufficient credits
				const errorData = await response.json();
				insufficientCreditsMessage = `You need ${CREDIT_COSTS.quick_analyze} credit(s) to run Quick Analysis. You have ${errorData.credits_available || 0} credits.`;
				showPurchaseDialog = true;
			} else {
				const error = await response.json();
				alert(error.message || 'Analysis failed');
			}
		} catch (error) {
			console.error('Analysis error:', error);
			alert('Failed to analyze repository');
		} finally {
			isAnalyzing = false;
		}
	}

	async function copyToClipboard(text: string, id: string) {
		await navigator.clipboard.writeText(text);
		copiedId = id;
		setTimeout(() => {
			copiedId = null;
		}, 2000);
	}

	function shareToX(text: string) {
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

	async function deleteRepository() {
		if (
			!confirm('Are you sure you want to remove this repository? All milestones will be deleted.')
		) {
			return;
		}

		isDeleting = true;
		try {
			const response = await fetch('/api/repos', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: data.repository.id })
			});

			if (response.ok) {
				goto('/dashboard');
			}
		} catch (error) {
			console.error('Delete error:', error);
		} finally {
			isDeleting = false;
		}
	}

</script>

<div class="flex min-h-screen flex-col">
	<!-- Header -->
	<header class="border-b border-border/40 px-4 py-3 sm:px-6 sm:py-4">
		<div class="mx-auto max-w-4xl space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
			<!-- Left side: Back + repo name -->
			<div class="flex items-center gap-2 sm:gap-4 min-w-0">
				<Button href="/dashboard" variant="ghost" size="sm" class="shrink-0">
					<ArrowLeft class="h-4 w-4" />
					<span class="hidden sm:inline ml-2">Back</span>
				</Button>
				<Separator orientation="vertical" class="h-6 hidden sm:block" />
				<div class="flex items-center gap-2 min-w-0">
					<img src={logo} alt="SumGit" class="h-6 w-6 sm:h-7 sm:w-7 rounded-md shrink-0" />
					<span class="font-semibold truncate text-sm sm:text-base">{data.repository.repo_owner}/{data.repository.repo_name}</span>
				</div>
			</div>
			<!-- Right side: Actions -->
			<div class="flex items-center gap-2 justify-end">
				{#if data.milestones.length > 0}
					<Button
						href="/project/{data.repository.id}/timeline"
						variant="outline"
						size="sm"
						class="gap-2"
					>
						<Clock class="h-4 w-4" />
						<span class="hidden sm:inline">Timeline</span>
					</Button>
					<Button
						href="/project/{data.repository.id}/story"
						variant="outline"
						size="sm"
						class="gap-2"
					>
						<BookOpen class="h-4 w-4" />
						<span class="hidden sm:inline">Story</span>
					</Button>
					<Button
						href="/project/{data.repository.id}/recap"
						variant="outline"
						size="sm"
						class="gap-2"
					>
						<FileText class="h-4 w-4" />
						<span class="hidden sm:inline">Recap</span>
					</Button>
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
					onclick={analyzeRepository}
					disabled={isAnalyzing}
					variant="outline"
					size="sm"
					class="gap-2"
				>
					{#if isAnalyzing}
						<Loader2 class="h-4 w-4 animate-spin" />
						<span class="hidden sm:inline">Analyzing...</span>
					{:else}
						<RefreshCw class="h-4 w-4" />
						<span class="hidden sm:inline">{data.milestones.length > 0 ? 'Re-analyze' : 'Analyze'}</span>
					{/if}
				</Button>
				<Button
					onclick={deleteRepository}
					disabled={isDeleting}
					variant="ghost"
					size="sm"
					class="text-destructive hover:text-destructive"
				>
					<Trash2 class="h-4 w-4" />
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
					<h1 class="text-2xl font-bold">{data.repository.repo_name}</h1>
					<a
						href={data.repository.github_repo_url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-muted-foreground transition-colors hover:text-foreground"
					>
						<ExternalLink class="h-4 w-4" />
					</a>
				</div>
				{#if data.repository.last_analyzed_at}
					<p class="mt-1 text-sm text-muted-foreground">
						Last analyzed: {new Date(data.repository.last_analyzed_at).toLocaleString()}
					</p>
				{/if}
				{#if data.milestones.length > 0}
					<div class="flex items-center gap-2 mt-6 text-base font-semibold text-foreground">
						<svg width="48" height="48" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
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
				{/if}
			</div>

			<!-- Empty state -->
			{#if data.milestones.length === 0}
				<div class="flex flex-col items-center justify-center py-20 text-center">
					<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/50">
						<Calendar class="h-8 w-8 text-muted-foreground" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">No milestones yet</h3>
					<p class="mb-6 max-w-sm text-muted-foreground">
						Click "Analyze" to scan your last 100 commits and extract significant milestones
					</p>
					<Button onclick={analyzeRepository} disabled={isAnalyzing} class="gap-2">
						{#if isAnalyzing}
							<Loader2 class="h-4 w-4 animate-spin" />
							Analyzing commits...
						{:else}
							<RefreshCw class="h-4 w-4" />
							Analyze Repository
						{/if}
					</Button>
				</div>
			{:else}
				<!-- Milestones Feed -->
				<div class="space-y-4">
					{#each data.milestones as milestone}
						<!-- X Post Card -->
						<Card class="border-border/40 bg-card transition-colors hover:bg-card/80">
							<CardContent class="p-4">
								<!-- Post Content -->
								<div class="mb-3">
									<div class="flex items-center gap-2 mb-2">
										{#if milestone.milestone_type === 'feature'}
											<span class="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-medium">Feature</span>
										{:else if milestone.milestone_type === 'bugfix'}
											<span class="text-xs bg-red-500/10 text-red-500 px-2 py-0.5 rounded font-medium">Bugfix</span>
										{:else if milestone.milestone_type === 'refactor'}
											<span class="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded font-medium">Refactor</span>
										{:else if milestone.milestone_type === 'docs'}
											<span class="text-xs bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded font-medium">Docs</span>
										{:else if milestone.milestone_type === 'config'}
											<span class="text-xs bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded font-medium">Config</span>
										{/if}
									</div>
									<p class="whitespace-pre-wrap text-[15px] leading-relaxed">
										{milestone.x_post_suggestion || milestone.title}
									</p>
								</div>

								<!-- Screenshot -->
								{#if milestone.screenshot_url}
									<div class="mt-3 mb-3 overflow-hidden rounded-lg border border-border/40">
										<img
											src={milestone.screenshot_url}
											alt="Feature screenshot for {milestone.title}"
											class="w-full h-auto"
											loading="lazy"
										/>
									</div>
								{/if}

								<!-- Footer: Date, Commit Link, Actions -->
								<div class="flex items-center justify-between border-t border-border/40 pt-3">
									<div class="flex items-center gap-4 text-xs text-muted-foreground">
										<span>{formatDate(milestone.milestone_date)}</span>
										{#if milestone.commit_sha}
											<a
												href="{data.repository.github_repo_url}/commit/{milestone.commit_sha}"
												target="_blank"
												rel="noopener noreferrer"
												class="flex items-center gap-1 transition-colors hover:text-foreground"
											>
												<GitCommit class="h-3 w-3" />
												{milestone.commit_sha.slice(0, 7)}
											</a>
										{/if}
									</div>

									<div class="flex items-center gap-2">
										<Button
											onclick={() => copyToClipboard(milestone.x_post_suggestion || milestone.title, milestone.id)}
											variant="ghost"
											size="sm"
											class="h-8 gap-1.5 px-3 text-xs"
										>
											{#if copiedId === milestone.id}
												<Check class="h-3.5 w-3.5 text-green-500" />
												Copied
											{:else}
												<Copy class="h-3.5 w-3.5" />
												Copy
											{/if}
										</Button>
										<Button
											onclick={() => shareToX(milestone.x_post_suggestion || milestone.title)}
											variant="ghost"
											size="sm"
											class="h-8 gap-1.5 px-3 text-xs"
										>
											<Share2 class="h-3.5 w-3.5" />
											Share
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
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
	contentType="milestones"
/>
