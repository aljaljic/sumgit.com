<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		Github,
		Plus,
		LogOut,
		FolderGit2,
		Clock,
		ExternalLink,
		Shield,
		Check,
		Lock
	} from '@lucide/svelte';
	import { invalidateAll } from '$app/navigation';
	import logo from '$lib/assets/logo.png';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import CreditBalance from '$lib/components/CreditBalance.svelte';
	import PurchaseCreditsDialog from '$lib/components/PurchaseCreditsDialog.svelte';

	let { data } = $props();
	let showPurchaseDialog = $state(false);
	let showPurchaseSuccess = $state(false);
	let purchasedCredits = $state(0);
	let creditBalanceRef = $state<{ refresh: () => void } | null>(null);
	let isLoadingRepos = $state(false);
	let availableRepos = $state<
		Array<{
			id: number;
			name: string;
			full_name: string;
			owner: { login: string };
			html_url: string;
			description: string | null;
			private: boolean;
			installation_id: number;
		}>
	>([]);
	let showRepoSelector = $state(false);
	let addingRepo = $state<string | null>(null);
	let showInstallationSuccess = $state(false);

	onMount(() => {
		if (data.installationStatus === 'success') {
			showInstallationSuccess = true;
			setTimeout(() => {
				showInstallationSuccess = false;
			}, 5000);
		}

		// Handle purchase success/cancel from Stripe
		const searchParams = new URLSearchParams(window.location.search);
		const purchaseStatus = searchParams.get('purchase');
		const credits = searchParams.get('credits');

		if (purchaseStatus === 'success' && credits) {
			purchasedCredits = parseInt(credits);
			showPurchaseSuccess = true;
			// Refresh credit balance
			setTimeout(() => {
				creditBalanceRef?.refresh();
			}, 500);
			setTimeout(() => {
				showPurchaseSuccess = false;
			}, 5000);
			// Clean up URL
			const url = new URL(window.location.href);
			url.searchParams.delete('purchase');
			url.searchParams.delete('credits');
			window.history.replaceState({}, '', url.toString());
		}
	});

	async function signOut() {
		await data.supabase.auth.signOut();
		await invalidateAll();
		goto('/');
	}

	async function loadGitHubRepos() {
		if (!data.hasInstallation) return;
		isLoadingRepos = true;
		try {
			const response = await fetch('/api/repos');
			if (response.ok) {
				availableRepos = await response.json();
			}
		} catch (error) {
			console.error('Failed to load repos:', error);
		} finally {
			isLoadingRepos = false;
		}
	}

	async function addRepository(repo: {
		full_name: string;
		name: string;
		owner: { login: string };
		html_url: string;
		installation_id: number;
	}) {
		addingRepo = repo.full_name;
		try {
			const response = await fetch('/api/repos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					github_repo_url: repo.html_url,
					repo_name: repo.name,
					repo_owner: repo.owner.login,
					installation_id: repo.installation_id
				})
			});

			if (response.ok) {
				await invalidateAll();
				showRepoSelector = false;
			}
		} catch (error) {
			console.error('Failed to add repo:', error);
		} finally {
			addingRepo = null;
		}
	}

	function toggleRepoSelector() {
		showRepoSelector = !showRepoSelector;
		if (showRepoSelector && availableRepos.length === 0) {
			loadGitHubRepos();
		}
	}

	function installGitHubApp() {
		// Include setup_url to ensure GitHub redirects back to our callback
		const setupUrl = `${window.location.origin}/github/callback`;
		const installUrl = `https://github.com/apps/${data.githubAppName}/installations/new?setup_url=${encodeURIComponent(setupUrl)}`;
		window.location.href = installUrl;
	}

	function verifyInstallation() {
		// Take user to the app's installation page - if already installed, GitHub will show "Configure"
		// Clicking "Configure" will redirect back to our callback with the installation_id
		const setupUrl = `${window.location.origin}/github/callback`;
		const verifyUrl = `https://github.com/apps/${data.githubAppName}/installations/new?setup_url=${encodeURIComponent(setupUrl)}`;
		window.location.href = verifyUrl;
	}

	// Filter out already connected repos
	const filteredRepos = $derived(
		availableRepos.filter(
			(repo) => !data.repositories.some((r) => r.github_repo_url === repo.html_url)
		)
	);
</script>

<div class="flex min-h-screen flex-col">
	<!-- Header -->
	<header class="border-b border-border/40 px-4 py-3 sm:px-6 sm:py-4">
		<div class="mx-auto flex max-w-6xl items-center justify-between">
			<a href="/" class="flex items-center gap-2">
				<img src={logo} alt="sumgit" class="h-7 w-7 sm:h-8 sm:w-8 rounded-md" />
				<span class="text-lg sm:text-xl font-bold tracking-tight">sumgit</span>
			</a>
			<div class="flex items-center gap-2 sm:gap-4">
				{#if data.installations.length > 0}
					<Badge variant="secondary" class="gap-1 hidden sm:flex">
						<Shield class="h-3 w-3" />
						{data.installations.length} installation{data.installations.length > 1 ? 's' : ''}
					</Badge>
				{/if}
				<CreditBalance bind:this={creditBalanceRef} onclick={() => (showPurchaseDialog = true)} />
				<Button onclick={signOut} variant="ghost" size="sm" class="gap-2">
					<LogOut class="h-4 w-4" />
					<span class="hidden sm:inline">Sign out</span>
				</Button>
			</div>
		</div>
	</header>

	<!-- Installation success banner -->
	{#if showInstallationSuccess}
		<div class="border-b border-green-500/20 bg-green-500/10 px-6 py-3">
			<div class="mx-auto flex max-w-6xl items-center gap-2 text-sm text-green-400">
				<Check class="h-4 w-4" />
				GitHub App installed successfully! You can now add repositories.
			</div>
		</div>
	{/if}

	<!-- Purchase success banner -->
	{#if showPurchaseSuccess}
		<div class="border-b border-amber-500/20 bg-amber-500/10 px-6 py-3">
			<div class="mx-auto flex max-w-6xl items-center gap-2 text-sm text-amber-400">
				<Check class="h-4 w-4" />
				Successfully purchased {purchasedCredits} credits! Your balance has been updated.
			</div>
		</div>
	{/if}

	<!-- Main content -->
	<main class="flex-1 px-6 py-8">
		<div class="mx-auto max-w-6xl">
			<!-- GitHub App not installed -->
			{#if !data.hasInstallation}
				<Card class="mb-8 border-emerald-500/30 bg-emerald-500/5">
					<CardHeader>
						<CardTitle class="flex items-center gap-2 text-lg">
							<Github class="h-5 w-5" />
							Install the sumgit GitHub App
						</CardTitle>
						<CardDescription>
							Install our GitHub App to grant read-only access to your repositories. This is
							required to analyze your commits.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div
							class="mb-4 flex items-start gap-3 rounded-lg border border-border/40 bg-background/50 p-4"
						>
							<Shield class="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
							<div>
								<p class="font-medium">Read-only access</p>
								<p class="text-sm text-muted-foreground">
									The app only requests <code class="rounded bg-secondary px-1">contents: read</code
									> permission. It cannot modify your code, create issues, or access any other data.
								</p>
							</div>
						</div>
						<div class="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
							<p class="text-sm text-blue-400">
								<strong>After installing:</strong> GitHub will automatically redirect you back to sumgit.
								If you don't see the redirect, you can manually return to this page.
							</p>
						</div>
						<div class="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
							<p class="text-sm text-amber-400">
								<strong>Already installed?</strong> If you've already installed the app on GitHub,
								click "Verify Installation" to connect it to your account.
							</p>
						</div>
						<div class="flex flex-col gap-2 sm:flex-row">
							<Button onclick={installGitHubApp} class="gap-2">
								<Github class="h-4 w-4" />
								Install GitHub App
							</Button>
							<Button onclick={verifyInstallation} variant="outline" class="gap-2">
								<Check class="h-4 w-4" />
								Verify Installation
							</Button>
						</div>
					</CardContent>
				</Card>
			{:else}
				<div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 class="text-xl sm:text-2xl font-bold">Your Projects</h1>
						<p class="text-muted-foreground text-sm sm:text-base">Connect repositories to analyze milestones</p>
					</div>
					<div class="flex gap-2">
						<Button onclick={installGitHubApp} variant="outline" size="sm" class="gap-2">
							<Github class="h-4 w-4" />
							<span class="hidden sm:inline">Manage App</span>
							<span class="sm:hidden">Manage</span>
						</Button>
						<Button onclick={toggleRepoSelector} class="gap-2" size="sm">
							<Plus class="h-4 w-4" />
							<span class="hidden sm:inline">Add Repository</span>
							<span class="sm:hidden">Add</span>
						</Button>
					</div>
				</div>

				<!-- Repository selector -->
				{#if showRepoSelector}
					<Card class="mb-8 border-border/60 bg-card/50">
						<CardHeader>
							<CardTitle class="flex items-center gap-2 text-lg">
								<Github class="h-5 w-5" />
								Select a Repository
							</CardTitle>
							<CardDescription>
								Choose from repositories where the sumgit app is installed
							</CardDescription>
						</CardHeader>
						<CardContent>
							{#if isLoadingRepos}
								<div class="space-y-3">
									<Skeleton class="h-12 w-full" />
									<Skeleton class="h-12 w-full" />
									<Skeleton class="h-12 w-full" />
								</div>
							{:else if filteredRepos.length === 0}
								<p class="py-4 text-center text-muted-foreground">
									{availableRepos.length === 0
										? 'No repositories found. Make sure the GitHub App has access to at least one repository.'
										: 'All accessible repositories are already connected'}
								</p>
							{:else}
								<div class="max-h-80 space-y-2 overflow-y-auto">
									{#each filteredRepos as repo}
										<button
											onclick={() => addRepository(repo)}
											disabled={addingRepo === repo.full_name}
											class="flex w-full items-center justify-between rounded-lg border border-border/40 bg-background/50 p-3 text-left transition-colors hover:border-primary/50 hover:bg-secondary/50 disabled:opacity-50"
										>
											<div class="flex items-center gap-3">
												<FolderGit2 class="h-5 w-5 text-muted-foreground" />
												<div>
													<div class="flex items-center gap-2">
														<p class="font-medium">{repo.full_name}</p>
														{#if repo.private}
															<Lock class="h-3 w-3 text-muted-foreground" />
														{/if}
													</div>
													{#if repo.description}
														<p class="line-clamp-1 text-sm text-muted-foreground">
															{repo.description}
														</p>
													{/if}
												</div>
											</div>
											{#if addingRepo === repo.full_name}
												<span class="text-sm text-muted-foreground">Adding...</span>
											{:else}
												<Plus class="h-4 w-4 text-muted-foreground" />
											{/if}
										</button>
									{/each}
								</div>
							{/if}
						</CardContent>
					</Card>
				{/if}

				<Separator class="mb-8" />

				<!-- Connected repositories -->
				{#if data.repositories.length === 0}
					<div class="flex flex-col items-center justify-center py-20 text-center">
						<div
							class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/50"
						>
							<FolderGit2 class="h-8 w-8 text-muted-foreground" />
						</div>
						<h3 class="mb-2 text-lg font-semibold">No repositories yet</h3>
						<p class="mb-6 max-w-sm text-muted-foreground">
							Add your first repository to start analyzing milestones
						</p>
						<Button onclick={toggleRepoSelector} variant="outline" class="gap-2">
							<Plus class="h-4 w-4" />
							Add your first repository
						</Button>
					</div>
				{:else}
					<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{#each data.repositories as repo}
							<a
								href="/project/{repo.id}"
								class="group block rounded-lg border border-border/40 bg-card/50 p-5 transition-all hover:border-primary/50 hover:bg-card"
							>
								<div class="mb-3 flex items-start justify-between">
									<div class="flex items-center gap-2">
										<FolderGit2 class="h-5 w-5 text-primary" />
										<span class="font-semibold">{repo.repo_name}</span>
									</div>
									<ExternalLink
										class="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
									/>
								</div>
								<p class="mb-3 text-sm text-muted-foreground">
									{repo.repo_owner}/{repo.repo_name}
								</p>
								<div class="flex items-center gap-2">
									{#if repo.last_analyzed_at}
										<Badge variant="secondary" class="gap-1 text-xs">
											<Clock class="h-3 w-3" />
											Analyzed {new Date(repo.last_analyzed_at).toLocaleDateString()}
										</Badge>
									{:else}
										<Badge variant="outline" class="text-xs">Not analyzed yet</Badge>
									{/if}
								</div>
							</a>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</main>
</div>

<PurchaseCreditsDialog
	bind:open={showPurchaseDialog}
	onOpenChange={(open) => {
		showPurchaseDialog = open;
		if (!open) {
			creditBalanceRef?.refresh();
		}
	}}
/>
