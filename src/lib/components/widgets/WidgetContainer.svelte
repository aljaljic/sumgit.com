<script lang="ts">
	import type { WidgetTheme } from '$lib/types/share';
	import type { Snippet } from 'svelte';

	interface Props {
		theme?: WidgetTheme;
		children: Snippet;
	}

	let { theme = 'light', children }: Props = $props();

	// Determine actual theme (handle 'auto' by checking system preference)
	let resolvedTheme = $state<'light' | 'dark'>('light');

	$effect(() => {
		if (theme === 'auto') {
			// Check system preference
			const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
			resolvedTheme = mediaQuery.matches ? 'dark' : 'light';

			// Listen for changes
			const handler = (e: MediaQueryListEvent) => {
				resolvedTheme = e.matches ? 'dark' : 'light';
			};
			mediaQuery.addEventListener('change', handler);
			return () => mediaQuery.removeEventListener('change', handler);
		} else {
			resolvedTheme = theme;
		}
	});
</script>

<div
	class="widget-container"
	class:widget-dark={resolvedTheme === 'dark'}
	class:widget-light={resolvedTheme === 'light'}
>
	{@render children()}
</div>

<style>
	.widget-container {
		--widget-bg: #ffffff;
		--widget-fg: #111111;
		--widget-muted: #6b7280;
		--widget-border: #e5e7eb;
		--widget-card-bg: #f9fafb;
		--widget-accent: #9333ea;
		--widget-accent-light: #f3e8ff;

		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
			sans-serif;
		font-size: 14px;
		line-height: 1.5;
		background-color: var(--widget-bg);
		color: var(--widget-fg);
		min-width: 300px;
		max-width: 800px;
		margin: 0 auto;
		padding: 16px;
		box-sizing: border-box;
		border-radius: 8px;
		overflow: hidden;
	}

	.widget-container.widget-dark {
		--widget-bg: #18181b;
		--widget-fg: #fafafa;
		--widget-muted: #a1a1aa;
		--widget-border: #27272a;
		--widget-card-bg: #27272a;
		--widget-accent: #a855f7;
		--widget-accent-light: rgba(168, 85, 247, 0.15);
	}

	.widget-container :global(*) {
		box-sizing: border-box;
	}

	.widget-container :global(a) {
		color: var(--widget-accent);
		text-decoration: none;
	}

	.widget-container :global(a:hover) {
		text-decoration: underline;
	}
</style>
