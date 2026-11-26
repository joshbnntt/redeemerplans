import { describe, expect, it, beforeEach } from 'vitest';
import { endOf, follow, followedPlans, following, isFollowing, setStart, startOf, useOwnDates } from './following.svelte.ts';
import { resumeDay, startForDay } from './stats.ts';
import { isLegacyPlan, withDates, type PlanSummary, type PlanV2 } from '#lib/today.ts';

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

	it('follows a plan on its own dates, or from today when it has none or they are over', async () => {
		await follow(advent, '2026-11-25');
		expect(startOf('advent')).toBeUndefined();
		await follow(psalms, '2026-11-25');
		expect(startOf('psalms')).toBe('2026-11-25');
		await follow(old, '2026-11-25');
		expect(startOf('2025')).toBe('2026-11-25');
		expect(endOf(old)).toBe('2027-05-24');
		expect(followedPlans(plans, '2026-11-25').map((p) => p.id)).toContain('2025');
	});

	it('moves a plan to the reader’s dates and back, keeping its place in the list', async () => {
		await follow(advent, '2026-11-25');
		await follow(psalms, '2026-11-25');
		await setStart(advent, '2026-12-03');
		expect(startOf('advent')).toBe('2026-12-03');
		expect([...following.choices.keys()]).toEqual(['advent', 'psalms']);
		await useOwnDates(advent);
		expect(startOf('advent')).toBeUndefined();
		expect(isFollowing(advent, church)).toBe(true);
	});

	it('marks reader-dated plans so they are never saved by church date', () => {
		const plan = { ...church, schedule: [1, 2, 3].map((n) => ({ n, date: `2026-01-0${n}`, type: 'reading' as const, label: '', refs: [] })) } as PlanV2;
		expect(withDates(plan, '2026-01-01')).toBe(plan);
		const mine = withDates(plan, '2026-02-01');
		expect(mine.personal).toBe(true);
		expect(mine.schedule[2].date).toBe('2026-02-03');
		expect(isLegacyPlan(plan)).toBe(true);
		expect(isLegacyPlan(mine)).toBe(false);
	});

	it('resets dates so the reader picks up after the last day they read', () => {
		const schedule = Array.from({ length: 10 }, (_, i) => ({
			n: i + 1,
			type: i === 6 ? ('lords-day' as const) : ('reading' as const),
			label: '',
			refs: []
		}));
		const plan = { ...psalms, schedule } as PlanV2;
		expect(resumeDay(plan, new Set())).toBe(1);
		// Read 1-3 and 5 (skipped 4): pick up at 6, not back at 4.
		expect(resumeDay(plan, new Set([1, 2, 3, 5]))).toBe(6);
		// Day 7 is a Lord's Day: after reading 6, pick up at 8.
		expect(resumeDay(plan, new Set([6]))).toBe(8);
		expect(resumeDay(plan, new Set([10]))).toBeUndefined();
		expect(startForDay(6, '2026-11-25')).toBe('2026-11-20');
	});
});
