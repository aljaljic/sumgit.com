<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Github, Sparkles, Clock, Loader2 } from '@lucide/svelte';
	import { FAQ, FAQItem } from '$lib/components/ui/faq';
	import logo from '$lib/assets/logo.png';
	import MilestoneMarquee from '$lib/components/MilestoneMarquee.svelte';
	import Footer from '$lib/components/Footer.svelte';

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
				<img src={logo} alt="sumgit" class="h-8 w-8 rounded-md" />
				<span class="text-xl font-bold tracking-tight">sumgit</span>
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
				sumgit analyzes your git history and extracts significant milestones worth sharing. Perfect
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
		<div class="mt-20 grid max-w-4xl gap-6 md:grid-cols-3">
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

		<!-- FAQ Section -->
		<div class="mt-20 w-full max-w-2xl">
			<h2 class="mb-8 text-center text-2xl font-bold">Frequently Asked Questions</h2>
			<FAQ class="rounded-lg border border-border/40 bg-card/50 px-6">
				<FAQItem
					question="What permissions does sumgit need?"
					answer="sumgit only requests read-only permissions for your GitHub repositories. We can view your commit history and repository metadata, but we cannot modify your code, push commits, or make any changes to your repositories. Your code stays completely safe."
				/>
				<FAQItem
					question="How does the AI analysis work?"
					answer="Our AI agents analyze your commit messages, timestamps, and patterns to identify significant milestones in your development journey. This includes feature launches, major refactors, performance improvements, and other noteworthy achievements."
				/>
				<FAQItem
					question="Can I choose which repositories to analyze?"
					answer="Yes! After connecting your GitHub account, you can select specific repositories to analyze. You have full control over which projects sumgit can access."
				/>
				<FAQItem
					question="Is my code stored or shared?"
					answer="No. We only analyze your commit metadata (messages, dates, authors). Your actual source code is never stored on our servers or shared with any third parties."
				/>
			</FAQ>
		</div>
	</main>

	<Footer />
</div>
