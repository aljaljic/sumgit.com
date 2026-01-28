<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import {
		ArrowLeft,
		ScrollText,
		Loader2,
		Download,
		Copy,
		Check,
		Code,
		ChevronDown,
		ChevronRight,
		GitCommit,
		Calendar
	} from '@lucide/svelte';
	import logo from '$lib/assets/logo.png';
	import IconChangelog from '$lib/components/icons/IconChangelog.svelte';
	import PurchaseCreditsDialog from '$lib/components/PurchaseCreditsDialog.svelte';
	import ShareEmbedDialog from '$lib/components/ShareEmbedDialog.svelte';
	import type { Changelog, ChangelogGrouping, ChangelogCategory } from '$lib/types/changelog';

	let { data } = $props();

	let isGenerating = $state(false);
	let changelog = $state<Changelog | null>(null);
	let markdown = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let showPurchaseDialog = $state(false);
	let showEmbedDialog = $state(false);
	let copied = $state(false);
	let copiedFormat = $state<'markdown' | 'github' | null>(null);
	let grouping = $state<ChangelogGrouping>('date');
	let expandedVersions = $state<Set<string>>(new Set());

	const groupingOptions = [
		{ value: 'date', label: 'By Date' },
		{ value: 'month', label: 'By Month' },
		{ value: 'version', label: 'By Version (AI suggested)' }
	];

	async function generateChangelog() {
		if (isGenerating) return;

		isGenerating = true;
		errorMessage = null;

		try {
			const response = await fetch('/api/changelog', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					repository_id: data.repository.id,
					grouping
				})
			});

			if (response.status === 402) {
				showPurchaseDialog = true;
				return;
			}

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to generate changelog');
			}

			const result = await response.json();
			changelog = result.changelog;
			markdown = result.markdown;

			// Expand the first version by default
			if (result.changelog?.versions?.length > 0) {
				expandedVersions = new Set([result.changelog.versions[0].version]);
			}
		} catch (err) {
			console.error('Changelog generation error:', err);
			errorMessage = err instanceof Error ? err.message : 'Failed to generate changelog';
		} finally {
			isGenerating = false;
		}
	}

	function toggleVersion(version: string) {
		const newSet = new Set(expandedVersions);
		if (newSet.has(version)) {
			newSet.delete(version);
		} else {
			newSet.add(version);
		}
		expandedVersions = newSet;
	}

	async function copyToClipboard(text: string, format: 'markdown' | 'github') {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			copiedFormat = format;
			setTimeout(() => {
				copied = false;
				copiedFormat = null;
			}, 2000);
		} catch {
			// Fallback
			const input = document.createElement('textarea');
			input.value = text;
			document.body.appendChild(input);
			input.select();
			document.execCommand('copy');
			document.body.removeChild(input);
			copied = true;
			copiedFormat = format;
			setTimeout(() => {
				copied = false;
				copiedFormat = null;
			}, 2000);
		}
	}

	function downloadMarkdown() {
		if (!markdown) return;

		const blob = new Blob([markdown], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'CHANGELOG.md';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function generateGitHubRelease(): string {
		if (!changelog || changelog.versions.length === 0) return '';

		const version = changelog.versions[0];
		const lines: string[] = ["## What's Changed", ''];

		const categoryLabels: Record<ChangelogCategory, string> = {
			Added: 'New Features',
			Fixed: 'Bug Fixes',
			Changed: 'Changes',
			Documentation: 'Documentation',
			Other: 'Other'
		};

		const categories: ChangelogCategory[] = ['Added', 'Fixed', 'Changed', 'Documentation', 'Other'];

		for (const category of categories) {
			const entries = version.entries[category];
			if (entries && entries.length > 0) {
				lines.push(`### ${categoryLabels[category]}`);
				lines.push('');

				for (const entry of entries) {
					lines.push(`- ${entry.title}`);
				}
				lines.push('');
			}
		}

		lines.push(`**Full Changelog**: ${data.repository.github_repo_url}/commits`);

		return lines.join('\n');
	}

	function getCategoryColor(category: ChangelogCategory): string {
		switch (category) {
			case 'Added':
				return 'bg-emerald-500/10 text-emerald-500';
			case 'Fixed':
				return 'bg-red-500/10 text-red-500';
			case 'Changed':
				return 'bg-blue-500/10 text-blue-500';
			case 'Documentation':
				return 'bg-purple-500/10 text-purple-500';
			default:
				return 'bg-orange-500/10 text-orange-500';
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
				<img src={logo} alt="SumGit" class="h-6 w-6 shrink-0 rounded-md sm:h-7 sm:w-7" />
			</div>
			<div class="flex items-center gap-2">
				{#if data.milestones.length > 0 && changelog}
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
				<ScrollText class="h-4 w-4 text-teal-500" />
				<span class="text-sm font-medium">Changelog</span>
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
						<ScrollText class="h-8 w-8 text-muted-foreground" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">No milestones yet</h3>
					<p class="mb-6 max-w-sm text-muted-foreground">
						Analyze your repository first to generate milestones, then come back to create your
						changelog
					</p>
					<Button href="/project/{data.repository.id}" variant="outline" class="gap-2">
						<ArrowLeft class="h-4 w-4" />
						Go to Project
					</Button>
				</div>
			{:else if isGenerating}
				<!-- Loading state -->
				<div class="flex flex-1 flex-col items-center justify-center py-20">
					<Loader2 class="h-12 w-12 animate-spin text-teal-500 mb-4" />
					<p class="text-muted-foreground">Generating changelog...</p>
				</div>
			{:else if errorMessage}
				<!-- Error state -->
				<div class="flex flex-1 flex-col items-center justify-center py-20 text-center">
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
					>
						<ScrollText class="h-8 w-8 text-destructive" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">Something went wrong</h3>
					<p class="mb-6 max-w-sm text-muted-foreground">{errorMessage}</p>
					<Button onclick={generateChangelog} class="gap-2">
						<ScrollText class="h-4 w-4" />
						Try Again
					</Button>
				</div>
			{:else if changelog}
				<!-- Changelog view -->
				<div class="flex flex-1 flex-col">
					<!-- Export actions -->
					<div class="mb-6 flex flex-wrap items-center justify-center gap-2">
						<Button variant="outline" size="sm" onclick={downloadMarkdown} class="gap-2">
							<Download class="h-4 w-4" />
							Download .md
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => markdown && copyToClipboard(markdown, 'markdown')}
							class="gap-2"
						>
							{#if copied && copiedFormat === 'markdown'}
								<Check class="h-4 w-4 text-green-500" />
								Copied!
							{:else}
								<Copy class="h-4 w-4" />
								Copy Markdown
							{/if}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => copyToClipboard(generateGitHubRelease(), 'github')}
							class="gap-2"
						>
							{#if copied && copiedFormat === 'github'}
								<Check class="h-4 w-4 text-green-500" />
								Copied!
							{:else}
								<Copy class="h-4 w-4" />
								GitHub Release
							{/if}
						</Button>
						<Button variant="outline" size="sm" onclick={generateChangelog} class="gap-2">
							<ScrollText class="h-4 w-4" />
							Regenerate
						</Button>
					</div>

					<!-- Changelog preview -->
					<div class="rounded-lg border border-border bg-card p-6">
						<div class="mb-6 flex items-center gap-3">
							<IconChangelog size={32} />
							<div>
								<h2 class="text-xl font-bold">Changelog</h2>
								<p class="text-sm text-muted-foreground">
									{changelog.versions.length} version{changelog.versions.length === 1 ? '' : 's'} •
									Next suggested: {changelog.suggested_next_version}
								</p>
							</div>
						</div>

						<div class="space-y-4">
							{#each changelog.versions as version}
								{@const isExpanded = expandedVersions.has(version.version)}
								{@const totalEntries = Object.values(version.entries).flat().length}
								<div class="rounded-lg border border-border/60 overflow-hidden">
									<button
										type="button"
										onclick={() => toggleVersion(version.version)}
										class="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
									>
										<div class="flex items-center gap-3">
											{#if isExpanded}
												<ChevronDown class="h-4 w-4 text-muted-foreground" />
											{:else}
												<ChevronRight class="h-4 w-4 text-muted-foreground" />
											{/if}
											<span class="font-semibold text-teal-500">[{version.version}]</span>
											<span class="text-muted-foreground">-</span>
											<span class="flex items-center gap-1 text-sm text-muted-foreground">
												<Calendar class="h-3 w-3" />
												{formatDate(version.date)}
											</span>
										</div>
										<span class="text-xs text-muted-foreground">
											{totalEntries} change{totalEntries === 1 ? '' : 's'}
										</span>
									</button>

									{#if isExpanded}
										<div class="border-t border-border/60 p-4 space-y-4">
											{#each ['Added', 'Fixed', 'Changed', 'Documentation', 'Other'] as category}
												{@const entries = version.entries[category as ChangelogCategory]}
												{#if entries && entries.length > 0}
													<div>
														<h4 class="text-sm font-semibold mb-2 flex items-center gap-2">
															<span
																class="px-2 py-0.5 rounded text-xs {getCategoryColor(
																	category as ChangelogCategory
																)}">{category}</span
															>
														</h4>
														<ul class="space-y-2 ml-4">
															{#each entries as entry}
																<li class="flex items-start gap-2 text-sm">
																	<span class="text-muted-foreground mt-1">•</span>
																	<div class="flex-1">
																		<span>{entry.title}</span>
																		{#if entry.commit_sha}
																			<a
																				href="{data.repository
																					.github_repo_url}/commit/{entry.commit_sha}"
																				target="_blank"
																				rel="noopener noreferrer"
																				class="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
																			>
																				<GitCommit class="h-3 w-3" />
																				{entry.commit_sha.slice(0, 7)}
																			</a>
																		{/if}
																	</div>
																</li>
															{/each}
														</ul>
													</div>
												{/if}
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			{:else}
				<!-- Generate changelog state -->
				<div class="flex flex-1 flex-col items-center justify-center py-20 text-center">
					<div class="mb-4">
						<IconChangelog size={48} />
					</div>
					<h3 class="mb-2 text-lg font-semibold">Generate Changelog</h3>
					<p class="mb-6 max-w-sm text-muted-foreground">
						Transform your {data.milestones.length} milestone{data.milestones.length === 1
							? ''
							: 's'} into a professional CHANGELOG.md following Keep a Changelog conventions
					</p>

					<!-- Grouping selector -->
					<div class="mb-6 w-full max-w-md">
						<p class="mb-3 text-sm font-medium text-muted-foreground">Group entries by</p>
						<div class="flex flex-wrap justify-center gap-2">
							{#each groupingOptions as option}
								<button
									type="button"
									onclick={() => (grouping = option.value as ChangelogGrouping)}
									class="flex flex-col items-center gap-1 rounded-lg border-2 px-4 py-3 transition-all hover:border-teal-500/50 {grouping ===
									option.value
										? 'border-teal-500 bg-teal-500/10'
										: 'border-border bg-card'}"
								>
									<span class="text-sm font-medium">{option.label}</span>
								</button>
							{/each}
						</div>
					</div>

					<Button onclick={generateChangelog} class="gap-2 bg-teal-600 hover:bg-teal-700">
						{#if isGenerating}
							<Loader2 class="h-4 w-4 animate-spin" />
							Generating...
						{:else}
							<ScrollText class="h-4 w-4" />
							Generate Changelog
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

<ShareEmbedDialog
	bind:open={showEmbedDialog}
	onOpenChange={(open) => (showEmbedDialog = open)}
	repositoryId={data.repository.id}
	contentType="changelog"
/>
