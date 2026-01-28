<script lang="ts">
	interface Props {
		size?: number;
	}

	let { size = 40 }: Props = $props();
</script>

<svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
	<circle fill="#76C2AF" cx="32" cy="32" r="32"/>
	<g transform="translate(8, 8) scale(2.0)" fill="none" stroke="#FFFFFF" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
		<!-- Document base -->
		<path d="M6 4C6 3.44772 6.44772 3 7 3H14L18 7V20C18 20.5523 17.5523 21 17 21H7C6.44772 21 6 20.5523 6 20V4Z"/>
		<!-- Folded corner -->
		<path d="M14 3V7H18"/>
		<!-- List lines -->
		<path d="M9 12H15"/>
		<path d="M9 15H15"/>
		<path d="M9 18H12"/>
	</g>
</svg>
