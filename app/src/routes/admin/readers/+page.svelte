<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '#lib/admin/session.svelte.ts';
	import { ago, presence, presenceLabel, summarize, type ReaderRow } from '#lib/admin/readers.ts';
	import { niceDate } from '#lib/admin/plans.ts';
	import { loadIndex, loadPlan } from '#lib/reader/plans.svelte.ts';
	import { dayStatus } from '#lib/reader/stats.ts';
	import { localISODate, planForDate, shortDate, type PlanSummary, type PlanV2 } from '#lib/today.ts';

	let rows = $state<ReaderRow[]>([]);
	let plans = $state<PlanSummary[]>([]);
	let planId = $state('');
	let plan = $state<PlanV2 | null>(null);
	let loading = $state(true);
	let failed = $state('');
	let open = $state<string | null>(null);
	let sort = $state<'active' | 'progress' | 'email'>('active');
	const today = localISODate();

	onMount(async () => {
		try {
			const [res, index] = await Promise.all([supabase.rpc('list_readers'), loadIndex()]);
			if (res.error) throw new Error(res.error.message);
			rows = res.data as ReaderRow[];
			plans = index.filter((p) => p.mode === 'church' && p.start && p.start <= today).sort((a, b) => (a.start! < b.start! ? 1 : -1));
			planId = (planForDate(index, today) ?? plans[0])?.id ?? '';
		} catch (e) {
			failed = e instanceof Error ? e.message : 'Couldn’t load readers.';
		} finally {
			loading = false;
		}
	});

	$effect(() => {
		const id = planId;
		if (!id) return void (plan = null);
		loadPlan(id).then((p) => {
			if (planId === id) plan = p;
		});
	});

	// Progress is counted up to today, or up to the plan's last day for a finished plan.
	const asOf = $derived(plan?.end && plan.end < today ? plan.end : today);
	const readers = $derived.by(() => {
		const list = summarize(rows, plan, asOf);
		if (sort === 'email') return list.sort((a, b) => a.email.localeCompare(b.email));
		if (sort === 'progress') return list.sort((a, b) => (b.plan?.percent ?? -1) - (a.plan?.percent ?? -1) || a.email.localeCompare(b.email));
		return list.sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''));
	});
	const counts = $derived({
		total: rows.length,
		signedIn: rows.filter((r) => r.signed_in_devices > 0).length,
		week: rows.filter((r) => r.last_active_at && Date.now() - Date.parse(r.last_active_at) < 7 * 86400_000).length,
		reading: readers.filter((r) => r.plan && r.plan.total > 0).length
	});
	// The last two weeks of the plan, for the strip under each reader.
	const recent = $derived(plan ? plan.schedule.filter((d) => d.date && d.date <= asOf).slice(-14) : []);
</script>

<h1 class="page">Readers</h1>
<p class="muted">Everyone who has signed in to keep track of their reading.</p>

{#if loading}
	<p class="muted">Loading…</p>
{:else if failed}
	<p class="error" role="alert">{failed}</p>
{:else}
	<div class="tiles">
		<div class="tile card"><span class="big">{counts.total}</span><span class="muted">accounts</span></div>
		<div class="tile card"><span class="big">{counts.signedIn}</span><span class="muted">signed in on a device</span></div>
		<div class="tile card"><span class="big">{counts.week}</span><span class="muted">active this week</span></div>
		{#if plan}<div class="tile card"><span class="big">{counts.reading}</span><span class="muted">reading this plan</span></div>{/if}
	</div>

	<div class="controls">
		<label class="field">
			Progress in
			<select bind:value={planId}>
				{#each plans as p (p.id)}<option value={p.id}>{p.title}</option>{/each}
			</select>
		</label>
		<label class="field">
			Sort by
			<select bind:value={sort}>
				<option value="active">Last active</option>
				<option value="progress">Progress</option>
				<option value="email">Email</option>
			</select>
		</label>
	</div>
	{#if plan}
		<p class="muted small">
			{niceDate(plan.start!)} – {niceDate(plan.end!)} · counting reading days up to {asOf === today ? 'today' : niceDate(asOf)}
		</p>
	{/if}

	<ul class="list card">
		{#each readers as r (r.user_id)}
			{@const state = presence(r)}
			<li>
				<button class="row" aria-expanded={open === r.user_id} onclick={() => (open = open === r.user_id ? null : r.user_id)}>
					<span class="who">
						<strong>{r.email}</strong>
						{#if r.is_editor}<span class="pill selfpaced">Editor</span>{/if}
						<br />
						<span class="muted small">
							<span class="dot {state}" aria-hidden="true"></span>{presenceLabel[state]}{state === 'never' ? '' : ` · last active ${ago(r.last_active_at)}`}
						</span>
					</span>
					<span class="prog">
						{#if r.plan}
							<span class="small"><strong>{r.plan.percent}%</strong> <span class="muted">{r.plan.done}/{r.plan.due}</span></span>
							<span class="bar" role="img" aria-label="{r.plan.percent} percent"><span style:width="{r.plan.percent}%"></span></span>
						{/if}
					</span>
				</button>
				{#if open === r.user_id}
					<div class="detail">
						<dl>
							<div><dt>Joined</dt><dd>{niceDate(r.created_at.slice(0, 10))}</dd></div>
							<div><dt>Last signed in</dt><dd>{r.last_sign_in_at ? ago(r.last_sign_in_at) : 'never'}</dd></div>
							<div><dt>Signed in on</dt><dd>{r.signed_in_devices} device{r.signed_in_devices === 1 ? '' : 's'}</dd></div>
							<div><dt>Last check-off</dt><dd>{ago(r.last_read_at)}</dd></div>
							<div><dt>Days checked off (all plans)</dt><dd>{r.read.size}</dd></div>
							{#if r.plan}
								<div><dt>Current streak</dt><dd>{r.plan.streak} day{r.plan.streak === 1 ? '' : 's'}</dd></div>
								<div><dt>Behind</dt><dd>{r.plan.behind ? `${r.plan.behind} day${r.plan.behind === 1 ? '' : 's'}` : 'Caught up'}</dd></div>
							{/if}
						</dl>
						{#if plan && recent.length}
							<p class="muted small">Last {recent.length} days of {plan.title}</p>
							<div class="strip">
								{#each recent as d (d.n)}
									{@const s = dayStatus(d, r.read, asOf)}
									<span class="cell {s}" title="{shortDate(d.date!)} · {d.label} · {s}"><span>{shortDate(d.date!)}</span></span>
								{/each}
							</div>
							<p class="legend muted small"><span class="cell read"></span> read <span class="cell missed"></span> not read <span class="cell rest"></span> Lord’s Day</p>
						{/if}
					</div>
				{/if}
			</li>
		{:else}
			<li class="muted">No one has an account yet.</li>
		{/each}
	</ul>
	<p class="muted small">
		“Signed in” means the account is still signed in on at least one phone or browser. “Active now” means the app was open in the
		last hour or so. People who read without signing in aren’t counted.
	</p>
{/if}

<style>
	.small {
		font-size: 14px;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 12px;
		margin: 20px 0;
	}
	.tile {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.big {
		font-size: 28px;
		font-weight: 700;
	}
	.controls {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}
	.controls .field {
		flex: 0 1 280px;
	}
	.list {
		list-style: none;
		margin: 16px 0;
		padding: 0 !important;
		overflow: hidden;
	}
	.list li {
		border-top: 1px solid var(--line);
	}
	.list li:first-child {
		border-top: 0;
	}
	.list li.muted {
		padding: 14px 18px;
	}
	.row {
		all: unset;
		box-sizing: border-box;
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding: 14px 18px;
		cursor: pointer;
	}
	.row:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: -2px;
	}
	.who {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.prog {
		flex: 0 0 140px;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}
	.bar {
		width: 100%;
		height: 6px;
		border-radius: 3px;
		background: var(--surface-muted);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--brand);
	}
	.dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin-right: 6px;
		background: var(--line);
	}
	.dot.active {
		background: #16a34a;
	}
	.dot.signed-in {
		background: var(--brand);
	}
	.detail {
		padding: 0 18px 16px;
	}
	dl {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 10px 16px;
		margin: 0 0 12px;
	}
	dt {
		font-size: 12px;
		color: var(--muted);
		font-weight: 600;
	}
	dd {
		margin: 2px 0 0;
	}
	.strip {
		display: grid;
		grid-template-columns: repeat(14, 1fr);
		gap: 3px;
		margin: 6px 0;
	}
	.cell {
		display: inline-block;
		min-height: 22px;
		border-radius: 4px;
		background: var(--surface-muted);
		font-size: 10px;
		color: var(--muted);
		text-align: center;
	}
	.strip .cell span {
		visibility: hidden;
	}
	.cell.read {
		background: var(--brand);
	}
	.cell.missed,
	.cell.today {
		background: var(--danger-soft);
	}
	.cell.rest {
		background: var(--surface-muted);
		opacity: 0.5;
	}
	.legend {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.legend .cell {
		width: 14px;
		min-height: 14px;
		margin-left: 8px;
	}
	.legend .cell:first-child {
		margin-left: 0;
	}
	@media (max-width: 640px) {
		.prog {
			flex-basis: 90px;
		}
	}
</style>
