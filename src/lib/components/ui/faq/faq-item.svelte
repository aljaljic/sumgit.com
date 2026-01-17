<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { ChevronDown } from '@lucide/svelte';

	let {
		ref = $bindable(null),
		class: className,
		question,
		answer,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		question: string;
		answer: string;
	} = $props();

	let isOpen = $state(false);
</script>

<div
	bind:this={ref}
	data-slot="faq-item"
	class={cn('border-b border-border/40', className)}
	{...restProps}
>
	<button
		type="button"
		onclick={() => (isOpen = !isOpen)}
		class="flex w-full items-center justify-between py-4 text-left font-medium transition-all hover:text-primary"
		aria-expanded={isOpen}
	>
		<span>{question}</span>
		<ChevronDown
			class={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', {
				'rotate-180': isOpen
			})}
		/>
	</button>
	<div
		class={cn('grid transition-all duration-200', {
			'grid-rows-[1fr] opacity-100': isOpen,
			'grid-rows-[0fr] opacity-0': !isOpen
		})}
	>
		<div class="overflow-hidden">
			<p class="pb-4 text-sm text-muted-foreground">{answer}</p>
		</div>
	</div>
</div>
