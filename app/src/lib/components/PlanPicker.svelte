<script lang="ts">
	import { choosePlan } from '#lib/reader/chosen.svelte.ts';
	import type { PlanSummary } from '#lib/today.ts';

	/** Switches between the plans a reader follows. Shown only when they follow more than one. */
	let { plans, selected }: { plans: PlanSummary[]; selected?: string } = $props();
</script>

{#if plans.length > 1}
	<div class="picker" role="tablist" aria-label="Plan">
		{#each plans as p (p.id)}
			<button role="tab" aria-selected={p.id === selected} onclick={() => choosePlan(p.id)}>{p.title}</button>
		{/each}
	</div>
{/if}

<style>
	.picker {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		margin: 0 0 12px;
		padding: 2px 4px 4px;
		scrollbar-width: none;
	}
	.picker::-webkit-scrollbar {
		display: none;
	}
	button {
		flex: none;
		min-height: 36px;
		padding: 0 14px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: inherit;
		font: inherit;
		font-size: 14px;
		cursor: pointer;
		white-space: nowrap;
	}
	button[aria-selected='true'] {
		background: var(--brand);
		border-color: var(--brand);
		color: var(--brand-ink);
		font-weight: 600;
	}
</style>
