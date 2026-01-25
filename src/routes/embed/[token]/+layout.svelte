<script lang="ts">
	import type { Snippet } from 'svelte';
	import '../../layout.css';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<!-- Minimal layout for embeds - no navigation, no auth -->
<div class="embed-layout">
	{@render children()}
</div>

<style>
	.embed-layout {
		min-height: 100vh;
		width: 100%;
	}

	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: auto;
		background: transparent !important;
	}
</style>
