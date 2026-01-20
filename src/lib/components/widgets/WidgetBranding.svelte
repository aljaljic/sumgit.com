<script lang="ts">
	interface Props {
		show?: boolean;
	}

	let { show = true }: Props = $props();
</script>

{#if show}
	<div class="widget-branding">
		<a href="https://sumgit.com" target="_blank" rel="noopener noreferrer">
			Powered by <strong>SumGit</strong>
		</a>
	</div>
{/if}

<style>
	.widget-branding {
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--widget-border);
		text-align: center;
		font-size: 12px;
		color: var(--widget-muted);
	}

	.widget-branding a {
		color: var(--widget-muted);
		text-decoration: none;
		transition: color 0.2s;
	}

	.widget-branding a:hover {
		color: var(--widget-accent);
		text-decoration: none;
	}

	.widget-branding strong {
		color: var(--widget-accent);
	}
</style>
