<script lang="ts">
	import type { Repository, DbStory } from '$lib/database.types';
	import type { StoryChapter } from '$lib/types/story';
	import WidgetBranding from './WidgetBranding.svelte';

	interface Props {
		repository: Repository;
		story: DbStory | null;
		showBranding?: boolean;
	}

	let { repository, story, showBranding = true }: Props = $props();

	let currentIndex = $state(0);

	let chapters = $derived.by(() => {
		if (!story?.chapters) return [];
		// chapters is stored as JSON
		return (story.chapters as unknown as StoryChapter[]) || [];
	});

	function nextChapter() {
		if (currentIndex < chapters.length - 1) {
			currentIndex++;
		}
	}

	function prevChapter() {
		if (currentIndex > 0) {
			currentIndex--;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') prevChapter();
		if (e.key === 'ArrowRight') nextChapter();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="widget-story">
	<div class="header">
		<h2 class="title">
			{repository.repo_name}
		</h2>
		<span class="subtitle">Story</span>
	</div>

	{#if !story || chapters.length === 0}
		<div class="empty">No story available</div>
	{:else}
		<div class="carousel">
			<!-- Current Chapter -->
			<div class="chapter-card">
				<div class="chapter-header">
					<span class="chapter-number">Chapter {currentIndex + 1}</span>
					<span class="chapter-date">{chapters[currentIndex].date_range}</span>
				</div>
				<h3 class="chapter-title">{chapters[currentIndex].title}</h3>
				<p class="chapter-content">{chapters[currentIndex].content}</p>
			</div>

			<!-- Navigation -->
			<div class="nav">
				<button class="nav-btn" onclick={prevChapter} disabled={currentIndex === 0} aria-label="Previous chapter">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="15 18 9 12 15 6"></polyline>
					</svg>
				</button>

				<div class="dots">
					{#each chapters as _, i}
						<button
							class="dot"
							class:active={i === currentIndex}
							onclick={() => (currentIndex = i)}
							aria-label="Go to chapter {i + 1}"
						></button>
					{/each}
				</div>

				<button
					class="nav-btn"
					onclick={nextChapter}
					disabled={currentIndex === chapters.length - 1}
					aria-label="Next chapter"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="9 18 15 12 9 6"></polyline>
					</svg>
				</button>
			</div>

			<p class="hint">Use arrow keys or click to navigate</p>
		</div>
	{/if}

	<WidgetBranding show={showBranding} />
</div>

<style>
	.widget-story {
		width: 100%;
	}

	.header {
		margin-bottom: 16px;
		text-align: center;
	}

	.title {
		margin: 0 0 4px 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--widget-fg);
	}

	.subtitle {
		font-size: 12px;
		color: var(--widget-muted);
	}

	.empty {
		text-align: center;
		padding: 24px;
		color: var(--widget-muted);
	}

	.carousel {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.chapter-card {
		padding: 16px;
		background: var(--widget-card-bg);
		border: 1px solid var(--widget-border);
		border-radius: 8px;
		min-height: 180px;
	}

	.chapter-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.chapter-number {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--widget-accent);
	}

	.chapter-date {
		font-size: 11px;
		color: var(--widget-muted);
	}

	.chapter-title {
		margin: 0 0 8px 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--widget-fg);
	}

	.chapter-content {
		margin: 0;
		font-size: 13px;
		line-height: 1.6;
		color: var(--widget-fg);
		opacity: 0.9;
		display: -webkit-box;
		-webkit-line-clamp: 5;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.nav {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
	}

	.nav-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: var(--widget-card-bg);
		border: 1px solid var(--widget-border);
		border-radius: 50%;
		color: var(--widget-fg);
		cursor: pointer;
		transition: all 0.2s;
	}

	.nav-btn:hover:not(:disabled) {
		background: var(--widget-accent-light);
		border-color: var(--widget-accent);
		color: var(--widget-accent);
	}

	.nav-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.dots {
		display: flex;
		gap: 6px;
	}

	.dot {
		width: 8px;
		height: 8px;
		background: var(--widget-border);
		border: none;
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.2s;
		padding: 0;
	}

	.dot:hover {
		background: var(--widget-muted);
	}

	.dot.active {
		background: var(--widget-accent);
		width: 20px;
		border-radius: 4px;
	}

	.hint {
		margin: 0;
		text-align: center;
		font-size: 11px;
		color: var(--widget-muted);
	}
</style>
