import { describe, expect, it, beforeEach } from 'vitest';
import { followedPlans, following, isFollowing } from './following.svelte.ts';
import { withDates, type PlanSummary, type PlanV2 } from '#lib/today.ts';

const church = { id: '2026', file: '', title: '2026', mode: 'church', start: '2026-01-01', end: '2027-01-03', days: 368, current: true } as PlanSummary;
const old = { id: '2025', file: '', title: '2025', mode: 'church', start: '2025-07-07', end: '2026-01-03', days: 181 } as PlanSummary;
const advent = { id: 'advent', file: '', title: 'Advent', mode: 'church', start: '2026-11-29', end: '2026-12-24', days: 26, supplemental: true } as PlanSummary;
const psalms = { id: 'psalms', file: '', title: 'Psalms', mode: 'self-paced', days: 31 } as PlanSummary;
const plans = [church, old, advent, psalms];

describe('following plans', () => {
	beforeEach(() => following.choices.clear());

	it('follows the church plan by default, and nothing else', () => {
		expect(isFollowing(church, church)).toBe(true);
		expect(isFollowing(advent, church)).toBe(false);
		expect(followedPlans(plans, '2026-11-25').map((p) => p.id)).toEqual(['2026']);
	});

	it('lists the church plan first, then plans in the order they were started', () => {
		following.choices.set('psalms', { following: true, start: '2026-11-20' });
		following.choices.set('advent', { following: true });
		expect(followedPlans(plans, '2026-11-25').map((p) => p.id)).toEqual(['2026', 'psalms', 'advent']);
	});

	it('lets a reader stop following the church plan', () => {
		following.choices.set('2026', { following: false });
		following.choices.set('advent', { following: true });
		expect(followedPlans(plans, '2026-11-25').map((p) => p.id)).toEqual(['advent']);
	});

	it('drops plans whose dates are over', () => {
		following.choices.set('advent', { following: true });
		expect(followedPlans(plans, '2026-12-25').map((p) => p.id)).toEqual(['2026']);
	});

	it('dates a plan without dates from the reader’s start', () => {
		const plan = { ...psalms, schedule: [1, 2, 3].map((n) => ({ n, type: 'reading' as const, label: `Psalm ${n}`, refs: [] })) } as PlanV2;
		const dated = withDates(plan, '2026-11-20');
		expect(dated.start).toBe('2026-11-20');
		expect(dated.end).toBe('2026-11-22');
		expect(dated.schedule.map((d) => d.date)).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
		expect(withDates(plan)).toBe(plan);
	});
});
