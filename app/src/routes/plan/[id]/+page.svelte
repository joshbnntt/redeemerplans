<script lang="ts">
	import ReadToggle from '#lib/components/ReadToggle.svelte';
	import { passageUrl, refLabel } from '#lib/shared/links.js';
	import { prefs } from '#lib/reader/prefs.svelte.ts';
	import { shortDate, shortWeekday } from '#lib/today.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const plan = $derived(data.plan);
</script>

<svelte:head>
	<title>{plan.title} · Redeemer Bible Reading</title>
	<meta name="description" content={plan.description ?? `${plan.title}: ${plan.days} days of Bible reading.`} />
</svelte:head>

<h1>{plan.title}</h1>
{#if plan.description}<p class="desc">{plan.description}</p>{/if}
{#if plan.mode === 'church'}
	<p class="cal"><a href="/cal/{plan.id}.ics">Calendar file for this plan</a> · <a href="/plans/">All plans</a></p>
{/if}

<ol class="days">
	{#each plan.schedule as d (d.n)}
		<li class:restday={d.type !== 'reading'}>
			<span class="when">
				{#if d.date}<span class="dow">{shortWeekday(d.date)}</span> {shortDate(d.date)}{:else}Day {d.n}{/if}
			</span>
			<span class="what">
				{#if d.type !== 'reading' || d.refs.length === 0}
					{d.label}
				{:else}
					{#each d.refs as ref, i (i)}<a href={passageUrl(ref, prefs)} target="_blank" rel="noopener">{refLabel(ref)}</a>{i < d.refs.length - 1 ? ', ' : ''}{/each}
				{/if}
				{#if d.alt}<span class="alt">Alternate: {d.alt.label}</span>{/if}
			</span>
			{#if d.date && d.type === 'reading'}<ReadToggle day={d} {plan} label="Day {d.n}" />{/if}
		</li>
	{/each}
</ol>

<style>
	h1 {
		font-family: var(--font-scripture);
		font-weight: 600;
		font-size: 28px;
		margin: 8px 4px 4px;
	}
	.desc,
	.cal {
		margin: 0 4px 12px;
		color: var(--muted);
	}
	.days {
		list-style: none;
		margin: 0;
		padding: 0;
		background: var(--surface);
		border-radius: var(--radius);
		overflow: hidden;
	}
	li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-top: 1px solid var(--line);
	}
	li:first-child {
		border-top: 0;
	}
	li.restday {
		background: var(--surface-muted);
		color: var(--muted);
		font-style: italic;
	}
	.when {
		width: 92px;
		flex: none;
		font-size: 14px;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.dow {
		font-weight: 600;
	}
	.what {
		flex: 1;
		font-family: var(--font-scripture);
		font-size: 17px;
		min-width: 0;
	}
	.alt {
		display: block;
		font-family: var(--font-ui);
		font-size: 14px;
		color: var(--muted);
	}
</style>
