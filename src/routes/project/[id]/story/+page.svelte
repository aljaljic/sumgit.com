<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { ArrowLeft, BookOpen, Loader2, Share2, Link, Check, X, Code } from '@lucide/svelte';
	import logo from '$lib/assets/logo.png';
	import StoryLoader from '$lib/components/storybook/StoryLoader.svelte';
	import PageControls from '$lib/components/storybook/PageControls.svelte';
	import type { StoryChapter, NarrativeStyleId, Story } from '$lib/types/story';
	import { NARRATIVE_STYLES } from '$lib/types/story';
	import PurchaseCreditsDialog from '$lib/components/PurchaseCreditsDialog.svelte';
	import ShareEmbedDialog from '$lib/components/ShareEmbedDialog.svelte';
	import { CREDIT_COSTS } from '$lib/credits';
	import { page } from '$app/stores';

	let { data } = $props();

	let isGenerating = $state(false);
	let story = $state<Story | null>(data.existingStory);
	let errorMessage = $state<string | null>(null);
	let currentPage = $state(1);
	let totalPages = $state(data.existingStory?.chapters.length ?? 0);
	let storyBookRef = $state<{
		nextPage: () => Promise<void>;
		prevPage: () => Promise<void>;
	} | null>(null);
	let showPurchaseDialog = $state(false);
	let showEmbedDialog = $state(false);
	let selectedStyle = $state<NarrativeStyleId>(data.existingStory?.narrative_style ?? 'fantasy');

	// Share state
	let isSharing = $state(false);
	let shareUrl = $state<string | null>(
		data.existingStory?.is_public && data.existingStory?.share_token
			? `${$page.url.origin}/story/${data.existingStory.share_token}`
			: null
	);
	let copied = $state(false);

	async function generateStory() {
		if (isGenerating) return;

		isGenerating = true;
		errorMessage = null;

		try {
			const response = await fetch('/api/generate-story', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					repository_id: data.repository.id,
					narrative_style: selectedStyle
				})
			});

			if (response.status === 402) {
				// Insufficient credits
				showPurchaseDialog = true;
				return;
			}

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to generate story');
			}

			const result = await response.json();
			story = result.story;
			totalPages = result.story.chapters.length;
			// Reset share state for new story
			shareUrl = null;
		} catch (err) {
			console.error('Story generation error:', err);
			errorMessage = err instanceof Error ? err.message : 'Failed to generate story';
		} finally {
			isGenerating = false;
		}
	}

	async function enableSharing() {
		if (!story?.id || isSharing) return;

		isSharing = true;
		try {
			const response = await fetch('/api/share-story', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ story_id: story.id })
			});

			if (!response.ok) {
				throw new Error('Failed to enable sharing');
			}

			const result = await response.json();
			shareUrl = result.share_url;
			if (story) {
				story.is_public = true;
				story.share_token = result.share_token;
			}
		} catch (err) {
			console.error('Share error:', err);
			errorMessage = err instanceof Error ? err.message : 'Failed to enable sharing';
		} finally {
			isSharing = false;
		}
	}

	async function disableSharing() {
		if (!story?.id || isSharing) return;

		isSharing = true;
		try {
			const response = await fetch('/api/share-story', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ story_id: story.id })
			});

			if (!response.ok) {
				throw new Error('Failed to disable sharing');
			}

			shareUrl = null;
			if (story) {
				story.is_public = false;
			}
		} catch (err) {
			console.error('Unshare error:', err);
			errorMessage = err instanceof Error ? err.message : 'Failed to disable sharing';
		} finally {
			isSharing = false;
		}
	}

	async function copyShareUrl() {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Fallback for older browsers
			const input = document.createElement('input');
			input.value = shareUrl;
			document.body.appendChild(input);
			input.select();
			document.execCommand('copy');
			document.body.removeChild(input);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		}
	}

	function handlePageChange(page: number, total: number) {
		currentPage = page;
		totalPages = total;
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
				<BookOpen class="h-4 w-4 text-amber-500" />
				<span class="text-sm font-medium">Story</span>
			</div>
		</div>
	</header>

	<!-- Main content -->
	<main class="flex flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
		<div class="mx-auto flex w-full max-w-4xl flex-1 flex-col">
			{#if data.milestones.length === 0}
				<!-- No milestones state -->
				<div class="flex flex-1 flex-col items-center justify-center py-20 text-center">
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/50"
					>
						<BookOpen class="h-8 w-8 text-muted-foreground" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">No milestones yet</h3>
					<p class="mb-6 max-w-sm text-muted-foreground">
						Analyze your repository first to generate milestones, then come back to create your
						story
					</p>
					<Button href="/project/{data.repository.id}" variant="outline" class="gap-2">
						<ArrowLeft class="h-4 w-4" />
						Go to Project
					</Button>
				</div>
			{:else if isGenerating}
				<!-- Loading state -->
				<div class="flex flex-1 items-center justify-center">
					<StoryLoader />
				</div>
			{:else if errorMessage}
				<!-- Error state -->
				<div class="flex flex-1 flex-col items-center justify-center py-20 text-center">
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
					>
						<BookOpen class="h-8 w-8 text-destructive" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">Something went wrong</h3>
					<p class="mb-6 max-w-sm text-muted-foreground">{errorMessage}</p>
					<Button onclick={generateStory} class="gap-2">
						<BookOpen class="h-4 w-4" />
						Try Again
					</Button>
				</div>
			{:else if story}
				<!-- Story view -->
				<div class="flex flex-1 flex-col">
					<!-- Share controls -->
					<div class="mb-4 flex flex-wrap items-center justify-center gap-2">
						{#if shareUrl}
							<!-- Share URL display -->
							<div
								class="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
							>
								<Link class="h-4 w-4 text-muted-foreground" />
								<span class="max-w-[200px] truncate text-sm sm:max-w-[300px]">{shareUrl}</span>
								<Button variant="ghost" size="sm" class="h-7 px-2" onclick={copyShareUrl}>
									{#if copied}
										<Check class="h-4 w-4 text-green-500" />
									{:else}
										<span class="text-xs">Copy</span>
									{/if}
								</Button>
							</div>
							<Button
								variant="outline"
								size="sm"
								onclick={disableSharing}
								disabled={isSharing}
								class="gap-1"
							>
								{#if isSharing}
									<Loader2 class="h-4 w-4 animate-spin" />
								{:else}
									<X class="h-4 w-4" />
								{/if}
								Disable Link
							</Button>
						{:else if story.id}
							<Button
								variant="outline"
								size="sm"
								onclick={enableSharing}
								disabled={isSharing}
								class="gap-2"
							>
								{#if isSharing}
									<Loader2 class="h-4 w-4 animate-spin" />
									Creating link...
								{:else}
									<Share2 class="h-4 w-4" />
									Share Story
								{/if}
							</Button>
						{/if}
						<Button variant="outline" size="sm" onclick={generateStory} class="gap-2">
							<BookOpen class="h-4 w-4" />
							Regenerate
						</Button>
					</div>

					<!-- 3D Book -->
					<div class="relative" style="height: 70vh;">
						{#await import('$lib/components/storybook/StoryBook.svelte') then StoryBook}
							<StoryBook.default
								bind:this={storyBookRef}
								chapters={story.chapters}
								repoName={data.repository.repo_name}
								onPageChange={handlePageChange}
							/>
						{/await}
					</div>

					<!-- Controls -->
					<div class="flex justify-center py-4">
						<PageControls
							{currentPage}
							{totalPages}
							onPrev={() => storyBookRef?.prevPage()}
							onNext={() => storyBookRef?.nextPage()}
						/>
					</div>

					<!-- Keyboard hint -->
					<p class="text-center text-xs text-muted-foreground">
						Use arrow keys or click left/right to turn pages
					</p>
				</div>
			{:else}
				<!-- Generate story state -->
				<div class="flex flex-1 flex-col items-center justify-center py-20 text-center">
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10"
					>
						<BookOpen class="h-8 w-8 text-amber-500" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">Tell Your Story</h3>
					<p class="mb-6 max-w-sm text-muted-foreground">
						Transform your {data.milestones.length} milestone{data.milestones.length === 1
							? ''
							: 's'} into an engaging narrative about your project's journey
					</p>

					<!-- Narrative Style Selector -->
					<div class="mb-6 w-full max-w-2xl">
						<p class="mb-3 text-sm font-medium text-muted-foreground">Choose your narrative style</p>
						<div class="flex flex-wrap justify-center gap-2">
							{#each NARRATIVE_STYLES as style}
								<button
									type="button"
									onclick={() => (selectedStyle = style.id)}
									class="flex flex-col items-center gap-1 rounded-lg border-2 px-4 py-3 transition-all hover:border-amber-500/50 {selectedStyle ===
									style.id
										? 'border-amber-500 bg-amber-500/10'
										: 'border-border bg-card'}"
								>
									<span class="text-xl">{style.icon}</span>
									<span class="text-sm font-medium">{style.name}</span>
									<span class="text-xs text-muted-foreground">{style.description}</span>
								</button>
							{/each}
						</div>
					</div>

					<Button onclick={generateStory} class="gap-2">
						{#if isGenerating}
							<Loader2 class="h-4 w-4 animate-spin" />
							Generating...
						{:else}
							<BookOpen class="h-4 w-4" />
							Generate Story
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
	contentType="story"
/>
