<script lang="ts">
	import { isRead, setRead } from '#lib/reader/progress.svelte.ts';
	import type { Day, PlanSummary } from '#lib/today.ts';

	/** A round check button for one plan day. `big` is the full-width "Mark as read" button. */
	let {
		plan,
		day,
		label,
		big = false
	}: { plan: Pick<PlanSummary, 'id' | 'mode' | 'supplemental' | 'personal'>; day: Pick<Day, 'n' | 'date'>; label: string; big?: boolean } = $props();
	const done = $derived(isRead(plan.id, day.n));
	const toggle = () => setRead(plan, day.n, !done, day.date);
</script>

{#if big}
	<button class="big" class:done aria-pressed={done} onclick={toggle}>
		{#if done}
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
			Read · tap to undo
		{:else}
			Mark as read
		{/if}
	</button>
{:else}
	<button class="dot" class:done aria-pressed={done} aria-label="{label}: {done ? 'read' : 'not read'}" onclick={toggle}>
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
	</button>
{/if}

<style>
	.big {
		width: 100%;
		min-height: 52px;
		border-radius: 14px;
		border: 1.5px solid var(--brand);
		background: var(--brand);
		color: var(--brand-ink);
		font-weight: 600;
		font-size: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		cursor: pointer;
	}
	.big.done {
		background: var(--ok-soft);
		border-color: var(--ok);
		color: var(--ok);
	}
	.dot {
		width: 44px;
		height: 44px;
		flex: none;
		border-radius: 22px;
		border: 0;
		background: transparent;
		display: grid;
		place-items: center;
		cursor: pointer;
		padding: 0;
	}
	.dot svg {
		width: 30px;
		height: 30px;
		padding: 6px;
		border-radius: 15px;
		border: 2px solid var(--line);
		color: transparent;
		box-sizing: border-box;
	}
	.dot.done svg {
		background: var(--brand);
		border-color: var(--brand);
		color: var(--brand-ink);
	}
	.dot:hover:not(.done) svg {
		border-color: var(--brand);
	}
</style>
