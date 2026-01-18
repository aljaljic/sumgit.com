<script lang="ts">
	import { Loader2 } from '@lucide/svelte';
</script>

<div class="flex h-full w-full flex-col items-center justify-center gap-6">
	<div class="relative">
		<!-- Book skeleton -->
		<div class="h-48 w-36 animate-pulse rounded-sm bg-secondary/50 shadow-lg sm:h-64 sm:w-48">
			<div class="absolute inset-4 space-y-3">
				<div class="h-4 w-3/4 rounded bg-secondary"></div>
				<div class="h-3 w-1/2 rounded bg-secondary"></div>
				<div class="mt-6 space-y-2">
					<div class="h-2 w-full rounded bg-secondary/70"></div>
					<div class="h-2 w-full rounded bg-secondary/70"></div>
					<div class="h-2 w-4/5 rounded bg-secondary/70"></div>
				</div>
			</div>
		</div>
		<!-- Spine decoration -->
		<div
			class="absolute left-0 top-0 h-full w-2 rounded-l-sm bg-secondary/70"
		></div>
	</div>

	<div class="flex items-center gap-2 text-muted-foreground">
		<Loader2 class="h-4 w-4 animate-spin" />
		<span>Crafting your story...</span>
	</div>

	<p class="max-w-xs text-center text-sm text-muted-foreground">
		Our AI is weaving your repository's milestones into a narrative journey
	</p>
</div>
