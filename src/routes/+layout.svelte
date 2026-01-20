<script lang="ts">
	import './layout.css';
	import logo from '$lib/assets/logo.png';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children, data } = $props();

	onMount(() => {
		const {
			data: { subscription }
		} = data.supabase.auth.onAuthStateChange((_, newSession) => {
			if (newSession?.expires_at !== data.session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

		return () => subscription.unsubscribe();
	});
</script>

<svelte:head>
	<link rel="icon" href={logo} />
	<title>SumGit - Git Milestone Summarizer</title>
	<meta name="description" content="Summarize milestones in your codebase for X posts" />
</svelte:head>

<div class="dark min-h-screen bg-background text-foreground">
	{@render children()}
</div>
