<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { ArrowLeft, BookOpen, Loader2 } from '@lucide/svelte';
	import logo from '$lib/assets/logo.png';
	import StoryLoader from '$lib/components/storybook/StoryLoader.svelte';
	import PageControls from '$lib/components/storybook/PageControls.svelte';
	import type { StoryChapter } from '$lib/types/story';

	let { data } = $props();

	let isGenerating = $state(false);
	let story = $state<{ chapters: StoryChapter[] } | null>(null);
	let errorMessage = $state<string | null>(null);
	let currentPage = $state(1);
	let totalPages = $state(0);
	let storyBookRef = $state<{
		nextPage: () => Promise<void>;
		prevPage: () => Promise<void>;
	} | null>(null);

	async function generateStory() {
		if (isGenerating) return;

		isGenerating = true;
		errorMessage = null;

		try {
			const response = await fetch('/api/generate-story', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ repository_id: data.repository.id })
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to generate story');
			}

			const result = await response.json();
			story = result.story;
			totalPages = result.story.chapters.length;
		} catch (err) {
			console.error('Story generation error:', err);
			errorMessage = err instanceof Error ? err.message : 'Failed to generate story';
		} finally {
			isGenerating = false;
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
					<!-- 3D Book -->
					<div class="relative flex-1" style="min-height: 400px;">
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
