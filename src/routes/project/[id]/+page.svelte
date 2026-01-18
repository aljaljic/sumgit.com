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
		BookOpen
	} from '@lucide/svelte';
	import { invalidateAll, goto } from '$app/navigation';
	import logo from '$lib/assets/logo.png';

	let { data } = $props();
	let isAnalyzing = $state(false);
	let copiedId = $state<string | null>(null);
	let isDeleting = $state(false);

	async function analyzeRepository() {
		isAnalyzing = true;
		try {
			const response = await fetch('/api/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ repository_id: data.repository.id })
			});

			if (response.ok) {
				await invalidateAll();
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
					<img src={logo} alt="sumgit" class="h-6 w-6 sm:h-7 sm:w-7 rounded-md shrink-0" />
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
									<p class="whitespace-pre-wrap text-[15px] leading-relaxed">
										{milestone.x_post_suggestion || milestone.title}
									</p>
								</div>

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
