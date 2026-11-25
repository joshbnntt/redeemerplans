/** Readers list for the admin: who has an account, when they were last seen, how far along they are. */
import type { PlanV2 } from '#lib/today.ts';
import { currentStreak, fromStored, planProgress } from '#lib/reader/stats.ts';

export type ReaderRow = {
	user_id: string;
	email: string;
	created_at: string;
	last_sign_in_at: string | null;
	last_active_at: string | null;
	signed_in_devices: number;
	is_editor: boolean;
	/** "MM/DD/YYYY", as stored in `haveread` */
	read_days: string[];
	last_read_at: string | null;
};

export type ReaderSummary = ReaderRow & {
	read: Set<string>;
	/** Day numbers read in the chosen plan. */
	days: Set<number>;
	/** Progress in the chosen plan, or null when no plan is chosen. */
	plan: { done: number; due: number; percent: number; streak: number; behind: number; total: number } | null;
};

/** An open app refreshes its sign-in about once an hour. */
export const ACTIVE_WINDOW_MS = 75 * 60 * 1000;

export function summarize(rows: ReaderRow[], plan: PlanV2 | null, today: string): ReaderSummary[] {
	return rows.map((r) => {
		const read = new Set(r.read_days.map(fromStored));
		if (!plan) return { ...r, read, days: new Set<number>(), plan: null };
		// haveread is date-only: the days of this plan whose dates were checked off.
		const days = new Set(plan.schedule.filter((d) => d.date && read.has(d.date)).map((d) => d.n));
		const p = planProgress(plan, days, today);
		return { ...r, read, days, plan: { ...p, streak: currentStreak(plan, days, today), behind: p.due - p.done, total: days.size } };
	});
}

export type Presence = 'active' | 'signed-in' | 'signed-out' | 'never';

export function presence(r: Pick<ReaderRow, 'last_active_at' | 'signed_in_devices' | 'last_sign_in_at'>, now = Date.now()): Presence {
	if (!r.last_sign_in_at && !r.last_active_at) return 'never';
	if (r.signed_in_devices > 0 && r.last_active_at && now - Date.parse(r.last_active_at) < ACTIVE_WINDOW_MS) return 'active';
	return r.signed_in_devices > 0 ? 'signed-in' : 'signed-out';
}

export const presenceLabel: Record<Presence, string> = {
	active: 'Active now',
	'signed-in': 'Signed in',
	'signed-out': 'Signed out',
	never: 'Never signed in'
};

/** "just now", "5 minutes ago", "3 days ago", "Mar 4, 2025" */
export function ago(iso: string | null, now = Date.now()): string {
	if (!iso) return 'never';
	const s = Math.max(0, (now - Date.parse(iso)) / 1000);
	if (s < 90) return 'just now';
	const m = Math.round(s / 60);
	if (m < 60) return `${m} minutes ago`;
	const h = Math.round(m / 60);
	if (h < 24) return h === 1 ? '1 hour ago' : `${h} hours ago`;
	const d = Math.round(h / 24);
	if (d < 30) return d === 1 ? 'yesterday' : `${d} days ago`;
	return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
