<script lang="ts">
	import { onMount } from 'svelte';
	import InstallPrompt from '#lib/components/InstallPrompt.svelte';
	import { passageUrl } from '#lib/shared/links.js';
	import { localISODate, longDate, nextPlan, planForDate, shortWeekday, weekOf, type PlanV2 } from '#lib/today.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Empty until the browser knows the reader's date (the page is generated ahead of time).
	let today = $state('');
	let plan = $state<PlanV2 | null>(null);
	let failed = $state(false);

	const summary = $derived(today ? planForDate(data.plans, today) : undefined);
	const upcoming = $derived(today ? nextPlan(data.plans, today) : undefined);
	const day = $derived(plan?.schedule.find((d) => d.date === today));
	const week = $derived(plan && today ? weekOf(plan, today) : null);

	async function load() {
		today = localISODate();
		const s = planForDate(data.plans, today);
		if (!s) return;
		try {
			const res = await fetch(`/api/v2/plans/${s.id}.json`);
			plan = await res.json();
		} catch {
			failed = true;
		}
	}

	onMount(() => {
		load();
		// If the app was left open overnight, move on to the new day when it's opened again.
		const onVisible = () => document.visibilityState === 'visible' && localISODate() !== today && load();
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});
</script>

<svelte:head>
	<title>Today · Redeemer Bible Reading</title>
	<meta name="description" content="Today's Bible reading for Redeemer Church." />
</svelte:head>

<div class="stack">
	{#if !today}
		<section class="card skeleton" aria-busy="true"><span class="visually-hidden">Loading today’s reading…</span></section>
	{:else if !summary}
		<section class="card">
			<h1 class="eyebrow">Today</h1>
			<p class="lead">There’s no church reading plan scheduled for today.</p>
			{#if upcoming}<p>The next plan, <a href="/plan/{upcoming.id}/">{upcoming.title}</a>, starts {longDate(upcoming.start!)}.</p>{/if}
			<p><a href="/plan/">Browse all plans</a></p>
		</section>
	{:else}
		<div>
			<p class="meta">{longDate(today)}</p>
			<p class="meta">{summary.title}{#if day}{` · Day ${day.n} of ${summary.days}`}{/if}</p>
		</div>

		<section class="card today" aria-labelledby="today-heading">
			<h1 id="today-heading" class="eyebrow">Today’s reading</h1>
			{#if failed}
				<p>Couldn’t load today’s reading. Check your connection and try again.</p>
			{:else if !day}
				<p class="skeleton-text">Loading…</p>
			{:else if day.type !== 'reading'}
				<p class="rest">{day.label}</p>
			{:else}
				<ul class="passages">
					{#each day.refs as ref (ref.book + ref.chapter + (ref.verses ?? ''))}
						<li>
							<a href={passageUrl(ref)}>
								<span class="ref">{ref.name} {ref.chapter}{ref.verses ? `:${ref.verses}` : ''}</span>
								<span class="open">Open ↗</span>
							</a>
						</li>
					{/each}
				</ul>
				{#if day.refs.length === 0}<p class="ref">{day.label}</p>{/if}
				{#if day.alt}
					<p class="alt">Alternate: {day.alt.label}</p>
				{/if}
			{/if}
		</section>

		{#if week}
			<section class="card" aria-labelledby="week-heading">
				<h2 id="week-heading" class="eyebrow">This week</h2>
				<ol class="week">
					{#each week.days as d (d.n)}
						<li class:current={d.date === today} class:restday={d.type !== 'reading'}>
							<span class="dow">{shortWeekday(d.date!)}</span>
							<span class="label">{d.label}</span>
						</li>
					{/each}
				</ol>
				<p class="more"><a href="/plan/{summary.id}/">See the whole plan</a></p>
			</section>
		{/if}
	{/if}

	<InstallPrompt />
</div>

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.card {
		background: var(--surface);
		border-radius: 20px;
		padding: 20px;
		box-shadow: var(--shadow);
	}
	.skeleton {
		min-height: 240px;
		background: var(--surface-muted);
		box-shadow: none;
	}
	.eyebrow {
		margin: 0 0 8px;
		font-size: 12px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
		font-weight: 600;
	}
	.meta {
		margin: 0;
		font-size: 14px;
		color: var(--muted);
	}
	.lead {
		font-size: 18px;
		margin: 0 0 8px;
	}
	.passages {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.passages li + li {
		border-top: 1px solid var(--line);
	}
	.passages a {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		min-height: 56px;
		text-decoration: none;
		color: var(--ink);
	}
	.ref,
	.rest {
		font-family: var(--font-scripture);
		font-size: 28px;
		font-weight: 600;
		line-height: 1.2;
	}
	.rest {
		margin: 8px 0;
		font-style: italic;
		color: var(--muted);
	}
	.open {
		font-size: 14px;
		font-weight: 600;
		color: var(--brand);
		white-space: nowrap;
	}
	.alt {
		margin: 12px 0 0;
		color: var(--muted);
	}
	.week {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.week li {
		display: flex;
		gap: 12px;
		align-items: baseline;
		padding: 10px 12px;
		border-radius: 12px;
	}
	.week li.current {
		background: var(--brand-soft);
	}
	.week li.restday .label {
		font-style: italic;
		color: var(--muted);
	}
	.dow {
		width: 36px;
		flex: none;
		font-size: 13px;
		font-weight: 600;
		color: var(--muted);
	}
	.label {
		font-family: var(--font-scripture);
		font-size: 17px;
	}
	.more {
		margin: 12px 0 0;
	}
	.skeleton-text {
		color: var(--muted);
	}
</style>
