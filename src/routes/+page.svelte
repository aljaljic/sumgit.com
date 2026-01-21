<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Github, Sparkles, Clock, Loader2, BookOpen, Coins, Gift, Zap, Check, FileText, Share2, ExternalLink } from '@lucide/svelte';
	import { FAQ, FAQItem } from '$lib/components/ui/faq';
	import logo from '$lib/assets/logo.png';
	import MilestoneMarquee from '$lib/components/MilestoneMarquee.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { CREDIT_COSTS, CREDIT_PACKAGES } from '$lib/credits';

	let { data } = $props();
	let isConnecting = $state(false);

	async function signInWithGitHub() {
		isConnecting = true;
		// Check if there's a next parameter in the URL (from GitHub app installation)
		const urlParams = new URLSearchParams(window.location.search);
		const next = urlParams.get('next') || '/dashboard';
		
		await data.supabase.auth.signInWithOAuth({
			provider: 'github',
			options: {
				redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
				scopes: 'read:user'
			}
		});
	}
</script>

<div class="flex min-h-screen flex-col">
	<!-- Header -->
	<header class="border-b border-border/40 px-6 py-4">
		<div class="mx-auto flex max-w-6xl items-center justify-between">
			<div class="flex items-center gap-2">
				<img src={logo} alt="SumGit" class="h-8 w-8 rounded-md" />
				<span class="text-xl font-bold tracking-tight">SumGit</span>
			</div>
			{#if data.user}
				<Button href="/dashboard" variant="outline" class="gap-2">
					<Github class="h-4 w-4" />
					{data.user.user_metadata?.user_name ?? 'Dashboard'}
				</Button>
			{:else}
				<Button onclick={signInWithGitHub} variant="outline" class="gap-2" disabled={isConnecting}>
					{#if isConnecting}
						<Loader2 class="h-4 w-4 animate-spin" />
					{:else}
						<Github class="h-4 w-4" />
					{/if}
					Sign in with GitHub
				</Button>
			{/if}
		</div>
	</header>

	<!-- Hero -->
	<main class="flex flex-1 flex-col items-center justify-center px-6 py-20">
		<div class="mx-auto max-w-3xl text-center">
			<!-- Terminal-style badge -->
			<div
				class="mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-4 py-2 text-sm text-muted-foreground"
			>
				<span class="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
				<code>$ git log --milestones</code>
			</div>

			<h1 class="mb-6 text-4xl leading-tight font-bold tracking-tight md:text-6xl">
				Turn your commits into
				<span
					class="bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent"
				>
					stories
				</span>
			</h1>

			<p class="mb-10 text-lg text-muted-foreground md:text-xl">
				SumGit analyzes your git history and extracts significant milestones worth sharing. Perfect
				for building in public.
			</p>

			{#if data.user}
				<Button href="/dashboard" size="lg" class="gap-2 px-8 text-base">
					Go to Dashboard
					<span class="text-lg">→</span>
				</Button>
			{:else}
				<Button onclick={signInWithGitHub} size="lg" class="gap-2 px-8 text-base" disabled={isConnecting}>
					{#if isConnecting}
						<Loader2 class="h-5 w-5 animate-spin" />
						Connecting...
					{:else}
						<Github class="h-5 w-5" />
						Connect your GitHub
					{/if}
				</Button>
			{/if}
		</div>

		<!-- Milestone marquee -->
		<MilestoneMarquee />

		<!-- Features grid -->
		<div class="mt-20 grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-5">
			<div class="rounded-lg border border-border/40 bg-card/50 p-6">
				<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
					<Github class="h-5 w-5 text-primary" />
				</div>
				<h3 class="mb-2 font-semibold">Connect Repos</h3>
				<p class="text-sm text-muted-foreground">
					Link your GitHub repositories with read-only access. Your code stays safe.
				</p>
			</div>

			<div class="rounded-lg border border-border/40 bg-card/50 p-6">
				<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
					<Sparkles class="h-5 w-5 text-primary" />
				</div>
				<h3 class="mb-2 font-semibold">AI Analysis</h3>
				<p class="text-sm text-muted-foreground">
					OpenAI agents scan your commits and identify meaningful milestones automatically.
				</p>
			</div>

			<div class="rounded-lg border border-border/40 bg-card/50 p-6">
				<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
					<Clock class="h-5 w-5 text-primary" />
				</div>
				<h3 class="mb-2 font-semibold">Timeline View</h3>
				<p class="text-sm text-muted-foreground">
					See your project's journey organized by date with ready-to-post summaries.
				</p>
			</div>

			<div class="rounded-lg border border-border/40 bg-card/50 p-6">
				<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
					<BookOpen class="h-5 w-5 text-primary" />
				</div>
				<h3 class="mb-2 font-semibold">Storybook</h3>
				<p class="text-sm text-muted-foreground">
					Transform your milestones into an interactive 3D storybook with AI-generated chapters.
				</p>
			</div>

			<div class="rounded-lg border border-border/40 bg-card/50 p-6">
				<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
					<FileText class="h-5 w-5 text-primary" />
				</div>
				<h3 class="mb-2 font-semibold">Recap</h3>
				<p class="text-sm text-muted-foreground">
					Generate an all-time summary with stats, languages, and shareable highlights.
				</p>
			</div>
		</div>

		<!-- Terminal preview -->
		<div class="mt-20 w-full max-w-2xl">
			<div class="overflow-hidden rounded-lg border border-border/60 bg-zinc-950">
				<div class="flex items-center gap-2 border-b border-border/40 px-4 py-3">
					<div class="h-3 w-3 rounded-full bg-red-500/80"></div>
					<div class="h-3 w-3 rounded-full bg-yellow-500/80"></div>
					<div class="h-3 w-3 rounded-full bg-green-500/80"></div>
					<span class="ml-3 text-xs text-muted-foreground">sumgit --analyze</span>
				</div>
				<div class="p-4 text-sm">
					<p class="text-muted-foreground">
						<span class="text-green-400">→</span> Analyzing myproject/awesome-app...
					</p>
					<p class="mt-2 text-muted-foreground">
						<span class="text-green-400">✓</span> Found 12 milestones across 847 commits
					</p>
					<div class="mt-4 border-l-2 border-emerald-500/50 pl-4">
						<p class="font-semibold text-foreground">2024-01-15</p>
						<p class="text-muted-foreground">Launched v1.0 with full authentication system</p>
						<p class="mt-1 text-xs text-muted-foreground/70">
							"Just shipped auth for awesome-app! OAuth, magic links, and 2FA all working. 3 months
							of work → production. #buildinpublic"
						</p>
					</div>
					<div class="mt-4 border-l-2 border-emerald-500/50 pl-4">
						<p class="font-semibold text-foreground">2024-01-08</p>
						<p class="text-muted-foreground">Performance boost: 3x faster page loads</p>
						<p class="mt-1 text-xs text-muted-foreground/70">
							"Optimized our SvelteKit app—SSR + lazy loading = 3x faster loads. Users are gonna
							love this. #webdev"
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Storybook Demo Section -->
		<div class="mt-20 w-full max-w-4xl">
			<div class="mb-10 text-center">
				<Badge variant="secondary" class="mb-4 gap-1">
					<BookOpen class="h-3 w-3" />
					See it in action
				</Badge>
				<h2 class="mb-3 text-3xl font-bold">Your app, transformed into a shareable narrative</h2>
				<p class="text-muted-foreground">
					Choose from 5 unique narrative styles to bring your project's journey to life
				</p>
			</div>

			<!-- Narrative Styles Grid -->
			<div class="mb-8 grid gap-3 grid-cols-2 md:grid-cols-5">
				<div class="rounded-lg border border-border/40 bg-card/50 p-4 text-center">
					<div class="mb-2 text-2xl">⚔️</div>
					<p class="text-sm font-medium">Fantasy</p>
				</div>
				<div class="rounded-lg border border-border/40 bg-card/50 p-4 text-center">
					<div class="mb-2 text-2xl">🚀</div>
					<p class="text-sm font-medium">Indie Hacker</p>
				</div>
				<div class="rounded-lg border border-border/40 bg-card/50 p-4 text-center">
					<div class="mb-2 text-2xl">🌌</div>
					<p class="text-sm font-medium">Space Opera</p>
				</div>
				<div class="rounded-lg border border-border/40 bg-card/50 p-4 text-center">
					<div class="mb-2 text-2xl">🔍</div>
					<p class="text-sm font-medium">Noir Detective</p>
				</div>
				<div class="rounded-lg border border-border/40 bg-card/50 p-4 text-center col-span-2 md:col-span-1">
					<div class="mb-2 text-2xl">⚡</div>
					<p class="text-sm font-medium">Anime</p>
				</div>
			</div>

			<!-- Demo Link -->
			<div class="text-center">
				<Button
					href="https://sumgit.com/story/SE41ePuoKanh"
					target="_blank"
					variant="outline"
					class="gap-2"
				>
					<BookOpen class="h-4 w-4" />
					View Demo Storybook
					<ExternalLink class="h-4 w-4" />
				</Button>
			</div>
		</div>

		<!-- Embeddable Widgets Section -->
		<div class="mt-20 w-full max-w-4xl">
			<div class="mb-10 text-center">
				<Badge variant="secondary" class="mb-4 gap-1">
					<Share2 class="h-3 w-3" />
					Shareable
				</Badge>
				<h2 class="mb-3 text-3xl font-bold">Embed Anywhere</h2>
				<p class="text-muted-foreground">
					Generate embeddable widgets to showcase your project's journey on your website, portfolio, or README
				</p>
			</div>

			<!-- Embed Example -->
			<div class="rounded-lg border border-border/40 bg-card/50 p-6">
				<p class="mb-4 text-sm text-muted-foreground text-center">
					Live example: PostChad project embed
				</p>
				<div class="rounded-lg overflow-hidden border border-border/40">
					<iframe
						src="https://sumgit.com/embed/A60Z0890sc6hMnMbLNf8x"
						title="PostChad Project Embed"
						class="w-full h-[400px] bg-background"
						loading="lazy"
					></iframe>
				</div>
				<p class="mt-4 text-sm text-muted-foreground text-center">
					Create embeds for timelines, stories, and recaps to share your development journey
				</p>
			</div>
		</div>

		<!-- Pricing Section -->
		<div class="mt-20 w-full max-w-4xl" id="pricing">
			<div class="mb-10 text-center">
				<Badge variant="secondary" class="mb-4 gap-1">
					<Coins class="h-3 w-3" />
					Simple pricing
				</Badge>
				<h2 class="mb-3 text-3xl font-bold">Pay only for what you use</h2>
				<p class="text-muted-foreground">
					No subscriptions. Buy credits and use them whenever you want.
				</p>
			</div>

			<!-- Free credits banner -->
			<div class="mb-8 flex items-center gap-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
					<Gift class="h-5 w-5 text-emerald-500" />
				</div>
				<div>
					<p class="font-semibold">10 free credits for new users</p>
					<p class="text-sm text-muted-foreground">
						Sign up and start analyzing immediately. No credit card required.
					</p>
				</div>
			</div>

			<!-- Credit costs -->
			<div class="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<div class="flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 p-4">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
						<Zap class="h-5 w-5 text-blue-500" />
					</div>
					<div>
						<p class="font-medium">Quick Analysis</p>
						<p class="text-sm text-muted-foreground">{CREDIT_COSTS.quick_analyze} credit</p>
					</div>
				</div>
				<div class="flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 p-4">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
						<Clock class="h-5 w-5 text-emerald-500" />
					</div>
					<div>
						<p class="font-medium">Timeline Analysis</p>
						<p class="text-sm text-muted-foreground">{CREDIT_COSTS.timeline_analyze} credits</p>
					</div>
				</div>
				<div class="flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 p-4">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
						<BookOpen class="h-5 w-5 text-amber-500" />
					</div>
					<div>
						<p class="font-medium">Story Generation</p>
						<p class="text-sm text-muted-foreground">{CREDIT_COSTS.generate_story} credits</p>
					</div>
				</div>
				<div class="flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 p-4">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
						<FileText class="h-5 w-5 text-purple-500" />
					</div>
					<div>
						<p class="font-medium">Recap</p>
						<p class="text-sm text-muted-foreground">{CREDIT_COSTS.generate_recap} credits</p>
					</div>
				</div>
			</div>

			<!-- Credit packages -->
			<div class="grid gap-4 md:grid-cols-3">
				{#each CREDIT_PACKAGES as pkg, index}
					<Card class="relative border-border/40 {index === 1 ? 'border-primary/50 ring-2 ring-primary/20' : ''}">
						{#if index === 1}
							<div class="absolute -top-3 left-1/2 -translate-x-1/2">
								<Badge class="gap-1">
									<Sparkles class="h-3 w-3" />
									Popular
								</Badge>
							</div>
						{/if}
						<CardHeader class="pb-2 text-center">
							<CardTitle class="text-xl">{pkg.credits} Credits</CardTitle>
							<div class="text-2xl font-bold">{pkg.priceDisplay}</div>
							<CardDescription>
								${(pkg.price / 100 / pkg.credits).toFixed(2)} per credit
							</CardDescription>
						</CardHeader>
						<CardContent class="pt-2">
							<ul class="space-y-2 text-sm text-muted-foreground">
								<li class="flex items-center gap-2">
									<Check class="h-4 w-4 text-emerald-500" />
									{pkg.credits} Quick Analyses
								</li>
								<li class="flex items-center gap-2">
									<Check class="h-4 w-4 text-emerald-500" />
									{Math.floor(pkg.credits / CREDIT_COSTS.timeline_analyze)} Timeline Analyses
								</li>
								<li class="flex items-center gap-2">
									<Check class="h-4 w-4 text-emerald-500" />
									{Math.floor(pkg.credits / CREDIT_COSTS.generate_story)} Story Generations
								</li>
								<li class="flex items-center gap-2">
									<Check class="h-4 w-4 text-emerald-500" />
									{Math.floor(pkg.credits / CREDIT_COSTS.generate_recap)} Recaps
								</li>
							</ul>
						</CardContent>
					</Card>
				{/each}
			</div>

			<!-- CTA Button -->
			<div class="mt-8 text-center">
				{#if data.user}
					<Button href="/dashboard" size="lg" class="gap-2 px-8">
						Go to Dashboard
						<span class="text-lg">→</span>
					</Button>
				{:else}
					<Button onclick={signInWithGitHub} size="lg" class="gap-2 px-8" disabled={isConnecting}>
						{#if isConnecting}
							<Loader2 class="h-5 w-5 animate-spin" />
							Connecting...
						{:else}
							<Github class="h-5 w-5" />
							Get Started Free
						{/if}
					</Button>
				{/if}
			</div>

			<p class="mt-6 text-center text-sm text-muted-foreground">
				<a href="/pricing" class="underline hover:text-foreground">View full pricing details</a>
			</p>
		</div>

		<!-- FAQ Section -->
		<div class="mt-20 w-full max-w-2xl">
			<h2 class="mb-8 text-center text-2xl font-bold">Frequently Asked Questions</h2>
			<FAQ class="rounded-lg border border-border/40 bg-card/50 px-6">
				<FAQItem
					question="What permissions does SumGit need?"
					answer="SumGit only requests read-only permissions for your GitHub repositories. We can view your commit history and repository metadata, but we cannot modify your code, push commits, or make any changes to your repositories. Your code stays completely safe."
				/>
				<FAQItem
					question="How does the AI analysis work?"
					answer="Our AI agents analyze your commit messages, timestamps, and patterns to identify significant milestones in your development journey. This includes feature launches, major refactors, performance improvements, and other noteworthy achievements."
				/>
				<FAQItem
					question="Can I choose which repositories to analyze?"
					answer="Yes! After connecting your GitHub account, you can select specific repositories to analyze. You have full control over which projects SumGit can access."
				/>
				<FAQItem
					question="Is my code stored or shared?"
					answer="No. We only analyze your commit metadata (messages, dates, authors). Your actual source code is never stored on our servers or shared with any third parties."
				/>
				<FAQItem
					question="How do credits work?"
					answer="SumGit uses a simple credit system. You get 10 free credits when you sign up. Quick analysis costs 2 credits, timeline analysis costs 5 credits, recap costs 3 credits, and story generation costs 10 credits. You can purchase more credits anytime - no subscriptions required."
				/>
				<FAQItem
					question="Do credits expire?"
					answer="No, your credits never expire. Purchase once and use them whenever you're ready. There are no monthly fees or subscription commitments."
				/>
				<FAQItem
					question="What is the story feature?"
					answer="The story feature transforms your development milestones into an illustrated fantasy epic. Our AI generates a narrative based on your project's journey, complete with custom AI-generated artwork for each chapter. It's a unique way to celebrate and share your coding achievements."
				/>
				<FAQItem
					question="Can I share my generated story?"
					answer="Yes! Each story gets a unique shareable link that you can post on social media, include in your portfolio, or share with your team. Stories are designed to be visually appealing and easy to share."
				/>
				<FAQItem
					question="How many commits can SumGit analyze?"
					answer="Quick analysis covers your last 100 commits - perfect for recent activity. Timeline analysis goes deeper, analyzing up to 5,000 commits to create a comprehensive history of your project's evolution."
				/>
				<FAQItem
					question="Does SumGit work with private repositories?"
					answer="Yes! SumGit works with both public and private repositories. We only request read-only access, and your code is never stored - we only analyze commit metadata."
				/>
			</FAQ>
		</div>
	</main>

	<Footer />
</div>
