<script lang="ts">
	import { onMount } from 'svelte';
	import type { StoryChapter } from '$lib/types/story';

	interface Props {
		chapters: StoryChapter[];
		repoName: string;
		onPageChange?: (page: number, total: number) => void;
	}

	let { chapters, repoName, onPageChange }: Props = $props();

	let container: HTMLDivElement;
	let book: Awaited<ReturnType<typeof import('$lib/three/book').createBook>> | null = null;
	let isReady = $state(false);

	onMount(() => {
		let animationFrameId: number;
		let resizeObserver: ResizeObserver | null = null;

		const init = async () => {
			if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
				requestAnimationFrame(init);
				return;
			}

			const { createBook } = await import('$lib/three/book');
			book = await createBook(container, chapters, repoName);

			const animate = () => {
				animationFrameId = requestAnimationFrame(animate);
				book?.renderer.render(book.scene, book.camera);
			};
			animate();

			resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					const { width, height } = entry.contentRect;
					if (width > 0 && height > 0 && book) {
						book.camera.aspect = width / height;
						book.camera.updateProjectionMatrix();
						book.renderer.setSize(width, height);
					}
				}
			});
			resizeObserver.observe(container);

			setTimeout(async () => {
				if (book) {
					await book.openBook();
					onPageChange?.(book.currentPage + 1, book.totalPages);
				}
			}, 500);

			isReady = true;
		};

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

		init();

		return () => {
			window.removeEventListener('keydown', handleKeydown);
			cancelAnimationFrame(animationFrameId);
			resizeObserver?.disconnect();
			book?.dispose();
		};
	});

	export async function nextPage() {
		if (!book || book.isAnimating) return;
		await book.nextPage();
		onPageChange?.(book.currentPage + 1, book.totalPages);
	}

	export async function prevPage() {
		if (!book || book.isAnimating) return;
		await book.prevPage();
		onPageChange?.(book.currentPage + 1, book.totalPages);
	}

	function handleClick(e: MouseEvent) {
		if (!container) return;
		const rect = container.getBoundingClientRect();
		const x = e.clientX - rect.left;
		if (x > rect.width / 2) nextPage();
		else prevPage();
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
	onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextPage(); } }}
>
	{#if !isReady}
		<div class="flex h-full w-full items-center justify-center">
			<div class="text-muted-foreground">Loading book...</div>
		</div>
	{/if}
</div>
