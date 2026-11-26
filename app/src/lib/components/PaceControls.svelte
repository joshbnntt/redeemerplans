<script lang="ts">
	import { setStart, useOwnDates } from '#lib/reader/following.svelte.ts';
	import { readIn } from '#lib/reader/progress.svelte.ts';
	import { resumeDay, startForDay } from '#lib/reader/stats.ts';
	import { dayDate, daysBetween, isLegacyPlan, longDate, type PlanSummary, type PlanV2 } from '#lib/today.ts';

	/**
	 * "Reset my dates" and "Back to the church schedule" for a followed plan.
	 * `plan` is on the reader's dates; `own` is the plan as published (its own dates, if any).
	 * `compact` shows just the reset button, for catch-up lists.
	 */
	let { plan, own, today, compact = false }: { plan: PlanV2; own: Pick<PlanSummary, 'start' | 'end' | 'mode' | 'supplemental'>; today: string; compact?: boolean } = $props();

	const next = $derived(resumeDay(plan, readIn(plan.id)));
	const nextDate = $derived(next ? dayDate(plan, next)! : undefined);
	// Behind: the next day to read was due before today.
	const behind = $derived(nextDate && nextDate < today ? daysBetween(nextDate, today) : 0);
	const canGoBack = $derived(!!plan.personal && !!own.start && !!own.end && own.end >= today);
	const backLabel = $derived(isLegacyPlan(own) ? 'Back to the church schedule' : 'Back to the plan’s dates');
	let confirmBack = $state(false);
	let editing = $state(false);
	let picked = $state('');
	function openEdit() {
		picked = plan.start ?? today;
		editing = true;
	}
	function saveStart() {
		if (!picked) return;
		// Picking the plan's own start date puts it back on its own dates.
		if (picked === own.start) useOwnDates(plan);
		else setStart(plan, picked);
		editing = false;
	}

	const reset = () => next && setStart(plan, startForDay(next, today));
</script>

{#if compact}
	{#if behind && next}
		<button class="link" onclick={reset}>Reset my dates so day {next} is today</button>
	{/if}
{:else}
	<div class="pace">
		{#if plan.personal && plan.start}
			<p>
				{own.start ? 'You’re reading this plan on your own dates. ' : ''}Day 1 {plan.start <= today ? 'was' : 'is'} {longDate(plan.start)}.
			</p>
		{/if}
		{#if behind && next}
			<p class="muted small">You’re {behind} day{behind === 1 ? '' : 's'} behind. Resetting your dates makes day {next} today, so nothing is overdue.</p>
		{/if}
		{#if editing}
			<form class="edit" onsubmit={(e) => (e.preventDefault(), saveStart())}>
				<label>Day 1 is <input type="date" bind:value={picked} max={today} required /></label>
				<button class="btn" type="submit">Save</button>
				<button class="btn quiet" type="button" onclick={() => (editing = false)}>Cancel</button>
			</form>
		{/if}
		<div class="buttons">
			{#if behind && next}<button class="btn" onclick={reset}>Reset my dates</button>{/if}
			{#if !editing}<button class="btn quiet" onclick={openEdit}>Change start date</button>{/if}
			{#if canGoBack}
				{#if confirmBack}
					<span class="small">Go back to {isLegacyPlan(own) ? 'reading with the church' : 'the plan’s dates'}? Days you’ve read stay read.</span>
					<button class="btn" onclick={() => useOwnDates(plan)}>Yes, go back</button>
					<button class="btn quiet" onclick={() => (confirmBack = false)}>Cancel</button>
				{:else}
					<button class="btn quiet" onclick={() => (confirmBack = true)}>{backLabel}</button>
				{/if}
			{/if}
		</div>
	</div>
{/if}

<style>
	.pace {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0 4px 12px;
	}
	p {
		margin: 0;
	}
	.edit {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.edit input {
		font: inherit;
		min-height: 40px;
		padding: 0 10px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: inherit;
		margin-left: 6px;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.btn {
		min-height: 40px;
		padding: 0 16px;
		border-radius: 999px;
		border: 1.5px solid var(--brand);
		background: var(--brand);
		color: var(--brand-ink);
		font: inherit;
		font-weight: 600;
		font-size: 14px;
		cursor: pointer;
	}
	.btn.quiet {
		background: transparent;
		color: var(--brand);
	}
	.link {
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		color: var(--brand);
		text-decoration: underline;
		cursor: pointer;
		text-align: left;
	}
	.muted {
		color: var(--muted);
	}
	.small {
		font-size: 13px;
	}
</style>
