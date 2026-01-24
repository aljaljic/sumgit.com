<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Camera, Send, Loader2, X, Lock } from '@lucide/svelte';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		repositoryId: string;
	}

	interface Message {
		role: 'user' | 'assistant';
		content: string;
	}

	let { open = $bindable(), onOpenChange, repositoryId }: Props = $props();

	// State
	let isLoading = $state(false);
	let isSending = $state(false);
	let error = $state<string | null>(null);
	let threadId = $state<string | null>(null);
	let messages = $state<Message[]>([]);
	let inputValue = $state('');
	let messagesContainer: HTMLDivElement | null = $state(null);

	// Scroll to bottom when messages change
	$effect(() => {
		if (messages.length > 0 && messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	});

	// Create thread when dialog opens
	$effect(() => {
		if (open && !threadId) {
			createThread();
		}
	});

	async function createThread() {
		isLoading = true;
		error = null;

		try {
			const response = await fetch('/api/chatkit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'create_thread',
					repository_id: repositoryId
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to create thread');
			}

			const data = await response.json();
			threadId = data.thread_id;
			messages = data.messages;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to start conversation';
		} finally {
			isLoading = false;
		}
	}

	async function sendMessage() {
		if (!inputValue.trim() || !threadId || isSending) return;

		const userMessage = inputValue.trim();
		inputValue = '';
		isSending = true;
		error = null;

		// Add user message to UI immediately
		messages = [...messages, { role: 'user', content: userMessage }];

		try {
			const response = await fetch('/api/chatkit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'send_message',
					thread_id: threadId,
					message: userMessage
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to send message');
			}

			const data = await response.json();
			// Add assistant response
			messages = [...messages, ...data.messages];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to send message';
			// Remove the user message on error
			messages = messages.slice(0, -1);
		} finally {
			isSending = false;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	function handleOpenChange(value: boolean) {
		open = value;
		onOpenChange(value);
		if (!value) {
			// Reset state when closing
			threadId = null;
			messages = [];
			error = null;
			inputValue = '';
		}
	}

	function formatMessage(content: string): string {
		// Simple markdown-like formatting
		return content
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			.replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
			.replace(/\n/g, '<br>');
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="max-w-lg max-h-[80vh] flex flex-col">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<Camera class="h-5 w-5 text-emerald-500" />
				Authenticated Screenshots
			</Dialog.Title>
			<Dialog.Description class="flex items-center gap-1 text-xs">
				<Lock class="h-3 w-3" />
				Credentials are encrypted and auto-deleted after 1 hour
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex-1 flex flex-col min-h-0 py-4">
			{#if isLoading}
				<div class="flex-1 flex items-center justify-center">
					<Loader2 class="h-6 w-6 animate-spin text-emerald-500" />
				</div>
			{:else if error && !threadId}
				<div class="flex-1 flex flex-col items-center justify-center gap-4">
					<div
						class="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
					>
						{error}
					</div>
					<Button variant="outline" onclick={createThread}>Try Again</Button>
				</div>
			{:else}
				<!-- Messages -->
				<div
					bind:this={messagesContainer}
					class="flex-1 overflow-y-auto space-y-4 pr-2 min-h-[200px] max-h-[400px]"
				>
					{#each messages as message}
						<div
							class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}"
						>
							<div
								class="max-w-[85%] rounded-lg px-4 py-2 {message.role === 'user'
									? 'bg-primary text-primary-foreground'
									: 'bg-muted'}"
							>
								{@html formatMessage(message.content)}
							</div>
						</div>
					{/each}

					{#if isSending}
						<div class="flex justify-start">
							<div class="bg-muted rounded-lg px-4 py-2">
								<Loader2 class="h-4 w-4 animate-spin" />
							</div>
						</div>
					{/if}
				</div>

				{#if error}
					<div
						class="rounded-lg border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive mt-2"
					>
						{error}
					</div>
				{/if}

				<!-- Input -->
				<div class="flex gap-2 mt-4 pt-4 border-t border-border">
					<input
						type="text"
						bind:value={inputValue}
						onkeydown={handleKeyDown}
						placeholder="Type your message..."
						disabled={isSending}
						class="flex-1 px-3 py-2 text-sm bg-background rounded-md border border-input focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
					/>
					<Button
						onclick={sendMessage}
						disabled={!inputValue.trim() || isSending}
						size="sm"
						class="gap-1"
					>
						{#if isSending}
							<Loader2 class="h-4 w-4 animate-spin" />
						{:else}
							<Send class="h-4 w-4" />
						{/if}
					</Button>
				</div>
			{/if}
		</div>

		<Dialog.Footer>
			<p class="text-xs text-muted-foreground text-center w-full">
				Your credentials are encrypted and never stored in logs
			</p>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
