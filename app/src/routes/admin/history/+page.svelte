<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '#lib/admin/session.svelte.ts';

	type Entry = { id: number; title: string; file_path: string; commit_url: string | null; published_by: string | null; published_at: string };
	let entries = $state<Entry[]>([]);
	let names = $state<Record<string, string>>({});
	let loading = $state(true);

	onMount(async () => {
		const [log, eds] = await Promise.all([
			supabase.from('plan_publishes').select('*').order('published_at', { ascending: false }).limit(100),
			supabase.rpc('list_plan_editors')
		]);
		entries = (log.data ?? []) as Entry[];
		names = Object.fromEntries(((eds.data ?? []) as { user_id: string; email: string }[]).map((e) => [e.user_id, e.email]));
		loading = false;
	});

	const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
</script>

<h1 class="page">Publishing history</h1>
<p class="muted">Every publish is saved as a change on GitHub, so any of them can be undone there.</p>

{#if loading}
	<p class="muted">Loading…</p>
{:else if !entries.length}
	<p class="card">Nothing has been published from the admin yet.</p>
{:else}
	<ul class="list card">
		{#each entries as e (e.id)}
			<li>
				<span>
					<strong>{e.title}</strong><br />
					<span class="muted small">{when(e.published_at)} · {e.published_by ? (names[e.published_by] ?? 'a former editor') : 'unknown'}</span>
				</span>
				{#if e.commit_url}<a class="btn btn-small" href={e.commit_url} target="_blank" rel="noopener">View change</a>{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.small {
		font-size: 14px;
	}
	.list {
		list-style: none;
		margin: 20px 0;
		padding: 0 !important;
		overflow: hidden;
	}
	.list li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding: 14px 18px;
		border-top: 1px solid var(--line);
	}
	.list li:first-child {
		border-top: 0;
	}
</style>
