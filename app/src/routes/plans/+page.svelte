<script lang="ts">
	import { onMount } from 'svelte';
	import { following, isFollowing } from '#lib/reader/following.svelte.ts';
	import { localISODate, planForDate, shortDate, type PlanSummary } from '#lib/today.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const year = (iso: string) => iso.slice(0, 4);

	let today = $state('');
	onMount(() => (today = localISODate()));
	const church = $derived(today ? planForDate(data.plans, today) : undefined);
	// Until the reader's date and plans are known, list everything as before.
	const groups = $derived.by((): { title: string; plans: PlanSummary[] }[] => {
		if (!today || !following.ready) return [{ title: '', plans: data.plans }];
		const ended = (p: PlanSummary) => !!p.end && p.end < today;
		const on = data.plans.filter((p) => !ended(p) && isFollowing(p, church));
		const more = data.plans.filter((p) => !ended(p) && !isFollowing(p, church));
		return [
			{ title: 'Following', plans: on },
			{ title: 'More plans', plans: more },
			{ title: 'Past church plans', plans: data.plans.filter(ended) }
		].filter((g) => g.plans.length);
	});
</script>

<svelte:head>
	<title>Reading plans · Redeemer Bible Reading</title>
	<meta name="description" content="All of Redeemer Church's Bible reading plans." />
</svelte:head>

<h1>All reading plans</h1>
{#each groups as g (g.title)}
{#if g.title}<h2>{g.title}</h2>{/if}
<ul class="plans">
	{#each g.plans as p (p.id)}
		<li>
			<a href="/plan/{p.id}/">
				<span class="title">{p.title}{#if p.id === church?.id}<span class="tag">Church plan</span>{:else if p.supplemental}<span class="tag">Extra</span>{/if}</span>
				<span class="meta">
					{#if p.start && p.end}{shortDate(p.start)}, {year(p.start)} – {shortDate(p.end)}, {year(p.end)}{:else}Start any day{/if}
					· {p.days} days
				</span>
			</a>
		</li>
	{/each}
</ul>
{/each}

<style>
	h2 {
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
		margin: 18px 4px 8px;
	}
	.tag {
		margin-left: 8px;
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--muted);
		vertical-align: 2px;
	}
	h1 {
		font-family: var(--font-scripture);
		font-weight: 600;
		font-size: 28px;
		margin: 8px 4px 16px;
	}
	.plans {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	a {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 14px 16px;
		min-height: 56px;
		border-radius: var(--radius);
		background: var(--surface);
		text-decoration: none;
		color: var(--ink);
	}
	.title {
		font-weight: 600;
	}
	.meta {
		font-size: 14px;
		color: var(--muted);
	}
</style>
