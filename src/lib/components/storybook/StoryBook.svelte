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
	let resizeObserver: ResizeObserver | null = null;

	onMount(() => {
		let sceneRef: Awaited<ReturnType<typeof import('$lib/three/book-scene').createBookScene>> | null = null;

		// Wait for container to have valid dimensions before initializing
		const initScene = async () => {
			if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
				requestAnimationFrame(initScene);
				return;
			}

			console.log('Book container dimensions:', container.clientWidth, 'x', container.clientHeight);

			// Dynamic import to avoid SSR issues
			const [{ createBookScene }, { createBook }, { createPageAnimator }] = await Promise.all([
				import('$lib/three/book-scene'),
				import('$lib/three/book-geometry'),
				import('$lib/three/page-animator')
			]);

			sceneRef = createBookScene(container);
			const book = await createBook(chapters, repoName);
			sceneRef.scene.add(book.group);

			animator = createPageAnimator(book);

			// Animation loop
			const animate = () => {
				if (!sceneRef) return;
				animationFrameId = requestAnimationFrame(animate);
				sceneRef.renderer.render(sceneRef.scene, sceneRef.camera);
			};
			animate();

			// Use ResizeObserver for better container resize handling
			resizeObserver = new ResizeObserver((entries) => {
				if (!sceneRef) return;
				for (const entry of entries) {
					const { width, height } = entry.contentRect;
					if (width > 0 && height > 0) {
						sceneRef.camera.aspect = width / height;
						sceneRef.camera.updateProjectionMatrix();
						sceneRef.renderer.setSize(width, height);
					}
				}
			});
			resizeObserver.observe(container);

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
				resizeObserver?.disconnect();
				sceneRef?.dispose();
			};
		};

		initScene();

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
