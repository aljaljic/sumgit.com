<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
		CardFooter
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { Input } from '$lib/components/ui/input';
	import * as Dialog from '$lib/components/ui/dialog';
	import {
		User,
		Github,
		Coins,
		CreditCard,
		Trash2,
		Download,
		ExternalLink,
		ArrowLeft,
		Loader2,
		AlertTriangle,
		Building,
		UserCircle
	} from '@lucide/svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import logo from '$lib/assets/logo.png';
	import type { TransactionWithRepo } from './+page.server';

	let { data } = $props();

	let showDeleteDialog = $state(false);
	let deleteConfirmation = $state('');
	let isDeleting = $state(false);
	let deleteError = $state<string | null>(null);

	let isExporting = $state(false);
	let exportError = $state<string | null>(null);

	let isOpeningBilling = $state(false);
	let billingError = $state<string | null>(null);

	const canDelete = $derived(deleteConfirmation === 'DELETE');

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatDateTime(dateString: string) {
		return new Date(dateString).toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getTransactionTypeLabel(type: string) {
		const labels: Record<string, string> = {
			welcome_bonus: 'Welcome Bonus',
			purchase: 'Purchase',
			usage: 'Usage',
			refund: 'Refund',
			admin_adjustment: 'Adjustment'
		};
		return labels[type] || type;
	}

	function getTransactionTypeVariant(
		type: string
	): 'default' | 'secondary' | 'outline' | 'destructive' {
		if (type === 'usage') return 'destructive';
		if (type === 'purchase' || type === 'welcome_bonus') return 'default';
		if (type === 'refund') return 'secondary';
		return 'outline';
	}

	async function openBillingPortal() {
		isOpeningBilling = true;
		billingError = null;

		try {
			const response = await fetch('/api/settings/stripe-portal', {
				method: 'POST'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to open billing portal');
			}

			const { url } = await response.json();
			if (url) {
				window.location.href = url;
			}
		} catch (err) {
			billingError = err instanceof Error ? err.message : 'Failed to open billing portal';
		} finally {
			isOpeningBilling = false;
		}
	}

	async function exportData() {
		isExporting = true;
		exportError = null;

		try {
			const response = await fetch('/api/settings/export-data');

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to export data');
			}

			// Trigger download
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `sumgit-export-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
		} catch (err) {
			exportError = err instanceof Error ? err.message : 'Failed to export data';
		} finally {
			isExporting = false;
		}
	}

	async function deleteAccount() {
		if (!canDelete) return;

		isDeleting = true;
		deleteError = null;

		try {
			const response = await fetch('/api/settings/delete-account', {
				method: 'DELETE'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to delete account');
			}

			// Sign out and redirect to home
			await data.supabase.auth.signOut();
			await invalidateAll();
			goto('/');
		} catch (err) {
			deleteError = err instanceof Error ? err.message : 'Failed to delete account';
		} finally {
			isDeleting = false;
		}
	}

	function handleDeleteDialogChange(open: boolean) {
		showDeleteDialog = open;
		if (!open) {
			deleteConfirmation = '';
			deleteError = null;
		}
	}
</script>

<div class="flex min-h-screen flex-col">
	<!-- Header -->
	<header class="border-b border-border/40 px-4 py-3 sm:px-6 sm:py-4">
		<div class="mx-auto flex max-w-4xl items-center justify-between">
			<div class="flex items-center gap-4">
				<Button href="/dashboard" variant="ghost" size="sm" class="gap-2">
					<ArrowLeft class="h-4 w-4" />
					<span class="hidden sm:inline">Back to Dashboard</span>
				</Button>
			</div>
			<a href="/" class="flex items-center gap-2">
				<img src={logo} alt="SumGit" class="h-7 w-7 sm:h-8 sm:w-8 rounded-md" />
				<span class="text-lg sm:text-xl font-bold tracking-tight">SumGit</span>
			</a>
		</div>
	</header>

	<!-- Main content -->
	<main class="flex-1 px-4 py-8 sm:px-6">
		<div class="mx-auto max-w-4xl space-y-6">
			<div>
				<h1 class="text-2xl font-bold">Settings</h1>
				<p class="text-muted-foreground">Manage your account and preferences</p>
			</div>

			<!-- Profile Section -->
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2">
						<User class="h-5 w-5" />
						Profile
					</CardTitle>
					<CardDescription>Your account information</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="flex items-start gap-4">
						{#if data.user.avatar_url}
							<img
								src={data.user.avatar_url}
								alt="Avatar"
								class="h-16 w-16 rounded-full border border-border"
							/>
						{:else}
							<div
								class="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-muted-foreground"
							>
								<UserCircle class="h-8 w-8" />
							</div>
						{/if}
						<div class="space-y-1">
							{#if data.profile?.github_username}
								<p class="font-medium">{data.profile.github_username}</p>
							{:else if data.user.full_name}
								<p class="font-medium">{data.user.full_name}</p>
							{/if}
							<p class="text-sm text-muted-foreground">{data.user.email}</p>
							{#if data.profile?.created_at}
								<p class="text-xs text-muted-foreground">
									Member since {formatDate(data.profile.created_at)}
								</p>
							{/if}
						</div>
					</div>
				</CardContent>
			</Card>

			<!-- GitHub Integrations Section -->
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2">
						<Github class="h-5 w-5" />
						GitHub Integrations
					</CardTitle>
					<CardDescription>Connected GitHub App installations</CardDescription>
				</CardHeader>
				<CardContent>
					{#if data.installations.length === 0}
						<p class="text-sm text-muted-foreground">No GitHub App installations connected.</p>
					{:else}
						<div class="space-y-3">
							{#each data.installations as installation}
								<div
									class="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/30 p-3"
								>
									<div class="flex items-center gap-3">
										{#if installation.account_type === 'Organization'}
											<Building class="h-5 w-5 text-muted-foreground" />
										{:else}
											<UserCircle class="h-5 w-5 text-muted-foreground" />
										{/if}
										<div>
											<p class="font-medium">{installation.account_login}</p>
											<p class="text-xs text-muted-foreground">
												{installation.account_type} &middot; Connected{' '}
												{formatDate(installation.created_at)}
											</p>
										</div>
									</div>
									<Badge variant="secondary">{installation.account_type}</Badge>
								</div>
							{/each}
						</div>
					{/if}
				</CardContent>
				<CardFooter>
					<Button
						href="https://github.com/settings/installations"
						target="_blank"
						variant="outline"
						size="sm"
						class="gap-2"
					>
						<Github class="h-4 w-4" />
						Manage on GitHub
						<ExternalLink class="h-3 w-3" />
					</Button>
				</CardFooter>
			</Card>

			<!-- Credits Section -->
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2">
						<Coins class="h-5 w-5 text-amber-500" />
						Credits
					</CardTitle>
					<CardDescription>Your credit balance and transaction history</CardDescription>
				</CardHeader>
				<CardContent class="space-y-4">
					<!-- Balance Stats -->
					<div class="grid grid-cols-3 gap-4">
						<div class="rounded-lg border border-border/40 bg-secondary/30 p-3 text-center">
							<p class="text-2xl font-bold text-amber-500">
								{data.creditBalance?.balance ?? 0}
							</p>
							<p class="text-xs text-muted-foreground">Current Balance</p>
						</div>
						<div class="rounded-lg border border-border/40 bg-secondary/30 p-3 text-center">
							<p class="text-2xl font-bold text-green-500">
								{data.creditBalance?.lifetime_purchased ?? 0}
							</p>
							<p class="text-xs text-muted-foreground">Lifetime Purchased</p>
						</div>
						<div class="rounded-lg border border-border/40 bg-secondary/30 p-3 text-center">
							<p class="text-2xl font-bold text-muted-foreground">
								{data.creditBalance?.lifetime_used ?? 0}
							</p>
							<p class="text-xs text-muted-foreground">Lifetime Used</p>
						</div>
					</div>

					<Separator />

					<!-- Transaction History -->
					<div>
						<h4 class="mb-3 font-medium">Transaction History</h4>
						{#if data.transactions.length === 0}
							<p class="text-sm text-muted-foreground">No transactions yet.</p>
						{:else}
							<div class="max-h-64 space-y-2 overflow-y-auto">
								{#each data.transactions as transaction}
									<div
										class="flex items-center justify-between rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-sm"
									>
										<div class="flex items-center gap-3">
											<Badge variant={getTransactionTypeVariant(transaction.transaction_type)}>
												{transaction.amount > 0 ? '+' : ''}{transaction.amount}
											</Badge>
											<div>
												<p class="font-medium">
													{getTransactionTypeLabel(transaction.transaction_type)}
												</p>
												<p class="text-xs text-muted-foreground">
													{#if transaction.repository}
														{transaction.repository.repo_owner}/{transaction.repository.repo_name}
														&middot;
													{/if}
													{formatDateTime(transaction.created_at)}
												</p>
											</div>
										</div>
										<p class="text-xs text-muted-foreground">
											Balance: {transaction.balance_after}
										</p>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</CardContent>
			</Card>

			<!-- Billing Section -->
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2">
						<CreditCard class="h-5 w-5" />
						Billing
					</CardTitle>
					<CardDescription>Manage your payment methods and billing history</CardDescription>
				</CardHeader>
				<CardContent>
					{#if billingError}
						<div
							class="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
						>
							{billingError}
						</div>
					{/if}

					{#if data.stripeCustomer}
						<p class="mb-4 text-sm text-muted-foreground">
							Access the Stripe Customer Portal to manage your payment methods, view invoices, and
							update billing information.
						</p>
						<Button onclick={openBillingPortal} disabled={isOpeningBilling} class="gap-2">
							{#if isOpeningBilling}
								<Loader2 class="h-4 w-4 animate-spin" />
							{:else}
								<ExternalLink class="h-4 w-4" />
							{/if}
							Manage Billing
						</Button>
					{:else}
						<p class="text-sm text-muted-foreground">
							You haven't made any purchases yet. Once you purchase credits, you'll be able to
							manage your billing here.
						</p>
					{/if}
				</CardContent>
			</Card>

			<!-- Danger Zone -->
			<Card class="border-destructive/50">
				<CardHeader>
					<CardTitle class="flex items-center gap-2 text-destructive">
						<AlertTriangle class="h-5 w-5" />
						Danger Zone
					</CardTitle>
					<CardDescription>Irreversible actions</CardDescription>
				</CardHeader>
				<CardContent class="space-y-4">
					{#if exportError}
						<div
							class="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
						>
							{exportError}
						</div>
					{/if}

					<!-- Export Data -->
					<div class="flex items-center justify-between">
						<div>
							<p class="font-medium">Export Data</p>
							<p class="text-sm text-muted-foreground">
								Download all your data as a JSON file
							</p>
						</div>
						<Button onclick={exportData} disabled={isExporting} variant="outline" class="gap-2">
							{#if isExporting}
								<Loader2 class="h-4 w-4 animate-spin" />
							{:else}
								<Download class="h-4 w-4" />
							{/if}
							Export Data
						</Button>
					</div>

					<Separator />

					<!-- Delete Account -->
					<div class="flex items-center justify-between">
						<div>
							<p class="font-medium">Delete Account</p>
							<p class="text-sm text-muted-foreground">
								Permanently delete your account and all associated data
							</p>
						</div>
						<Button
							onclick={() => (showDeleteDialog = true)}
							variant="destructive"
							class="gap-2"
						>
							<Trash2 class="h-4 w-4" />
							Delete Account
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	</main>
</div>

<!-- Delete Account Dialog -->
<Dialog.Root bind:open={showDeleteDialog} onOpenChange={handleDeleteDialogChange}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2 text-destructive">
				<AlertTriangle class="h-5 w-5" />
				Delete Account
			</Dialog.Title>
			<Dialog.Description>
				This action cannot be undone. This will permanently delete your account and remove all
				associated data including:
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<ul class="list-inside list-disc space-y-1 text-sm text-muted-foreground">
				<li>All repositories and milestones</li>
				<li>Generated stories and recaps</li>
				<li>Credit balance and transaction history</li>
				<li>GitHub App installations</li>
				<li>Share tokens and links</li>
			</ul>

			{#if deleteError}
				<div
					class="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
				>
					{deleteError}
				</div>
			{/if}

			<div class="space-y-2">
				<p class="text-sm font-medium">
					Type <span class="font-mono text-destructive">DELETE</span> to confirm:
				</p>
				<Input
					type="text"
					bind:value={deleteConfirmation}
					placeholder="DELETE"
					class="font-mono"
				/>
			</div>
		</div>

		<Dialog.Footer class="gap-2 sm:gap-0">
			<Button onclick={() => (showDeleteDialog = false)} variant="outline">Cancel</Button>
			<Button
				onclick={deleteAccount}
				disabled={!canDelete || isDeleting}
				variant="destructive"
				class="gap-2"
			>
				{#if isDeleting}
					<Loader2 class="h-4 w-4 animate-spin" />
				{:else}
					<Trash2 class="h-4 w-4" />
				{/if}
				Delete Account
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
