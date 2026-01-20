<script lang="ts">
	interface Props {
		message?: string;
	}

	let { message = 'This widget is no longer available' }: Props = $props();
</script>

<div class="widget-error">
	<div class="error-icon">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="32"
			height="32"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="12" cy="12" r="10" />
			<line x1="12" y1="8" x2="12" y2="12" />
			<line x1="12" y1="16" x2="12.01" y2="16" />
		</svg>
	</div>
	<p class="error-message">{message}</p>
	<a href="https://sumgit.com" target="_blank" rel="noopener noreferrer" class="error-link">
		Learn more about SumGit
	</a>
</div>

<style>
	.widget-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px 16px;
		text-align: center;
		min-height: 200px;
	}

	.error-icon {
		color: var(--widget-muted);
		margin-bottom: 12px;
	}

	.error-message {
		margin: 0 0 16px 0;
		color: var(--widget-muted);
		font-size: 14px;
	}

	.error-link {
		font-size: 12px;
		color: var(--widget-accent);
	}
</style>
