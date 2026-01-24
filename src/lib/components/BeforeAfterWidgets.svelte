<div class="comparison-wrapper">
	<div class="cards-container">
		<!-- Before card -->
		<div class="card-wrapper">
			<span class="label before-label">Without SumGit</span>
			<div class="card old-style">
				<div class="card-item">
					<span class="icon">📋</span>
					<span class="text">Manually track changes in a changelog</span>
				</div>
				<div class="card-item">
					<span class="icon">🔍</span>
					<span class="text">Dig through commit history</span>
				</div>
				<div class="card-item">
					<span class="icon">✍️</span>
					<span class="text">Write announcements from scratch</span>
				</div>
				<div class="card-item">
					<span class="icon">😅</span>
					<span class="text">Forget what you shipped</span>
				</div>
				<div class="card-item">
					<span class="icon">🤷</span>
					<span class="text">No way to keep users in the loop</span>
				</div>
			</div>
		</div>

		<!-- After card -->
		<div class="card-wrapper">
			<span class="label after-label">With SumGit</span>
			<div class="card new-style">
				<div class="card-item highlight">
					<span class="icon">🤖</span>
					<span class="text">AI extracts milestones automatically</span>
				</div>
				<div class="card-item highlight">
					<span class="icon">📊</span>
					<span class="text">Visual timeline of your journey</span>
				</div>
				<div class="card-item highlight">
					<span class="icon">📝</span>
					<span class="text">Ready-to-post summaries</span>
				</div>
				<div class="card-item highlight">
					<span class="icon">📖</span>
					<span class="text">Interactive storybook of your work</span>
				</div>
				<div class="card-item highlight">
					<span class="icon">🔗</span>
					<span class="text">Embeddable widgets to share</span>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.comparison-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		width: 100%;
	}

	.cards-container {
		display: flex;
		gap: 1.5rem;
		width: 100%;
		justify-content: center;
		flex-wrap: wrap;
	}

	.card-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
		min-width: 280px;
		max-width: 340px;
	}

	.label {
		padding: 0.375rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.before-label {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.after-label {
		background: rgba(34, 197, 94, 0.15);
		color: #22c55e;
	}

	.card {
		width: 100%;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.old-style {
		background: hsl(var(--background));
		border: 1px solid hsl(var(--border) / 0.6);
		border-radius: 12px;
	}

	.new-style {
		background: hsl(var(--background));
		border: 1px solid hsl(var(--border) / 0.4);
		border-radius: 12px;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -2px rgba(0, 0, 0, 0.1),
			0 0 0 1px rgba(34, 197, 94, 0.15);
	}

	.card-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
	}

	.old-style .card-item {
		color: hsl(var(--muted-foreground));
	}

	.highlight {
		background: hsl(var(--muted) / 0.3);
	}

	.icon {
		font-size: 1rem;
		flex-shrink: 0;
	}

	.text {
		font-size: 0.875rem;
	}
</style>
