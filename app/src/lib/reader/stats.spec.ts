import { describe, expect, it } from 'vitest';
import { bestStreak, bookProgress, catchUp, currentStreak, dayStatus, planProgress, yearGrid, fromStored, toStored } from './stats.ts';
import { addDays, type PlanV2 } from '#lib/today.ts';

// Sun Nov 15 2026 … Sat Nov 28: Sundays are Lord's Days.
const start = '2026-11-15';
const plan: PlanV2 = {
	id: 'p',
	file: 'p.md',
	title: 'P',
	mode: 'church',
	start,
	end: addDays(start, 13),
	days: 14,
	schedule: Array.from({ length: 14 }, (_, i) => {
		const date = addDays(start, i);
		const rest = i % 7 === 0;
		return {
			n: i + 1,
			date,
			type: rest ? ('lords-day' as const) : ('reading' as const),
			label: rest ? "Lord's Day" : `John ${i}`,
			refs: rest ? [] : [{ book: 'JHN', name: 'John', chapter: i }]
		};
	})
};
const read = (...dates: string[]) => new Set(dates);

describe('reading stats', () => {
	it('labels each day', () => {
		const r = read('2026-11-16');
		const today = '2026-11-18';
		expect(dayStatus(plan.schedule[1], r, today)).toBe('read');
		expect(dayStatus(plan.schedule[2], r, today)).toBe('missed');
		expect(dayStatus(plan.schedule[3], r, today)).toBe('today');
		expect(dayStatus(plan.schedule[4], r, today)).toBe('upcoming');
		expect(dayStatus(plan.schedule[0], r, today)).toBe('rest');
	});

	it('counts a streak across a Lord’s Day, starting yesterday if today isn’t read yet', () => {
		// Read Fri 20, Sat 21, (Sun 22 rest), Mon 23 → streak 3 on Mon; on Tue before reading, still 3.
		const r = read('2026-11-20', '2026-11-21', '2026-11-23');
		expect(currentStreak(plan, r, '2026-11-23')).toBe(3);
		expect(currentStreak(plan, r, '2026-11-24')).toBe(3);
		expect(currentStreak(plan, r, '2026-11-25')).toBe(0);
	});

	it('finds the best streak', () => {
		const r = read('2026-11-16', '2026-11-17', '2026-11-18', '2026-11-20');
		expect(bestStreak(plan, r, '2026-11-25')).toBe(3);
	});

	it('works out progress and catch-up', () => {
		const r = read('2026-11-16', '2026-11-18');
		expect(planProgress(plan, r, '2026-11-19')).toEqual({ due: 4, done: 2, percent: 50 });
		expect(catchUp(plan, r, '2026-11-19').map((d) => d.date)).toEqual(['2026-11-17']);
	});

	it('counts chapters per book', () => {
		expect(bookProgress(plan, read('2026-11-16'))[0]).toMatchObject({ name: 'John', done: 1, total: 12 });
	});

	it('builds a year grid of whole weeks', () => {
		const g = yearGrid(2026);
		expect(g[0].slice(0, 4)).toEqual([null, null, null, null]); // Jan 1 2026 is a Thursday
		expect(g[0][4]).toBe('2026-01-01');
		expect(g.flat().filter(Boolean)).toHaveLength(365);
	});

	it('converts the stored date format', () => {
		expect(fromStored('11/23/2026')).toBe('2026-11-23');
		expect(toStored('2026-11-23')).toBe('11/23/2026');
	});
});
