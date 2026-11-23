<script lang="ts">
	import { onMount } from 'svelte';
	import ReadToggle from '#lib/components/ReadToggle.svelte';
	import { passageUrl, refLabel } from '#lib/shared/links.js';
	import { prefs } from '#lib/reader/prefs.svelte.ts';
	import { progress } from '#lib/reader/progress.svelte.ts';
	import { loadToday } from '#lib/reader/plans.svelte.ts';
	import { dayStatus } from '#lib/reader/stats.ts';
	import { addDays, localISODate, longDate, weekday, type Day, type PlanSummary, type PlanV2 } from '#lib/today.ts';

	let today = $state('');
	let plan = $state<PlanV2 | null>(null);
	let upcoming = $state<PlanSummary | undefined>(undefined);
	let loaded = $state(false);
	let view = $state<'week' | 'month'>('week');
	let anchor = $state(''); // a date in the week or month being shown
	let picked = $state(''); // selected day in the month view
	let host = $state('');

	onMount(async () => {
		host = location.host;
		today = localISODate();
		anchor = today;
		picked = today;
		try {
			const r = await loadToday(today);
			plan = r.plan;
			upcoming = r.upcoming;
		} finally {
			loaded = true;
		}
	});

	const byDate = $derived(new Map((plan?.schedule ?? []).filter((d) => d.date).map((d) => [d.date!, d])));
	const inPlan = (date: string) => byDate.has(date);

	// Week view
	const weekStart = $derived(anchor ? addDays(anchor, -weekday(anchor)) : '');
	const weekDays = $derived(weekStart ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : []);
	const weekRead = $derived(weekDays.filter((d) => progress.read.has(d) && byDate.get(d)?.type === 'reading').length);
	const weekDue = $derived(weekDays.filter((d) => byDate.get(d)?.type === 'reading').length);

	// Month view
	const monthStart = $derived(anchor ? `${anchor.slice(0, 7)}-01` : '');
	const monthCells = $derived.by(() => {
		if (!monthStart) return [];
		const cells: (string | null)[] = Array(weekday(monthStart)).fill(null);
		for (let d = monthStart; d.slice(0, 7) === monthStart.slice(0, 7); d = addDays(d, 1)) cells.push(d);
		return cells;
	});
	const pickedDay = $derived(byDate.get(picked));

	function move(step: number) {
		if (view === 'week') anchor = addDays(anchor, step * 7);
		else {
			const [y, m] = anchor.split('-').map(Number);
			anchor = new Date(Date.UTC(y, m - 1 + step, 1)).toISOString().slice(0, 10);
			picked = '';
		}
	}
	const canMove = (step: number) => {
		if (!plan?.start || !plan.end) return false;
		if (view === 'week') return step < 0 ? weekStart > plan.start : addDays(weekStart, 6) < plan.end;
		return step < 0 ? monthStart > plan.start : addDays(monthStart, 31).slice(0, 7) <= plan.end.slice(0, 7);
	};

	const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
	const status = (d: Day) => dayStatus(d, progress.read, today);
	const statusText = { read: 'Read', missed: 'Not read', today: 'Today', upcoming: '', rest: '' };
</script>

<svelte:head>
	<title>Plan · Redeemer Bible Reading</title>
	<meta name="description" content="This week's and this month's Bible readings for Redeemer Church." />
</svelte:head>

<div class="head">
	<h1>Plan</h1>
	{#if plan}<a class="all" href="/plan/{plan.id}/">Whole plan</a>{/if}
</div>

{#if !loaded}
	<p class="muted">Loading…</p>
{:else if !plan}
	<section class="card">
		<p>There’s no church reading plan running today.</p>
		{#if upcoming}<p>The next plan, <a href="/plan/{upcoming.id}/">{upcoming.title}</a>, starts {longDate(upcoming.start!)}.</p>{/if}
		<p><a href="/plans/">Browse all plans</a></p>
	</section>
{:else}
	<p class="muted sub">{plan.title}</p>

	<div class="tabs" role="tablist" aria-label="View">
		<button role="tab" aria-selected={view === 'week'} onclick={() => (view = 'week')}>Week</button>
		<button role="tab" aria-selected={view === 'month'} onclick={() => (view = 'month')}>Month</button>
	</div>

	<div class="pager">
		<button class="nav" aria-label="Previous {view}" disabled={!canMove(-1)} onclick={() => move(-1)}>‹</button>
		<div class="title">
			{#if view === 'week'}
				<p class="strong">{fmt(weekStart, { month: 'short', day: 'numeric' })} – {fmt(addDays(weekStart, 6), { month: 'short', day: 'numeric' })}</p>
				<p class="muted small">{weekStart <= today && today <= addDays(weekStart, 6) ? 'This week · ' : ''}{weekRead} of {weekDue} read</p>
			{:else}
				<p class="strong">{fmt(monthStart, { month: 'long', year: 'numeric' })}</p>
			{/if}
		</div>
		<button class="nav" aria-label="Next {view}" disabled={!canMove(1)} onclick={() => move(1)}>›</button>
	</div>
	{#if !(weekStart <= today && today <= addDays(weekStart, 6)) && view === 'week'}
		<p class="back"><button class="link" onclick={() => (anchor = today)}>Back to this week</button></p>
	{/if}

	{#if view === 'week'}
		<ul class="days">
			{#each weekDays as date (date)}
				{@const d = byDate.get(date)}
				<li class:rest={d && d.type !== 'reading'} class:current={date === today} class:outside={!d}>
					<div class="when">
						<span class="dow">{fmt(date, { weekday: 'short' })}</span>
						<span class="num">{Number(date.slice(8))}</span>
					</div>
					<div class="what">
						{#if !d}
							<span class="muted">Not part of this plan</span>
						{:else if d.type !== 'reading' || !d.refs.length}
							<span class="label">{d.label}</span>
						{:else}
							<span class="label">
								{#each d.refs as ref, i (i)}<a href={passageUrl(ref, prefs)} target="_blank" rel="noopener">{refLabel(ref)}</a>{i < d.refs.length - 1 ? ', ' : ''}{/each}
							</span>
							{#if d.alt}<span class="muted small">Alternate: {d.alt.label}</span>{/if}
							{#if statusText[status(d)]}<span class="small state {status(d)}">{statusText[status(d)]}</span>{/if}
						{/if}
					</div>
					{#if d && d.type === 'reading'}<ReadToggle {date} plan={plan.id} label={fmt(date, { weekday: 'long' })} />{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<div class="month" role="grid" aria-label={fmt(monthStart, { month: 'long', year: 'numeric' })}>
			{#each ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as l, i (i)}<span class="wd" aria-hidden="true">{l}</span>{/each}
			{#each monthCells as date, i (i)}
				{#if !date}
					<span></span>
				{:else}
					{@const d = byDate.get(date)}
					<button
						class="cell {d ? status(d) : 'outside'}"
						class:picked={picked === date}
						class:is-today={date === today}
						disabled={!inPlan(date)}
						aria-label="{fmt(date, { weekday: 'long', month: 'long', day: 'numeric' })}{d ? `, ${d.label}` : ''}{d && progress.read.has(date) ? ', read' : ''}"
						onclick={() => (picked = date)}>{Number(date.slice(8))}</button>
				{/if}
			{/each}
		</div>
		<p class="legend small muted">
			<span class="key read"></span> Read <span class="key missed"></span> Not read <span class="key rest"></span> Lord’s Day
		</p>
		{#if pickedDay}
			<section class="card picked-day">
				<div>
					<p class="muted small">{fmt(picked, { weekday: 'long', month: 'long', day: 'numeric' })} · Day {pickedDay.n}</p>
					<p class="label">
						{#if pickedDay.type !== 'reading' || !pickedDay.refs.length}{pickedDay.label}{:else}
							{#each pickedDay.refs as ref, i (i)}<a href={passageUrl(ref, prefs)} target="_blank" rel="noopener">{refLabel(ref)}</a>{i < pickedDay.refs.length - 1 ? ', ' : ''}{/each}
						{/if}
					</p>
				</div>
				{#if pickedDay.type === 'reading'}<ReadToggle date={picked} plan={plan.id} label={fmt(picked, { weekday: 'long' })} />{/if}
			</section>
		{/if}
	{/if}

	{#if host}<p class="cal"><a href="webcal://{host}/feed.ics">Add the church’s reading plans to your calendar</a></p>{/if}
{/if}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin: 8px 4px 0;
	}
	h1 {
		font-family: var(--font-scripture);
		font-weight: 600;
		font-size: 28px;
		margin: 0;
	}
	.all {
		font-weight: 600;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.sub {
		margin: 0 4px 14px;
	}
	.muted {
		color: var(--muted);
	}
	.small {
		font-size: 13px;
	}
	.card {
		background: var(--surface);
		border-radius: 16px;
		padding: 16px;
	}
	.tabs {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		background: var(--surface-muted);
		border-radius: 12px;
		padding: 4px;
		gap: 4px;
	}
	.tabs button {
		min-height: 40px;
		border: 0;
		border-radius: 9px;
		background: transparent;
		color: var(--muted);
		font-weight: 500;
		cursor: pointer;
	}
	.tabs button[aria-selected='true'] {
		background: var(--surface);
		color: var(--ink);
		font-weight: 600;
	}
	.pager {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 14px 0 8px;
	}
	.pager .title {
		text-align: center;
	}
	.pager p {
		margin: 0;
	}
	.strong {
		font-weight: 600;
	}
	.nav {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-size: 20px;
		cursor: pointer;
	}
	.nav:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.back {
		text-align: center;
		margin: 0 0 8px;
	}
	.link {
		border: 0;
		background: none;
		color: var(--brand);
		font-weight: 600;
		cursor: pointer;
		min-height: 36px;
	}
	.days {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.days li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 6px 8px 12px;
		border-radius: 14px;
		background: var(--surface);
		min-height: 56px;
	}
	.days li.current {
		outline: 2px solid var(--brand);
	}
	.days li.rest {
		background: var(--surface-muted);
	}
	.days li.outside {
		opacity: 0.6;
	}
	.when {
		width: 40px;
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.dow {
		font-size: 11px;
		font-weight: 600;
		color: var(--muted);
		text-transform: uppercase;
	}
	.num {
		font-size: 20px;
		font-weight: 700;
	}
	.what {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.label {
		font-family: var(--font-scripture);
		font-size: 17px;
		font-weight: 600;
	}
	.label a {
		color: var(--ink);
	}
	.rest .label {
		font-style: italic;
		color: var(--muted);
		font-weight: 500;
	}
	.state.read {
		color: var(--ok);
	}
	.state.missed {
		color: var(--streak);
	}
	.month {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 6px;
		background: var(--surface);
		border-radius: 16px;
		padding: 12px;
	}
	.wd {
		text-align: center;
		font-size: 11px;
		font-weight: 600;
		color: var(--muted);
	}
	.cell {
		aspect-ratio: 1;
		min-height: 40px;
		border-radius: 10px;
		border: 0;
		background: transparent;
		color: var(--ink);
		font-weight: 600;
		cursor: pointer;
	}
	.cell.read {
		background: var(--brand);
		color: var(--brand-ink);
	}
	/* Gentle: a missed day is a quiet dashed outline, not an alarm. */
	.cell.missed {
		box-shadow: inset 0 0 0 1.5px var(--line);
		border: 1.5px dashed var(--muted);
		color: var(--muted);
	}
	.cell.rest {
		background: var(--surface-muted);
		color: var(--muted);
	}
	.cell.outside {
		color: var(--line);
		cursor: default;
	}
	.cell.is-today:not(.read) {
		box-shadow: inset 0 0 0 2px var(--brand);
	}
	.cell.picked {
		outline: 3px solid var(--brand-soft);
		outline-offset: 1px;
	}
	.legend {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		margin: 10px 4px;
	}
	.key {
		width: 12px;
		height: 12px;
		border-radius: 3px;
		display: inline-block;
		margin-left: 8px;
	}
	.key.read {
		background: var(--brand);
		margin-left: 0;
	}
	.key.missed {
		border: 1.5px dashed var(--muted);
		box-sizing: border-box;
	}
	.key.rest {
		background: var(--surface-muted);
		border: 1px solid var(--line);
	}
	.picked-day {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.picked-day p {
		margin: 0;
	}
	.cal {
		text-align: center;
		margin: 20px 0 0;
	}
</style>
