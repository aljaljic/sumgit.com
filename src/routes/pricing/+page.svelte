<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import {
		Coins,
		Zap,
		Clock,
		BookOpen,
		Sparkles,
		Check,
		Gift,
		ArrowLeft,
		Loader2
	} from '@lucide/svelte';
	import logo from '$lib/assets/logo.png';
	import { CREDIT_PACKAGES, CREDIT_COSTS } from '$lib/credits';

	let { data } = $props();

	let purchasing = $state<string | null>(null);
	let purchaseError = $state<string | null>(null);

	async function signInWithGitHub() {
		await data.supabase.auth.signInWithOAuth({
			provider: 'github',
			options: {
				redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/pricing')}`,
				scopes: 'read:user'
			}
		});
	}

	async function purchasePackage(packageId: string) {
		if (!data.isLoggedIn) {
			signInWithGitHub();
			return;
		}

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
</script>

<div class="flex min-h-screen flex-col bg-background">
	<!-- Header -->
	<header class="border-b border-border/40 px-6 py-4">
		<div class="mx-auto flex max-w-6xl items-center justify-between">
			<a href="/" class="flex items-center gap-2">
				<img src={logo} alt="sumgit" class="h-8 w-8 rounded-md" />
				<span class="text-xl font-bold tracking-tight">sumgit</span>
			</a>
			<div class="flex items-center gap-4">
				{#if data.isLoggedIn}
					<Button href="/dashboard" variant="outline" size="sm" class="gap-2">
						<ArrowLeft class="h-4 w-4" />
						Dashboard
					</Button>
				{:else}
					<Button onclick={signInWithGitHub} variant="outline" size="sm">
						Sign in
					</Button>
				{/if}
			</div>
		</div>
	</header>

	<!-- Main content -->
	<main class="flex-1 px-6 py-12">
		<div class="mx-auto max-w-4xl">
			<!-- Hero section -->
			<div class="mb-12 text-center">
				<Badge variant="secondary" class="mb-4 gap-1">
					<Coins class="h-3 w-3" />
					Usage-based pricing
				</Badge>
				<h1 class="mb-4 text-4xl font-bold tracking-tight">
					Pay only for what you use
				</h1>
				<p class="mx-auto max-w-2xl text-lg text-muted-foreground">
					Purchase credits to analyze your repositories and generate stories.
					No subscriptions, no hidden fees.
				</p>
			</div>

			<!-- Free credits banner -->
			<Card class="mb-12 border-emerald-500/30 bg-emerald-500/5">
				<CardContent class="flex items-center gap-4 p-6">
					<div class="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
						<Gift class="h-6 w-6 text-emerald-500" />
					</div>
					<div>
						<h3 class="font-semibold">10 free credits for new users</h3>
						<p class="text-sm text-muted-foreground">
							Sign up and get 10 credits to try all features. No credit card required.
						</p>
					</div>
					{#if !data.isLoggedIn}
						<Button onclick={signInWithGitHub} class="ml-auto">
							Get started free
						</Button>
					{/if}
				</CardContent>
			</Card>

			<!-- Credit costs -->
			<div class="mb-12">
				<h2 class="mb-6 text-2xl font-semibold text-center">How credits work</h2>
				<div class="grid gap-6 md:grid-cols-3">
					<Card class="border-border/40">
						<CardHeader class="pb-3">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
									<Zap class="h-5 w-5 text-blue-500" />
								</div>
								<div>
									<CardTitle class="text-base">Quick Analysis</CardTitle>
									<CardDescription>{CREDIT_COSTS.quick_analyze} credit</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<p class="text-sm text-muted-foreground">
								Analyze your last 100 commits and identify key milestones in your project's development.
							</p>
						</CardContent>
					</Card>

					<Card class="border-border/40">
						<CardHeader class="pb-3">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
									<Clock class="h-5 w-5 text-emerald-500" />
								</div>
								<div>
									<CardTitle class="text-base">Timeline Analysis</CardTitle>
									<CardDescription>{CREDIT_COSTS.timeline_analyze} credits</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<p class="text-sm text-muted-foreground">
								Deep analysis of up to 5,000 commits to create a comprehensive timeline of your project.
							</p>
						</CardContent>
					</Card>

					<Card class="border-border/40">
						<CardHeader class="pb-3">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
									<BookOpen class="h-5 w-5 text-amber-500" />
								</div>
								<div>
									<CardTitle class="text-base">Story Generation</CardTitle>
									<CardDescription>{CREDIT_COSTS.generate_story} credits</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<p class="text-sm text-muted-foreground">
								Transform your milestones into an illustrated fantasy epic with AI-generated artwork.
							</p>
						</CardContent>
					</Card>
				</div>
			</div>

			<Separator class="mb-12" />

			<!-- Credit packages -->
			<div class="mb-12">
				<h2 class="mb-6 text-2xl font-semibold text-center">Credit Packages</h2>

				{#if purchaseError}
					<div class="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
						{purchaseError}
					</div>
				{/if}

				<div class="grid gap-6 md:grid-cols-3">
					{#each CREDIT_PACKAGES as pkg, index}
						<Card class="relative border-border/40 {index === 1 ? 'border-primary/50 ring-2 ring-primary/20' : ''}">
							{#if index === 1}
								<div class="absolute -top-3 left-1/2 -translate-x-1/2">
									<Badge class="gap-1">
										<Sparkles class="h-3 w-3" />
										Most Popular
									</Badge>
								</div>
							{/if}
							<CardHeader class="text-center pb-2">
								<div class="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
									<Coins class="h-8 w-8 text-amber-500" />
								</div>
								<CardTitle class="text-2xl">{pkg.credits} Credits</CardTitle>
								<div class="text-3xl font-bold">{pkg.priceDisplay}</div>
								<CardDescription>
									${(pkg.price / 100 / pkg.credits).toFixed(2)} per credit
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ul class="mb-6 space-y-2 text-sm">
									<li class="flex items-center gap-2">
										<Check class="h-4 w-4 text-emerald-500" />
										<span>{pkg.credits} Quick Analyses</span>
									</li>
									<li class="flex items-center gap-2">
										<Check class="h-4 w-4 text-emerald-500" />
										<span>{Math.floor(pkg.credits / CREDIT_COSTS.timeline_analyze)} Timeline Analyses</span>
									</li>
									<li class="flex items-center gap-2">
										<Check class="h-4 w-4 text-emerald-500" />
										<span>{Math.floor(pkg.credits / CREDIT_COSTS.generate_story)} Story Generations</span>
									</li>
								</ul>
								<Button
									onclick={() => purchasePackage(pkg.id)}
									disabled={purchasing !== null}
									class="w-full"
									variant={index === 1 ? 'default' : 'outline'}
								>
									{#if purchasing === pkg.id}
										<Loader2 class="mr-2 h-4 w-4 animate-spin" />
										Processing...
									{:else}
										{data.isLoggedIn ? 'Purchase' : 'Sign in to purchase'}
									{/if}
								</Button>
							</CardContent>
						</Card>
					{/each}
				</div>
			</div>

			<!-- FAQ -->
			<div class="text-center text-sm text-muted-foreground">
				<p>Payments processed securely via Stripe.</p>
				<p class="mt-2">
					Questions? <a href="mailto:support@sumgit.com" class="underline hover:text-foreground">Contact us</a>
				</p>
			</div>
		</div>
	</main>
</div>
