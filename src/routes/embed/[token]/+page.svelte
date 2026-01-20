<script lang="ts">
	import WidgetContainer from '$lib/components/widgets/WidgetContainer.svelte';
	import WidgetMilestones from '$lib/components/widgets/WidgetMilestones.svelte';
	import WidgetTimeline from '$lib/components/widgets/WidgetTimeline.svelte';
	import WidgetRecap from '$lib/components/widgets/WidgetRecap.svelte';
	import WidgetStory from '$lib/components/widgets/WidgetStory.svelte';
	import WidgetError from '$lib/components/widgets/WidgetError.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.repository.repo_owner}/{data.repository.repo_name} - Sumgit Widget</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<WidgetContainer theme={data.config.theme}>
	{#if data.contentType === 'milestones'}
		<WidgetMilestones
			repository={data.repository}
			milestones={data.milestones}
			showBranding={data.config.showBranding}
		/>
	{:else if data.contentType === 'timeline'}
		<WidgetTimeline
			repository={data.repository}
			milestones={data.milestones}
			showBranding={data.config.showBranding}
		/>
	{:else if data.contentType === 'recap'}
		<WidgetRecap
			repository={data.repository}
			milestones={data.milestones}
			showBranding={data.config.showBranding}
		/>
	{:else if data.contentType === 'story'}
		<WidgetStory
			repository={data.repository}
			story={data.story}
			showBranding={data.config.showBranding}
		/>
	{:else}
		<WidgetError message="Unknown widget type" />
	{/if}
</WidgetContainer>
