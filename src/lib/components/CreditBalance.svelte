<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Coins, Loader2 } from '@lucide/svelte';
	import { onMount } from 'svelte';

	interface Props {
		onclick?: () => void;
	}

	let { onclick }: Props = $props();

	let balance = $state<number | null>(null);
	let loading = $state(true);
	let error = $state(false);

	onMount(async () => {
		await fetchBalance();
	});

	async function fetchBalance() {
		loading = true;
		error = false;
		try {
			const response = await fetch('/api/credits');
			if (response.ok) {
				const data = await response.json();
				balance = data.balance;
			} else {
				error = true;
			}
		} catch {
			error = true;
		} finally {
			loading = false;
		}
	}

	export function refresh() {
		fetchBalance();
	}
</script>

<button
	onclick={onclick}
	class="flex items-center gap-1.5 rounded-md border border-border/40 bg-secondary/50 px-2.5 py-1.5 text-sm transition-colors hover:bg-secondary/80 hover:border-primary/50"
>
	<Coins class="h-4 w-4 text-amber-500" />
	{#if loading}
		<Loader2 class="h-3 w-3 animate-spin text-muted-foreground" />
	{:else if error}
		<span class="text-muted-foreground">--</span>
	{:else}
		<span class="font-medium">{balance}</span>
		<span class="text-muted-foreground hidden sm:inline">credits</span>
	{/if}
</button>
