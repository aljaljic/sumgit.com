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
	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.6; transform: scale(1.15); }
	}

	.widget-container {
		--widget-bg: #ffffff;
		--widget-fg: #111111;
		--widget-muted: #6b7280;
		--widget-border: #e5e7eb;
		--widget-card-bg: #f9fafb;
		--widget-accent: #22c55e;
		--widget-accent-light: rgba(34, 197, 94, 0.12);
		--widget-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.05);
		--widget-shadow-hover: 0 4px 16px rgba(0, 0, 0, 0.1);

		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
			sans-serif;
		font-size: 14px;
		line-height: 1.5;
		background-color: var(--widget-bg);
		color: var(--widget-fg);
		min-width: 300px;
		max-width: 800px;
		margin: 0 auto;
		padding: 20px;
		box-sizing: border-box;
		border-radius: 16px;
		overflow: hidden;
		box-shadow: var(--widget-shadow);
	}

	.widget-container.widget-dark {
		--widget-bg: #0f0f11;
		--widget-fg: #fafafa;
		--widget-muted: #a1a1aa;
		--widget-border: rgba(255, 255, 255, 0.06);
		--widget-card-bg: #1a1a1d;
		--widget-accent: #4ade80;
		--widget-accent-light: rgba(74, 222, 128, 0.15);
		--widget-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.15);
		--widget-shadow-hover: 0 4px 16px rgba(0, 0, 0, 0.25);
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
