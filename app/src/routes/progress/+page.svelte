<script lang="ts">
	import { onMount } from 'svelte';
	import { progress, readDates, readIn } from '#lib/reader/progress.svelte.ts';
	import { following, followedPlans, startOf } from '#lib/reader/following.svelte.ts';
	import { shownPlan } from '#lib/reader/chosen.svelte.ts';
	import { loadIndex, loadPlan } from '#lib/reader/plans.svelte.ts';
	import PlanPicker from '#lib/components/PlanPicker.svelte';
	import { bestStreak, bookProgress, currentStreak, planProgress, yearGrid } from '#lib/reader/stats.ts';
	import { localISODate, withDates, type PlanSummary, type PlanV2 } from '#lib/today.ts';

	let today = $state('');
	let index = $state<PlanSummary[]>([]);
	let indexLoaded = $state(false);
	let raw = $state<PlanV2 | null>(null);
	const followed = $derived(today && following.ready ? followedPlans(index, today) : []);
	const shown = $derived(today && following.ready ? shownPlan(index, today) : undefined);
	// The shown plan on the reader's dates (their own, if they've set them).
	const plan = $derived(raw && raw.id === shown?.id ? withDates(raw, startOf(raw.id)) : null);
	const loaded = $derived(indexLoaded && following.ready && (!shown || !!plan));

	onMount(async () => {
		today = localISODate();
		try {
			index = await loadIndex();
		} finally {
			indexLoaded = true;
		}
	});

	$effect(() => {
		const id = shown?.id;
		if (!id || raw?.id === id) return;
		loadPlan(id)
			.then((p) => {
				if (shown?.id === id) raw = p;
			})
			.catch(() => {});
	});

	const year = $derived(today ? Number(today.slice(0, 4)) : 0);
	const grid = $derived(year ? yearGrid(year) : []);
	const rest = $derived(new Set((plan?.schedule ?? []).filter((d) => d.date && d.type !== 'reading').map((d) => d.date!)));
	const read = $derived(plan ? readIn(plan.id) : new Set<number>());
	// Dates read in any dated plan, on each plan's own schedule.
	const dates = $derived(readDates(index, startOf));
	const pct = $derived(plan ? planProgress(plan, read, today) : null);
	const streak = $derived(plan ? currentStreak(plan, read, today) : 0);
	const best = $derived(plan ? bestStreak(plan, read, today) : 0);
	const todayN = $derived(plan?.schedule.find((d) => d.date === today)?.n ?? Infinity);
	const books = $derived(plan ? bookProgress(plan, read).filter((b) => b.firstDay <= todayN) : []);
	const chapters = $derived(books.reduce((n, b) => n + b.done, 0));
	const readThisYear = $derived([...dates].filter((d) => d.startsWith(String(year))).length);

	const cellClass = (date: string | null) => {
		if (!date) return 'blank';
		if (dates.has(date)) return 'read';
		if (date > today) return 'future';
		if (rest.has(date)) return 'rest';
		return 'none';
	};
	const monthLabels = $derived(
		grid.map((week, i) => {
			const first = week.find((d) => d && d.endsWith('-01'));
			return first ? { i, label: new Date(`${first}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) } : null;
		}).filter(Boolean) as { i: number; label: string }[]
	);
</script>

<svelte:head>
	<title>Progress · Redeemer Bible Reading</title>
</svelte:head>

<h1>Your progress</h1>

{#if !loaded || !progress.ready}
	<p class="muted">Loading…</p>
{:else}
	{#if plan && pct}
		<PlanPicker plans={followed} selected={plan.id} />
		<section class="card">
			<div class="row">
				<h2>{plan.title}</h2>
			</div>
			<p class="pct"><strong>{pct.percent}%</strong> <span class="muted">{pct.done} of {pct.due} reading days so far</span></p>
			<div class="bar" role="img" aria-label="{pct.percent} percent of the reading days so far are read"><span style:width="{pct.percent}%"></span></div>
		</section>

		<div class="tiles">
			<div class="tile"><span class="big streak">{streak}</span><span class="muted">current streak</span></div>
			<div class="tile"><span class="big">{best}</span><span class="muted">best streak</span></div>
			<div class="tile"><span class="big">{chapters}</span><span class="muted">chapters read</span></div>
		</div>
	{/if}

	<section class="card">
		<div class="row">
			<h2>{year}</h2>
			<span class="muted small">{readThisYear} day{readThisYear === 1 ? '' : 's'} read</span>
		</div>
		<div class="heat-wrap">
			<div class="months" aria-hidden="true" style:grid-template-columns="repeat({grid.length}, 9px)">
				{#each monthLabels as m (m.i)}<span style:grid-column="{m.i + 1} / span 4">{m.label}</span>{/each}
			</div>
			<div class="heat" role="img" aria-label="Calendar of days read in {year}: {readThisYear} days" style:grid-template-columns="repeat({grid.length}, 9px)">
				{#each grid as week, w (w)}
					{#each week as date, d (d)}<span class="c {cellClass(date)}" title={date ?? ''}></span>{/each}
				{/each}
			</div>
		</div>
		<p class="legend small muted">
			<span class="c read"></span> Read <span class="c rest"></span> Lord’s Day <span class="c none"></span> Not read
		</p>
	</section>

	{#if books.length}
		<section class="card">
			<h2>Books in this plan so far</h2>
			<ul class="books">
				{#each books as b (b.name)}
					<li>
						<div class="row small"><span>{b.name}</span><span class="muted">{b.done === b.total ? 'Complete' : `${b.done} of ${b.total}`}</span></div>
						<div class="bar thin"><span class:done={b.done === b.total} style:width="{Math.round((b.done / b.total) * 100)}%"></span></div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if !progress.session}
		<p class="note">Progress is saved on this device. <a href="/settings/#account">Sign in</a> to keep it everywhere.</p>
	{/if}
{/if}

<style>
	h1 {
		font-family: var(--font-scripture);
		font-weight: 600;
		font-size: 28px;
		margin: 8px 4px 14px;
	}
	h2 {
		margin: 0;
		font-size: 15px;
	}
	.muted {
		color: var(--muted);
	}
	.small {
		font-size: 13px;
	}
	.card {
		background: var(--surface);
		border-radius: 18px;
		padding: 16px;
		margin-bottom: 12px;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	.pct {
		margin: 10px 0;
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}
	.pct strong {
		font-size: 40px;
		color: var(--brand);
		line-height: 1;
	}
	.bar {
		height: 10px;
		border-radius: 5px;
		background: var(--surface-muted);
		overflow: hidden;
	}
	.bar.thin {
		height: 6px;
		margin-top: 4px;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--brand);
		border-radius: inherit;
	}
	.bar span.done {
		background: var(--ok);
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
		margin-bottom: 12px;
	}
	.tile {
		background: var(--surface);
		border-radius: 14px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		font-size: 12px;
	}
	.big {
		font-size: 22px;
		font-weight: 700;
	}
	.big.streak {
		color: var(--streak);
	}
	.heat-wrap {
		overflow-x: auto;
		margin-top: 10px;
		padding-bottom: 4px;
	}
	.months {
		display: grid;
		gap: 2px;
		font-size: 10px;
		color: var(--muted);
		height: 14px;
	}
	.heat {
		display: grid;
		grid-template-rows: repeat(7, 9px);
		grid-auto-flow: column;
		gap: 2px;
		width: max-content;
	}
	.c {
		width: 9px;
		height: 9px;
		border-radius: 2px;
		display: inline-block;
	}
	.c.read {
		background: var(--brand);
	}
	.c.rest {
		background: var(--surface-muted);
		box-shadow: inset 0 0 0 1px var(--line);
	}
	.c.none {
		background: var(--line);
	}
	.c.future {
		background: var(--surface-muted);
		opacity: 0.5;
	}
	.c.blank {
		background: transparent;
	}
	.legend {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 10px 0 0;
		flex-wrap: wrap;
	}
	.legend .c {
		margin-left: 8px;
	}
	.legend .c:first-child {
		margin-left: 0;
	}
	.books {
		list-style: none;
		margin: 10px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.note {
		text-align: center;
		font-size: 14px;
		color: var(--muted);
	}
</style>
