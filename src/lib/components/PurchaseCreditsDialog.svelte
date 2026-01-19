<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Coins, Check, Loader2, Sparkles } from '@lucide/svelte';
	import { CREDIT_PACKAGES, CREDIT_COSTS } from '$lib/credits';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
	}

	let { open = $bindable(), onOpenChange }: Props = $props();

	let purchasing = $state<string | null>(null);
	let purchaseError = $state<string | null>(null);

	async function purchasePackage(packageId: string) {
		purchasing = packageId;
		purchaseError = null;

		try {
			const response = await fetch('/api/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ packageId })
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to create checkout session');
			}

			const { url } = await response.json();
			if (url) {
				window.location.href = url;
			}
		} catch (err) {
			purchaseError = err instanceof Error ? err.message : 'Failed to start purchase';
		} finally {
			purchasing = null;
		}
	}

	function handleOpenChange(value: boolean) {
		open = value;
		onOpenChange(value);
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="max-w-lg">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<Coins class="h-5 w-5 text-amber-500" />
				Purchase Credits
			</Dialog.Title>
			<Dialog.Description>
				Credits are used to analyze repositories and generate stories.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<!-- Credit costs info -->
			<div class="rounded-lg border border-border/40 bg-secondary/30 p-3">
				<p class="text-sm font-medium mb-2">Credit costs per operation:</p>
				<div class="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
					<div class="flex items-center gap-1">
						<Badge variant="outline" class="text-xs">{CREDIT_COSTS.quick_analyze}</Badge>
						Quick Analysis
					</div>
					<div class="flex items-center gap-1">
						<Badge variant="outline" class="text-xs">{CREDIT_COSTS.timeline_analyze}</Badge>
						Timeline
					</div>
					<div class="flex items-center gap-1">
						<Badge variant="outline" class="text-xs">{CREDIT_COSTS.generate_story}</Badge>
						Story
					</div>
				</div>
			</div>

			{#if purchaseError}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
					{purchaseError}
				</div>
			{/if}

			<!-- Credit packages -->
			<div class="space-y-3">
				{#each CREDIT_PACKAGES as pkg, index}
					<button
						onclick={() => purchasePackage(pkg.id)}
						disabled={purchasing !== null}
						class="flex w-full items-center justify-between rounded-lg border border-border/40 bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-card/80 disabled:opacity-50 disabled:cursor-not-allowed {index === 1 ? 'ring-2 ring-primary/50' : ''}"
					>
						<div class="flex items-center gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
								<Coins class="h-5 w-5 text-amber-500" />
							</div>
							<div>
								<div class="flex items-center gap-2">
									<span class="font-semibold">{pkg.credits} Credits</span>
									{#if index === 1}
										<Badge variant="secondary" class="gap-1 text-xs">
											<Sparkles class="h-3 w-3" />
											Popular
										</Badge>
									{/if}
								</div>
								<p class="text-sm text-muted-foreground">
									{pkg.priceDisplay}
									<span class="text-xs">
										(${(pkg.price / 100 / pkg.credits).toFixed(2)}/credit)
									</span>
								</p>
							</div>
						</div>
						{#if purchasing === pkg.id}
							<Loader2 class="h-5 w-5 animate-spin text-primary" />
						{:else}
							<Button size="sm" variant="outline">
								Buy
							</Button>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<Dialog.Footer>
			<p class="text-xs text-muted-foreground text-center w-full">
				Payments are processed securely via Stripe
			</p>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
