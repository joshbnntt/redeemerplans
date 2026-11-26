<script lang="ts">
	import ReadToggle from '#lib/components/ReadToggle.svelte';
	import PaceControls from '#lib/components/PaceControls.svelte';
	import { passageUrl, refLabel } from '#lib/shared/links.js';
	import { prefs } from '#lib/reader/prefs.svelte.ts';
	import { readIn } from '#lib/reader/progress.svelte.ts';
	import { catchUp } from '#lib/reader/stats.ts';
	import { longDate, type PlanSummary, type PlanV2 } from '#lib/today.ts';

	/**
	 * Today's reading in a plan the reader follows besides the church plan. `plan` is on the
	 * reader's dates; `own` is the plan as published.
	 */
	let { plan, own, today }: { plan: PlanV2; own: PlanSummary; today: string } = $props();
	const day = $derived(plan.schedule.find((d) => d.date === today));
	const missed = $derived(catchUp(plan, readIn(plan.id), today).length);
</script>

<section class="card" aria-labelledby="plan-{plan.id}">
	<div class="head">
		<h2 id="plan-{plan.id}"><a href="/plan/{plan.id}/">{plan.title}</a></h2>
		{#if day}<span class="muted small">Day {day.n} of {plan.days}</span>{/if}
	</div>
	{#if plan.start && today < plan.start}
		<p class="muted">Starts {longDate(plan.start)}.</p>
	{:else if !day}
		<p class="muted">Finished. Well done!</p>
	{:else if day.type !== 'reading'}
		<p class="rest">{day.label}</p>
	{:else}
		<p class="refs">
			{#each day.refs as ref, i (i)}<a href={passageUrl(ref, prefs)} target="_blank" rel="noopener">{refLabel(ref)}</a>{i < day.refs.length - 1 ? ', ' : ''}{/each}
			{#if day.refs.length === 0}{day.label}{/if}
		</p>
		{#if day.alt}<p class="muted small">Alternate: {day.alt.label}</p>{/if}
		<ReadToggle big {day} {plan} label="{plan.title}, today" />
	{/if}
	{#if missed}
		<p class="small"><a href="/plan/{plan.id}/">{missed} day{missed === 1 ? '' : 's'} to catch up</a></p>
		<PaceControls compact {plan} {own} {today} />
	{/if}
</section>

<style>
	.card {
		background: var(--surface);
		border-radius: 20px;
		padding: 18px 20px;
		box-shadow: var(--shadow);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	h2 {
		margin: 0;
		font-size: 16px;
	}
	h2 a {
		color: inherit;
		text-decoration: none;
	}
	p {
		margin: 0;
	}
	.refs {
		font-family: var(--font-scripture);
		font-size: 20px;
		font-weight: 600;
	}
	.refs a {
		color: inherit;
	}
	.rest {
		font-family: var(--font-scripture);
		font-size: 18px;
	}
	.muted {
		color: var(--muted);
	}
	.small {
		font-size: 13px;
	}
</style>
