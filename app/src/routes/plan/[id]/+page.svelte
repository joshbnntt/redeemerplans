<script lang="ts">
	import ReadToggle from '#lib/components/ReadToggle.svelte';
	import { passageUrl, refLabel } from '#lib/shared/links.js';
	import { prefs } from '#lib/reader/prefs.svelte.ts';
	import { onMount } from 'svelte';
	import FollowButton from '#lib/components/FollowButton.svelte';
	import { isFollowing, startOf } from '#lib/reader/following.svelte.ts';
	import { loadIndex } from '#lib/reader/plans.svelte.ts';
	import { localISODate, longDate, planForDate, shortDate, shortWeekday, withDates, type PlanSummary } from '#lib/today.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let today = $state('');
	let church = $state<PlanSummary | undefined>(undefined);
	onMount(async () => {
		today = localISODate();
		church = planForDate(await loadIndex().catch(() => []), today);
	});
	const followed = $derived(!!today && isFollowing(data.plan, church));
	// A plan without dates gets the reader's own once they follow it.
	const plan = $derived(followed ? withDates(data.plan, startOf(data.plan.id)) : data.plan);
	const ended = $derived(!!today && !!data.plan.end && data.plan.end < today);
</script>

<svelte:head>
	<title>{plan.title} · Redeemer Bible Reading</title>
	<meta name="description" content={plan.description ?? `${plan.title}: ${plan.days} days of Bible reading.`} />
</svelte:head>

<h1>{plan.title}</h1>
{#if plan.description}<p class="desc">{plan.description}</p>{/if}
{#if today && !ended}
	<div class="follow">
		<FollowButton plan={data.plan} {church} />
		{#if church?.id === data.plan.id}<span class="muted small">The church’s current plan</span>
		{:else if followed && !data.plan.start && plan.start}<span class="muted small">Started {longDate(plan.start)}</span>{/if}
	</div>
{/if}
{#if data.plan.mode === 'church'}
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
	.follow {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
		margin: 0 4px 12px;
	}
	.muted {
		color: var(--muted);
	}
	.small {
		font-size: 13px;
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
