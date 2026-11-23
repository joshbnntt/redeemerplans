<script lang="ts">
	import { shortDate } from '#lib/today.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const year = (iso: string) => iso.slice(0, 4);
</script>

<svelte:head>
	<title>Reading plans · Redeemer Bible Reading</title>
	<meta name="description" content="All of Redeemer Church's Bible reading plans." />
</svelte:head>

<h1>Reading plans</h1>
<ul class="plans">
	{#each data.plans as p (p.id)}
		<li>
			<a href="/plan/{p.id}/">
				<span class="title">{p.title}</span>
				<span class="meta">
					{#if p.start && p.end}{shortDate(p.start)}, {year(p.start)} – {shortDate(p.end)}, {year(p.end)}{:else}Start any day{/if}
					· {p.days} days
				</span>
			</a>
		</li>
	{/each}
</ul>

<style>
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
