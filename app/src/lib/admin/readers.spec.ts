import { describe, expect, it } from 'vitest';
import { ago, presence, summarize, type ReaderRow } from './readers.ts';
import { addDays, type PlanV2 } from '#lib/today.ts';

const start = '2026-11-16'; // Monday
const plan: PlanV2 = {
	id: 'p',
	file: 'p.md',
	title: 'P',
	mode: 'church',
	start,
	end: addDays(start, 9),
	days: 10,
	schedule: Array.from({ length: 10 }, (_, i) => ({
		n: i + 1,
		date: addDays(start, i),
		type: i === 6 ? ('lords-day' as const) : ('reading' as const),
		label: `John ${i + 1}`,
		refs: []
	}))
};

const row = (over: Partial<ReaderRow> = {}): ReaderRow => ({
	user_id: 'u',
	email: 'a@example.org',
	created_at: '2026-01-01T00:00:00Z',
	last_sign_in_at: '2026-11-20T00:00:00Z',
	last_active_at: '2026-11-20T00:00:00Z',
	signed_in_devices: 1,
	is_editor: false,
	read_days: [],
	last_read_at: null,
	...over
});

describe('admin readers', () => {
	it('works out progress in the chosen plan from stored check-offs', () => {
		// Today is Wed Nov 25 (day 10). 9 reading days are due by then (day 7 is a Lord's Day).
		const [s] = summarize([row({ read_days: ['11/16/2026', '11/17/2026', '11/24/2026', '11/25/2026', '01/01/2025'] })], plan, '2026-11-25');
		expect(s.plan).toMatchObject({ due: 9, done: 4, behind: 5, total: 4, streak: 2 });
		expect(s.read.has('2025-01-01')).toBe(true);
	});

	it('has no plan figures when no plan is chosen', () => {
		expect(summarize([row()], null, '2026-11-25')[0].plan).toBeNull();
	});

	it('tells signed in, active and signed out apart', () => {
		const now = Date.parse('2026-11-20T00:30:00Z');
		expect(presence(row(), now)).toBe('active');
		expect(presence(row(), now + 3 * 3600_000)).toBe('signed-in');
		expect(presence(row({ signed_in_devices: 0 }), now)).toBe('signed-out');
		expect(presence(row({ last_sign_in_at: null, last_active_at: null, signed_in_devices: 0 }), now)).toBe('never');
	});

	it('says how long ago', () => {
		const now = Date.parse('2026-11-25T12:00:00Z');
		expect(ago(null, now)).toBe('never');
		expect(ago('2026-11-25T11:59:30Z', now)).toBe('just now');
		expect(ago('2026-11-25T11:30:00Z', now)).toBe('30 minutes ago');
		expect(ago('2026-11-24T12:00:00Z', now)).toBe('yesterday');
		expect(ago('2026-11-20T12:00:00Z', now)).toBe('5 days ago');
		expect(ago('2025-03-04T12:00:00Z', now)).toBe('Mar 4, 2025');
	});
});
