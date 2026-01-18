<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { StoryChapter } from '$lib/types/story';

	interface Props {
		chapters: StoryChapter[];
		repoName: string;
		onPageChange?: (page: number, total: number) => void;
	}

	let { chapters, repoName, onPageChange }: Props = $props();

	let container: HTMLDivElement;
	let animator: Awaited<ReturnType<typeof import('$lib/three/page-animator').createPageAnimator>> | null = null;
	let isReady = $state(false);
	let animationFrameId: number;
	let cleanupFn: (() => void) | null = null;

	onMount(() => {
		// Use an IIFE to handle async setup
		(async () => {
			// Dynamic import to avoid SSR issues
			const [{ createBookScene }, { createBook }, { createPageAnimator }] = await Promise.all([
				import('$lib/three/book-scene'),
				import('$lib/three/book-geometry'),
				import('$lib/three/page-animator')
			]);

			const scene = createBookScene(container);
			const book = await createBook(chapters, repoName);
			scene.scene.add(book.group);

			animator = createPageAnimator(book);

			// Animation loop
			const animate = () => {
				animationFrameId = requestAnimationFrame(animate);
				scene.renderer.render(scene.scene, scene.camera);
			};
			animate();

			// Open book automatically
			setTimeout(async () => {
				if (animator) {
					await animator.openBook();
					onPageChange?.(animator.currentPage + 1, animator.totalPages);
				}
			}, 500);

			isReady = true;

			// Keyboard navigation
			const handleKeydown = (e: KeyboardEvent) => {
				if (e.key === 'ArrowRight' || e.key === ' ') {
					e.preventDefault();
					nextPage();
				} else if (e.key === 'ArrowLeft') {
					e.preventDefault();
					prevPage();
				}
			};
			window.addEventListener('keydown', handleKeydown);

			// Store cleanup function
			cleanupFn = () => {
				window.removeEventListener('keydown', handleKeydown);
				cancelAnimationFrame(animationFrameId);
				scene.dispose();
			};
		})();

		// Return synchronous cleanup
		return () => {
			cleanupFn?.();
		};
	});

	onDestroy(() => {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}
	});

	export async function nextPage() {
		if (!animator || animator.isAnimating) return;
		await animator.nextPage();
		onPageChange?.(animator.currentPage + 1, animator.totalPages);
	}

	export async function prevPage() {
		if (!animator || animator.isAnimating) return;
		await animator.prevPage();
		onPageChange?.(animator.currentPage + 1, animator.totalPages);
	}

	function handleClick(e: MouseEvent) {
		if (!container) return;
		const rect = container.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const midpoint = rect.width / 2;

		if (x > midpoint) {
			nextPage();
		} else {
			prevPage();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			nextPage();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={container}
	role="application"
	aria-label="3D Storybook - Click left side for previous page, right side for next page"
	tabindex="0"
	class="h-full w-full cursor-pointer outline-none"
	onclick={handleClick}
	onkeydown={handleKeydown}
>
	{#if !isReady}
		<div class="flex h-full w-full items-center justify-center">
			<div class="text-muted-foreground">Loading book...</div>
		</div>
	{/if}
</div>
