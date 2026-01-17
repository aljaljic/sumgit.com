<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
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
		Trash2
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

	const sortedYears = $derived(
		Object.keys(data.groupedMilestones).sort((a, b) => parseInt(b) - parseInt(a))
	);

	const monthOrder = [
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

	function sortMonths(months: string[]) {
		return months.sort((a, b) => monthOrder.indexOf(b) - monthOrder.indexOf(a));
	}

	function sortDays(days: string[]) {
		return days.sort((a, b) => parseInt(b) - parseInt(a));
	}
</script>

<div class="flex min-h-screen flex-col">
	<!-- Header -->
	<header class="border-b border-border/40 px-6 py-4">
		<div class="mx-auto flex max-w-4xl items-center justify-between">
			<div class="flex items-center gap-4">
				<Button href="/dashboard" variant="ghost" size="sm" class="gap-2">
					<ArrowLeft class="h-4 w-4" />
					Back
				</Button>
				<Separator orientation="vertical" class="h-6" />
				<div class="flex items-center gap-2">
					<img src={logo} alt="sumgit" class="h-7 w-7 rounded-md" />
					<span class="font-semibold">{data.repository.repo_owner}/{data.repository.repo_name}</span
					>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<Button
					onclick={analyzeRepository}
					disabled={isAnalyzing}
					variant="outline"
					size="sm"
					class="gap-2"
				>
					{#if isAnalyzing}
						<Loader2 class="h-4 w-4 animate-spin" />
						Analyzing...
					{:else}
						<RefreshCw class="h-4 w-4" />
						{data.milestones.length > 0 ? 'Re-analyze' : 'Analyze'}
					{/if}
				</Button>
				<Button
					onclick={deleteRepository}
					disabled={isDeleting}
					variant="ghost"
					size="sm"
					class="gap-2 text-destructive hover:text-destructive"
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
						Click "Analyze" to scan your commit history and extract significant milestones
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
				<!-- Timeline -->
				<div class="relative">
					<!-- Vertical line -->
					<div
						class="absolute top-0 left-[7px] h-full w-0.5 bg-gradient-to-b from-emerald-500/50 via-emerald-500/30 to-transparent"
					></div>

					{#each sortedYears as year}
						<div class="mb-8">
							<!-- Year header -->
							<div class="relative mb-6 flex items-center gap-4">
								<div class="h-4 w-4 rounded-full border-2 border-emerald-500 bg-background"></div>
								<h2 class="text-xl font-bold text-emerald-400">{year}</h2>
							</div>

							{#each sortMonths(Object.keys(data.groupedMilestones[year])) as month}
								<div class="mb-6 ml-8">
									<!-- Month header -->
									<h3 class="mb-4 text-lg font-semibold text-muted-foreground">{month}</h3>

									{#each sortDays(Object.keys(data.groupedMilestones[year][month])) as day}
										<div class="mb-4">
											<!-- Day header -->
											<div class="mb-3 flex items-center gap-2">
												<Badge variant="outline" class="font-mono text-xs">
													{month.slice(0, 3)}
													{day}
												</Badge>
											</div>

											<!-- Milestones for this day -->
											<div class="space-y-3">
												{#each data.groupedMilestones[year][month][day] as milestone}
													<Card class="border-border/40 bg-card/50 transition-colors hover:bg-card">
														<CardContent class="p-4">
															<div class="mb-2 flex items-start justify-between gap-4">
																<h4 class="font-semibold">{milestone.title}</h4>
																{#if milestone.commit_sha}
																	<a
																		href="{data.repository
																			.github_repo_url}/commit/{milestone.commit_sha}"
																		target="_blank"
																		rel="noopener noreferrer"
																		class="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
																	>
																		<GitCommit class="h-3 w-3" />
																		{milestone.commit_sha.slice(0, 7)}
																	</a>
																{/if}
															</div>

															{#if milestone.description}
																<p class="mb-3 text-sm text-muted-foreground">
																	{milestone.description}
																</p>
															{/if}

															{#if milestone.x_post_suggestion}
																<div
																	class="rounded-md border border-border/40 bg-background/50 p-3"
																>
																	<div class="mb-2 flex items-center justify-between">
																		<span class="text-xs font-medium text-muted-foreground">
																			X Post Suggestion
																		</span>
																		<Button
																			onclick={() =>
																				copyToClipboard(milestone.x_post_suggestion!, milestone.id)}
																			variant="ghost"
																			size="sm"
																			class="h-6 gap-1 px-2 text-xs"
																		>
																			{#if copiedId === milestone.id}
																				<Check class="h-3 w-3 text-green-500" />
																				Copied!
																			{:else}
																				<Copy class="h-3 w-3" />
																				Copy
																			{/if}
																		</Button>
																	</div>
																	<p class="text-sm leading-relaxed">
																		{milestone.x_post_suggestion}
																	</p>
																</div>
															{/if}
														</CardContent>
													</Card>
												{/each}
											</div>
										</div>
									{/each}
								</div>
							{/each}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</main>
</div>
