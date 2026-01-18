<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';

	interface Props {
		currentPage: number;
		totalPages: number;
		onPrev: () => void;
		onNext: () => void;
	}

	let { currentPage, totalPages, onPrev, onNext }: Props = $props();
</script>

<div class="flex items-center gap-4">
	<Button
		variant="outline"
		size="sm"
		onclick={onPrev}
		disabled={currentPage <= 1}
		class="gap-1"
	>
		<ChevronLeft class="h-4 w-4" />
		<span class="hidden sm:inline">Previous</span>
	</Button>

	<div class="text-sm text-muted-foreground">
		<span class="font-medium text-foreground">{currentPage}</span>
		<span> / {totalPages}</span>
	</div>

	<Button
		variant="outline"
		size="sm"
		onclick={onNext}
		disabled={currentPage >= totalPages}
		class="gap-1"
	>
		<span class="hidden sm:inline">Next</span>
		<ChevronRight class="h-4 w-4" />
	</Button>
</div>
