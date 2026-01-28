<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Code, Copy, Check, Loader2, Trash2, ExternalLink, Sun, Moon, Monitor } from '@lucide/svelte';
	import type { WidgetContentType, WidgetTheme, ShareTokenListItem } from '$lib/types/share';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		repositoryId: string;
		contentType: WidgetContentType;
	}

	let { open = $bindable(), onOpenChange, repositoryId, contentType }: Props = $props();

	// State
	let isCreating = $state(false);
	let isLoading = $state(false);
	let isRevoking = $state<string | null>(null);
	let error = $state<string | null>(null);
	let copied = $state<'iframe' | 'url' | null>(null);

	// Generated embed data
	let embedUrl = $state<string | null>(null);
	let iframeCode = $state<string | null>(null);
	let existingTokens = $state<ShareTokenListItem[]>([]);
	let currentToken = $state<string | null>(null);

	// Config
	let selectedTheme = $state<WidgetTheme>('light');
	let showDate = $state(true);
	let showCommit = $state(true);
	let textColor = $state('');
	let textSize = $state<number | null>(null);

	const CONTENT_TYPE_LABELS: Record<WidgetContentType, string> = {
		milestones: 'Milestones',
		timeline: 'Timeline',
		recap: 'Recap',
		story: 'Story',
		changelog: 'Changelog'
	};

	const THEME_OPTIONS: { value: WidgetTheme; label: string }[] = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'auto', label: 'Auto' }
	];

	function buildEmbedUrls(token: string) {
		const params = new URLSearchParams();
		if (textColor) params.set('textColor', textColor);
		if (textSize !== null) params.set('textSize', `${textSize}px`);
		const queryString = params.toString();
		const baseUrl = `${window.location.origin}/embed/${token}`;
		embedUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;
		iframeCode = `<iframe src="${embedUrl}" width="100%" height="400" frameborder="0" style="border-radius: 8px;"></iframe>`;
	}

	function updateEmbedUrls(token: string) {
		currentToken = token;
		buildEmbedUrls(token);
	}

	// Update URLs when textColor or textSize changes
	$effect(() => {
		// Track these values
		const _color = textColor;
		const _size = textSize;
		if (currentToken) {
			buildEmbedUrls(currentToken);
		}
	});

	// Load existing tokens when dialog opens
	$effect(() => {
		if (open) {
			loadExistingTokens();
		}
	});

	async function loadExistingTokens() {
		isLoading = true;
		try {
			const response = await fetch(`/api/share/list?repository_id=${repositoryId}`);
			if (response.ok) {
				const data = await response.json();
				existingTokens = data.tokens.filter(
					(t: ShareTokenListItem) => t.content_type === contentType && t.is_active
				);
				// If there's an existing token, pre-fill the embed data
				if (existingTokens.length > 0) {
					const token = existingTokens[0];
					const config = token.config as { theme: WidgetTheme; showDate?: boolean; showCommit?: boolean };
					selectedTheme = config?.theme || 'light';
					showDate = config?.showDate ?? true;
					showCommit = config?.showCommit ?? true;
					updateEmbedUrls(token.token);
				}
			}
		} catch (err) {
			console.error('Failed to load tokens:', err);
		} finally {
			isLoading = false;
		}
	}

	async function createEmbed() {
		isCreating = true;
		error = null;

		try {
			const response = await fetch('/api/share/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					repository_id: repositoryId,
					content_type: contentType,
					config: {
						theme: selectedTheme,
						showBranding: true,
						showDate,
						showCommit
					}
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to create embed');
			}

			const data = await response.json();
			updateEmbedUrls(data.token);

			// Reload tokens list
			await loadExistingTokens();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create embed';
		} finally {
			isCreating = false;
		}
	}

	async function revokeToken(token: string) {
		isRevoking = token;
		try {
			const response = await fetch(`/api/share/${token}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				existingTokens = existingTokens.filter((t) => t.token !== token);
				if (embedUrl?.includes(token)) {
					embedUrl = null;
					iframeCode = null;
				}
			}
		} catch (err) {
			console.error('Failed to revoke token:', err);
		} finally {
			isRevoking = null;
		}
	}

	async function copyToClipboard(text: string, type: 'iframe' | 'url') {
		try {
			await navigator.clipboard.writeText(text);
			copied = type;
			setTimeout(() => (copied = null), 2000);
		} catch {
			// Fallback
			const input = document.createElement('textarea');
			input.value = text;
			document.body.appendChild(input);
			input.select();
			document.execCommand('copy');
			document.body.removeChild(input);
			copied = type;
			setTimeout(() => (copied = null), 2000);
		}
	}

	function handleOpenChange(value: boolean) {
		open = value;
		onOpenChange(value);
		if (!value) {
			// Reset state when closing
			error = null;
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="max-w-lg">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<Code class="h-5 w-5 text-purple-500" />
				Embed {CONTENT_TYPE_LABELS[contentType]}
			</Dialog.Title>
			<Dialog.Description>
				Create an embeddable widget to share on external websites.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			{#if isLoading}
				<div class="flex items-center justify-center py-8">
					<Loader2 class="h-6 w-6 animate-spin text-purple-500" />
				</div>
			{:else}
				<!-- Theme Selector -->
				<div>
					<label class="text-sm font-medium mb-2 block">Theme</label>
					<div class="flex gap-2">
						{#each THEME_OPTIONS as option}
							<button
								type="button"
								onclick={() => (selectedTheme = option.value)}
								class="flex items-center gap-2 px-3 py-2 rounded-md border transition-all {selectedTheme ===
								option.value
									? 'border-purple-500 bg-purple-500/10'
									: 'border-border hover:border-purple-500/50'}"
							>
								{#if option.value === 'light'}
									<Sun class="h-4 w-4" />
								{:else if option.value === 'dark'}
									<Moon class="h-4 w-4" />
								{:else}
									<Monitor class="h-4 w-4" />
								{/if}
								<span class="text-sm">{option.label}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Milestones-specific options -->
				{#if contentType === 'milestones'}
					<div class="space-y-3">
						<label class="text-sm font-medium mb-2 block">Display Options</label>

						<div class="flex flex-wrap gap-4">
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									bind:checked={showDate}
									class="h-4 w-4 rounded border-border"
								/>
								<span class="text-sm">Show Date</span>
							</label>

							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									bind:checked={showCommit}
									class="h-4 w-4 rounded border-border"
								/>
								<span class="text-sm">Show Commit</span>
							</label>
						</div>

						<div class="flex items-center gap-3">
							<label class="text-sm">Text Color</label>
							<input
								type="color"
								bind:value={textColor}
								class="h-8 w-12 rounded border border-border cursor-pointer"
							/>
							{#if textColor}
								<button
									type="button"
									onclick={() => textColor = ''}
									class="text-xs text-muted-foreground hover:text-foreground"
								>
									Reset
								</button>
							{/if}
						</div>

						<div class="flex items-center gap-3">
							<label class="text-sm">Text Size</label>
							<input
								type="number"
								bind:value={textSize}
								min="10"
								max="32"
								placeholder="14"
								class="w-20 px-2 py-1 text-sm rounded border border-border"
							/>
							<span class="text-sm text-muted-foreground">px</span>
							{#if textSize !== null}
								<button
									type="button"
									onclick={() => textSize = null}
									class="text-xs text-muted-foreground hover:text-foreground"
								>
									Reset
								</button>
							{/if}
						</div>
					</div>
				{/if}

				{#if error}
					<div
						class="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
					>
						{error}
					</div>
				{/if}

				<!-- Generate/Update Button -->
				{#if !embedUrl}
					<Button onclick={createEmbed} disabled={isCreating} class="w-full gap-2">
						{#if isCreating}
							<Loader2 class="h-4 w-4 animate-spin" />
							Creating...
						{:else}
							<Code class="h-4 w-4" />
							Generate Embed Code
						{/if}
					</Button>
				{:else}
					<!-- Embed URL -->
					<div>
						<label class="text-sm font-medium mb-2 block">Embed URL</label>
						<div class="flex gap-2">
							<input
								type="text"
								readonly
								value={embedUrl}
								class="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border font-mono"
							/>
							<Button variant="outline" size="sm" onclick={() => copyToClipboard(embedUrl!, 'url')}>
								{#if copied === 'url'}
									<Check class="h-4 w-4 text-green-500" />
								{:else}
									<Copy class="h-4 w-4" />
								{/if}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => window.open(embedUrl!, '_blank')}
							>
								<ExternalLink class="h-4 w-4" />
							</Button>
						</div>
					</div>

					<!-- Iframe Code -->
					<div>
						<label class="text-sm font-medium mb-2 block">Iframe Code</label>
						<div class="relative">
							<pre
								class="p-3 bg-muted rounded-md border border-border text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">{iframeCode}</pre>
							<Button
								variant="outline"
								size="sm"
								class="absolute top-2 right-2"
								onclick={() => copyToClipboard(iframeCode!, 'iframe')}
							>
								{#if copied === 'iframe'}
									<Check class="h-4 w-4 text-green-500" />
								{:else}
									<Copy class="h-4 w-4" />
								{/if}
							</Button>
						</div>
					</div>

					<!-- Update Config Button -->
					<Button variant="outline" onclick={createEmbed} disabled={isCreating} class="w-full gap-2">
						{#if isCreating}
							<Loader2 class="h-4 w-4 animate-spin" />
							Updating...
						{:else}
							Update Settings
						{/if}
					</Button>
				{/if}

				<!-- Existing Tokens -->
				{#if existingTokens.length > 0}
					<div class="border-t border-border pt-4">
						<label class="text-sm font-medium mb-2 block text-muted-foreground"
							>Active Embed{existingTokens.length > 1 ? 's' : ''}</label
						>
						<div class="space-y-2">
							{#each existingTokens as token}
								<div
									class="flex items-center justify-between p-3 bg-card rounded-md border border-border"
								>
									<div class="flex items-center gap-2">
										<Badge variant="secondary">{CONTENT_TYPE_LABELS[token.content_type]}</Badge>
										<span class="text-xs text-muted-foreground">
											{token.view_count} view{token.view_count === 1 ? '' : 's'}
										</span>
									</div>
									<Button
										variant="ghost"
										size="sm"
										class="text-destructive hover:text-destructive"
										onclick={() => revokeToken(token.token)}
										disabled={isRevoking === token.token}
									>
										{#if isRevoking === token.token}
											<Loader2 class="h-4 w-4 animate-spin" />
										{:else}
											<Trash2 class="h-4 w-4" />
										{/if}
									</Button>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<Dialog.Footer>
			<p class="text-xs text-muted-foreground text-center w-full">
				Embedding is free and unlimited
			</p>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
