/** Readers list for the admin: who has an account, when they were last seen, how far along they are. */
import { withDates, type PlanSummary, type PlanV2 } from '#lib/today.ts';
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

/** One reader's check-offs and choices in one plan (from list_reader_plans). */
export type ReaderPlanRow = {
	user_id: string;
	plan_id: string;
	days: number[];
	last_read_at: string | null;
	/** null when the reader hasn't chosen (the church plan is followed by default) */
	following: boolean | null;
	start_date: string | null;
};

export type ReaderSummary = ReaderRow & {
	read: Set<string>;
	/** Day numbers read in the chosen plan. */
	days: Set<number>;
	/** The chosen plan on this reader's dates (their own, if they've set them). */
	dated: PlanV2 | null;
	/** Progress counted up to this date: today, or the plan's last day once it's over. */
	asOf: string;
	/** Whether they follow the chosen plan, and on whose dates. */
	following: boolean;
	ownDates: boolean;
	/** Titles of every plan they follow. */
	follows: string[];
	/** Progress in the chosen plan, or null when they haven't read in it or don't follow it. */
	plan: { done: number; due: number; percent: number; streak: number; behind: number; total: number } | null;
};

/** An open app refreshes its sign-in about once an hour. */
export const ACTIVE_WINDOW_MS = 75 * 60 * 1000;

/**
 * @param plan the plan chosen on the page
 * @param church the church's current plan (followed by default)
 */
export function summarize(
	rows: ReaderRow[],
	planRows: ReaderPlanRow[],
	plan: PlanV2 | null,
	index: PlanSummary[],
	church: PlanSummary | undefined,
	today: string
): ReaderSummary[] {
	return rows.map((r) => {
		const read = new Set(r.read_days.map(fromStored));
		const mine = planRows.filter((p) => p.user_id === r.user_id);
		const choice = (id: string) => mine.find((p) => p.plan_id === id);
		const followsPlan = (p: PlanSummary) => choice(p.id)?.following ?? p.id === church?.id;
		const follows = index.filter((p) => followsPlan(p) && (!p.end || p.end >= today || !!choice(p.id)?.start_date)).map((p) => p.title);
		const base = { ...r, read, follows };
		if (!plan) return { ...base, days: new Set<number>(), dated: null, asOf: today, following: false, ownDates: false, plan: null };

		const row = choice(plan.id);
		const dated = withDates(plan, row?.start_date ?? undefined);
		const days = new Set(row?.days ?? []);
		// Check-offs made on the current site are only in haveread (by date), on the church's dates.
		if (!dated.personal) for (const d of plan.schedule) if (d.date && read.has(d.date)) days.add(d.n);
		const following = followsPlan(plan);
		const asOf = dated.end && dated.end < today ? dated.end : today;
		const shown = { ...base, days, dated, asOf, following, ownDates: !!dated.personal && !!plan.start };
		if (!dated.start || (!days.size && !following)) return { ...shown, plan: null };
		const p = planProgress(dated, days, asOf);
		return { ...shown, plan: { ...p, streak: currentStreak(dated, days, asOf), behind: p.due - p.done, total: days.size } };
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
