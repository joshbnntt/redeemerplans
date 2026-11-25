<script lang="ts">
	import type { Day } from '#lib/today.ts';
	import { addDays, weekday } from '#lib/today.ts';
	import { dayStatus } from '#lib/reader/stats.ts';
	import { readIn } from '#lib/reader/progress.svelte.ts';

	/** Sunday–Saturday dots for the week containing `today`. */
	let { plan, schedule, today }: { plan: string; schedule: Day[]; today: string } = $props();

	const days = $derived.by(() => {
		const sunday = addDays(today, -weekday(today));
		const byDate = new Map(schedule.filter((d) => d.date).map((d) => [d.date!, d]));
		return Array.from({ length: 7 }, (_, i) => {
			const date = addDays(sunday, i);
			const day = byDate.get(date);
			return { date, num: Number(date.slice(8)), letter: 'SMTWTFS'[i], status: day ? dayStatus(day, readIn(plan), today) : 'upcoming' };
		});
	});
	const words = { read: 'read', missed: 'not read', today: 'today', upcoming: '', rest: 'rest day' };
</script>

<ol class="week" aria-label="This week">
	{#each days as d (d.date)}
		<li>
			<span class="letter" aria-hidden="true">{d.letter}</span>
			<span class="num {d.status}" class:is-today={d.date === today}>
				<span class="visually-hidden">{new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}, {words[d.status]}</span>
				<span aria-hidden="true">{d.num}</span>
			</span>
		</li>
	{/each}
</ol>

<style>
	.week {
		list-style: none;
		margin: 0;
		padding: 14px 12px;
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 4px;
		background: var(--surface);
		border-radius: 16px;
	}
	li {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.letter {
		font-size: 11px;
		font-weight: 600;
		color: var(--muted);
	}
	.num {
		width: 34px;
		height: 34px;
		border-radius: 17px;
		display: grid;
		place-items: center;
		font-size: 13px;
		font-weight: 600;
		color: var(--muted);
		box-sizing: border-box;
	}
	.num.read {
		background: var(--brand);
		color: var(--brand-ink);
	}
	.num.missed {
		border: 2px dashed var(--streak);
		color: var(--streak);
	}
	.num.rest {
		background: var(--surface-muted);
	}
	.num.is-today:not(.read) {
		border: 2px solid var(--brand);
		color: var(--brand);
	}
</style>
