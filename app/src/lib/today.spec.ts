import { describe, expect, it } from 'vitest';
import { addDays, localISODate, planForDate, weekOf, nextPlan, type PlanSummary, type PlanV2 } from './today.ts';

const plan = (id: string, start: string, end: string): PlanSummary => ({ id, file: `${id}.md`, title: id, mode: 'church', start, end, days: 1 });

describe('today helpers', () => {
	it('uses the local calendar date', () => {
		expect(localISODate(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31');
	});

	it('adds days across months and years', () => {
		expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	it('picks the newest plan when two overlap at New Year', () => {
		const plans = [plan('2025-jul-dec', '2025-07-07', '2026-01-03'), plan('2026', '2026-01-01', '2027-01-03')];
		expect(planForDate(plans, '2026-01-02')?.id).toBe('2026');
		expect(planForDate(plans, '2025-12-31')?.id).toBe('2025-jul-dec');
		expect(planForDate(plans, '2027-01-04')).toBeUndefined();
		expect(nextPlan(plans, '2025-12-31')?.id).toBe('2026');
	});

	it('prefers the current plan, skips extra plans, and is stable on ties', () => {
		const a = plan('a', '2027-01-04', '2028-01-02');
		const b = plan('b', '2027-01-04', '2028-01-02');
		const advent = { ...plan('advent', '2027-11-28', '2027-12-24'), supplemental: true as const };
		expect(planForDate([a, { ...b, current: true }], '2027-01-04')?.id).toBe('b');
		expect(planForDate([{ ...b, current: true }, a], '2027-01-04')?.id).toBe('b');
		expect(planForDate([b, a], '2027-01-04')?.id).toBe('a');
		expect(planForDate([{ ...a, current: true }, advent], '2027-12-01')?.id).toBe('a');
		// The current plan wins while it runs, even if a newer church plan has started.
		const old = { ...plan('old', '2026-01-01', '2027-01-06'), current: true as const };
		expect(planForDate([old, a], '2027-01-05')?.id).toBe('old');
		expect(planForDate([old, a], '2027-01-07')?.id).toBe('a');
		expect(nextPlan([a, advent], '2027-06-01')).toBeUndefined();
	});

	it('finds the whole week across New Year', () => {
		const schedule = Array.from({ length: 10 }, (_, i) => ({
			n: i + 1,
			date: addDays('2026-12-26', i),
			type: 'reading' as const,
			label: `Day ${i + 1}`,
			refs: []
		}));
		const p = { ...plan('x', '2026-12-26', '2027-01-04'), schedule } as PlanV2;
		const week = weekOf(p, '2026-12-30');
		expect(week.start).toBe('2026-12-27');
		expect(week.end).toBe('2027-01-02');
		expect(week.days).toHaveLength(7);
	});
});
