<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { BookOpen } from '@lucide/svelte';
	import logo from '$lib/assets/logo.png';
	import PageControls from '$lib/components/storybook/PageControls.svelte';
	import type { StoryChapter } from '$lib/types/story';

	let { data } = $props();

	let currentPage = $state(1);
	let totalPages = $state(data.story.chapters.length);
	let storyBookRef = $state<{
		nextPage: () => Promise<void>;
		prevPage: () => Promise<void>;
	} | null>(null);

	function handlePageChange(page: number, total: number) {
		currentPage = page;
		totalPages = total;
	}
</script>

<svelte:head>
	<title>{data.repository.repo_owner}/{data.repository.repo_name} Story | sumgit</title>
	<meta
		name="description"
		content="The story of {data.repository.repo_owner}/{data.repository.repo_name} - a developer journey told through milestones"
	/>
	<meta property="og:title" content="{data.repository.repo_owner}/{data.repository.repo_name} Story" />
	<meta
		property="og:description"
		content="The story of {data.repository.repo_owner}/{data.repository.repo_name} - a developer journey told through milestones"
	/>
	<meta property="og:type" content="article" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="{data.repository.repo_owner}/{data.repository.repo_name} Story" />
	<meta
		name="twitter:description"
		content="The story of {data.repository.repo_owner}/{data.repository.repo_name} - a developer journey told through milestones"
	/>
</svelte:head>

<div class="flex min-h-screen flex-col bg-background">
	<!-- Header -->
	<header class="border-b border-border/40 px-4 py-3 sm:px-6 sm:py-4">
		<div class="mx-auto flex max-w-4xl items-center justify-between">
			<a href="/" class="flex items-center gap-2 transition-opacity hover:opacity-80">
				<img src={logo} alt="sumgit" class="h-6 w-6 rounded-md sm:h-7 sm:w-7" />
				<span class="text-sm font-semibold sm:text-base">sumgit</span>
			</a>
			<div class="flex items-center gap-2">
				<BookOpen class="h-4 w-4 text-amber-500" />
				<span class="truncate text-sm font-medium">
					{data.repository.repo_owner}/{data.repository.repo_name}
				</span>
			</div>
		</div>
	</header>

	<!-- Main content -->
	<main class="flex flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
		<div class="mx-auto flex w-full max-w-4xl flex-1 flex-col">
			<!-- Story view -->
			<div class="flex flex-1 flex-col">
				<!-- 3D Book -->
				<div class="relative" style="height: 70vh;">
					{#await import('$lib/components/storybook/StoryBook.svelte') then StoryBook}
						<StoryBook.default
							bind:this={storyBookRef}
							chapters={data.story.chapters}
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
		</div>
	</main>

	<!-- Footer -->
	<footer class="border-t border-border/40 px-4 py-4 sm:px-6">
		<div class="mx-auto flex max-w-4xl flex-col items-center justify-center gap-2 text-center">
			<p class="text-sm text-muted-foreground">
				Create your own developer story at
				<a href="/" class="text-amber-500 hover:underline">sumgit.com</a>
			</p>
		</div>
	</footer>
</div>
