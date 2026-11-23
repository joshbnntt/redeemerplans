<script lang="ts">
	import { onMount } from 'svelte';
	import { listDrafts, type Draft } from '#lib/admin/drafts.ts';
	import { loadAdminPlans, niceDate, scheduleNotes, statusLabel, statusOf, type AdminPlan } from '#lib/admin/plans.ts';
	import { supabase } from '#lib/admin/session.svelte.ts';

	let plans = $state<AdminPlan[]>([]);
	let drafts = $state<Draft[]>([]);
	let recent = $state<{ title: string; file_path: string; published_at: string }[]>([]);
	let builtAt = $state('');
	let loading = $state(true);
	let failed = $state('');

	const order = { live: 0, upcoming: 1, 'self-paced': 3, past: 2 };
	const sorted = $derived(
		[...plans].sort((a, b) => order[statusOf(a)] - order[statusOf(b)] || (b.start ?? '').localeCompare(a.start ?? ''))
	);
	// Only warn about plans people are reading now or soon; the past is the past.
	const notes = $derived(scheduleNotes(plans.filter((p) => ['live', 'upcoming'].includes(statusOf(p)))));
	// Published since this site was last built: going live in a minute or so.
	const pending = $derived(recent.filter((r) => builtAt && r.published_at > builtAt));

	onMount(async () => {
		try {
			const [index, d, log] = await Promise.all([
				loadAdminPlans(),
				listDrafts(),
				supabase.from('plan_publishes').select('title, file_path, published_at').order('published_at', { ascending: false }).limit(5)
			]);
			plans = index.plans;
			builtAt = index.builtAt;
			drafts = d;
			recent = log.data ?? [];
		} catch (e) {
			failed = e instanceof Error ? e.message : 'Something went wrong.';
		} finally {
			loading = false;
		}
	});

	const editHref = (p: AdminPlan) => `/admin/edit/?file=${encodeURIComponent(p.file)}&plan=${encodeURIComponent(p.id)}`;
	const ago = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
</script>

<div class="head">
	<div>
		<h1 class="page">Reading plans</h1>
		<p class="muted">Changes go live about a minute after you publish.</p>
	</div>
	<div class="actions">
		<a class="btn" href="/admin/import/">Paste from spreadsheet</a>
		<a class="btn btn-primary" href="/admin/edit/?new=1">New plan</a>
	</div>
</div>

{#if failed}<p class="error" role="alert">{failed}</p>{/if}

{#each notes as note (note)}
	<div class="banner"><p>{note}</p></div>
{/each}

{#each pending as p (p.published_at)}
	<div class="banner info"><p><strong>{p.title}</strong> was published {ago(p.published_at)}. It will appear here once the site finishes updating.</p></div>
{/each}

{#if drafts.length}
	<section>
		<h2>Drafts</h2>
		<ul class="list">
			{#each drafts as d (d.id)}
				<li>
					<a href="/admin/edit/?draft={d.id}">
						<span class="title">{d.title || 'Untitled plan'}</span>
						<span class="muted small">{d.data.plan.length} days · edited {ago(d.updated_at)}</span>
					</a>
					<span class="pill draft">{d.plan_id ? 'Unpublished changes' : 'New plan'}</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section>
	<h2>Published</h2>
	{#if loading}
		<p class="muted">Loading…</p>
	{:else}
		<ul class="list">
			{#each sorted as p (p.id)}
				{@const status = statusOf(p)}
				<li>
					<a href={editHref(p)}>
						<span class="title">{p.title}</span>
						<span class="muted small">
							{#if p.start && p.end}{niceDate(p.start)} – {niceDate(p.end)}{:else}No fixed dates{/if} · {p.days} days
						</span>
					</a>
					<span class="pills">
						<span class="pill {status === 'self-paced' ? 'selfpaced' : status}">{statusLabel[status]}</span>
						{#if p.current}<span class="pill live">Current</span>{/if}
						{#if p.errors && (status === 'live' || status === 'upcoming')}<span class="pill bad">{p.errors} to fix</span>
						{:else if p.errors || p.notes}<span class="pill note">{p.errors + p.notes} note{p.errors + p.notes === 1 ? '' : 's'}</span>
						{:else}<span class="pill">All good</span>{/if}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		justify-content: space-between;
		align-items: flex-end;
		margin-bottom: 20px;
	}
	.head p {
		margin: 4px 0 0;
	}
	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.banner {
		margin-bottom: 12px;
	}
	.banner.info {
		background: var(--brand-soft);
		border-color: transparent;
		color: var(--ink);
	}
	section {
		margin-top: 24px;
	}
	h2 {
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		margin: 0 0 10px;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 16px;
		overflow: hidden;
	}
	.list li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
		padding: 12px 18px;
		border-top: 1px solid var(--line);
	}
	.list li:first-child {
		border-top: 0;
	}
	.list a {
		flex: 1 1 320px;
		display: flex;
		flex-direction: column;
		text-decoration: none;
		color: var(--ink);
		min-height: 44px;
		justify-content: center;
	}
	.title {
		font-weight: 600;
	}
	.small {
		font-size: 14px;
	}
	.pills {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
</style>
