<script lang="ts">
	import { onMount } from 'svelte';
	import InstallPrompt from '#lib/components/InstallPrompt.svelte';
	import ReadToggle from '#lib/components/ReadToggle.svelte';
	import WeekStrip from '#lib/components/WeekStrip.svelte';
	import { passageUrl, refLabel } from '#lib/shared/links.js';
	import { prefs } from '#lib/reader/prefs.svelte.ts';
	import { progress } from '#lib/reader/progress.svelte.ts';
	import { loadPlan } from '#lib/reader/plans.svelte.ts';
	import { catchUp, currentStreak, planProgress } from '#lib/reader/stats.ts';
	import { localISODate, longDate, nextPlan, planForDate, type PlanV2 } from '#lib/today.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Empty until the browser knows the reader's date (the page is generated ahead of time).
	let today = $state('');
	let plan = $state<PlanV2 | null>(null);
	let failed = $state(false);

	const summary = $derived(today ? planForDate(data.plans, today) : undefined);
	const upcoming = $derived(today ? nextPlan(data.plans, today) : undefined);
	const day = $derived(plan?.schedule.find((d) => d.date === today));
	const missed = $derived(plan ? catchUp(plan, progress.read, today) : []);
	const streak = $derived(plan ? currentStreak(plan, progress.read, today) : 0);
	const pct = $derived(plan ? planProgress(plan, progress.read, today) : null);
	const shortDay = (iso: string) =>
		new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

	async function load() {
		today = localISODate();
		const s = planForDate(data.plans, today);
		if (!s) return;
		try {
			plan = await loadPlan(s.id);
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
			<p><a href="/plans/">Browse all plans</a></p>
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
				<p class="muted">Loading…</p>
			{:else if day.type !== 'reading'}
				<p class="rest">{day.label}</p>
				<p class="muted">A day to rest and worship with your church.</p>
			{:else}
				<ul class="passages">
					{#each day.refs as ref (ref.book + ref.chapter + (ref.verses ?? ''))}
						<li>
							<a href={passageUrl(ref, prefs)} target="_blank" rel="noopener">
								<span class="ref">{refLabel(ref)}</span>
								<span class="open">{prefs.app === 'youversion' ? prefs.translation : prefs.app === 'lsb' ? 'LSB' : 'Open'} ↗</span>
							</a>
						</li>
					{/each}
				</ul>
				{#if day.refs.length === 0}<p class="ref">{day.label}</p>{/if}
				{#if day.alt}<p class="alt">Alternate: {day.alt.label}</p>{/if}
				<ReadToggle big date={today} plan={summary.id} label="Today’s reading" />
			{/if}
		</section>

		{#if plan}
			<WeekStrip schedule={plan.schedule} {today} />

			{#if missed.length}
				<section class="card catchup" aria-labelledby="catchup-heading">
					<h2 id="catchup-heading">{missed.length} day{missed.length === 1 ? '' : 's'} to catch up</h2>
					<ul>
						{#each missed as m (m.n)}
							<li>
								<div>
									<p class="when">{shortDay(m.date!)}</p>
									<p class="what">
										{#each m.refs as ref, i (i)}<a href={passageUrl(ref, prefs)} target="_blank" rel="noopener">{refLabel(ref)}</a>{i < m.refs.length - 1 ? ', ' : ''}{/each}
									</p>
								</div>
								<ReadToggle date={m.date!} plan={summary.id} label={shortDay(m.date!)} />
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<div class="tiles">
				<a class="tile" href="/progress/">
					<span class="big streak">{streak}</span>
					<span class="muted">day streak</span>
				</a>
				<a class="tile" href="/progress/">
					<span class="big">{pct?.percent ?? 0}%</span>
					<span class="muted">of the plan so far</span>
				</a>
			</div>

			{#if progress.ready && !progress.session && progress.read.size}
				<p class="note">Your progress is saved on this device. <a href="/settings/#account">Sign in</a> to keep it on all your devices.</p>
			{/if}
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
	.today {
		display: flex;
		flex-direction: column;
		gap: 12px;
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
		margin: 4px 0 0;
		font-style: italic;
	}
	.today .muted {
		margin: 0;
		color: var(--muted);
	}
	.open {
		font-size: 14px;
		font-weight: 600;
		color: var(--brand);
		white-space: nowrap;
	}
	.alt {
		margin: 0;
		color: var(--muted);
	}
	.catchup {
		background: var(--warn-soft);
		box-shadow: none;
		border: 1px solid var(--warn-line);
		padding: 16px;
	}
	.catchup h2 {
		margin: 0 0 6px;
		font-size: 15px;
		color: var(--warn-ink);
	}
	.catchup ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.catchup li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 0;
	}
	.catchup li + li {
		border-top: 1px solid var(--warn-line);
	}
	.catchup p {
		margin: 0;
	}
	.when {
		font-size: 13px;
		font-weight: 600;
		color: var(--warn-ink);
	}
	.what {
		font-family: var(--font-scripture);
		font-size: 16px;
	}
	.what a {
		color: var(--ink);
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}
	.tile {
		background: var(--surface);
		border-radius: 16px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		text-decoration: none;
		color: var(--ink);
		font-size: 13px;
	}
	.big {
		font-size: 26px;
		font-weight: 700;
		color: var(--brand);
	}
	.big.streak {
		color: var(--streak);
	}
	.note {
		margin: 0;
		font-size: 14px;
		color: var(--muted);
		text-align: center;
	}
</style>
