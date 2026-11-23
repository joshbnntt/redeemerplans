/** Client-side helpers: work out "today" in the reader's own time zone and find the reading. */
import type { Day, PlanSummary, PlanV2 } from '#lib/server/v2.ts';

export type { Day, PlanSummary, PlanV2 };

/** The reader's local calendar date as YYYY-MM-DD. */
export function localISODate(now = new Date()): string {
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/** Adds days to a YYYY-MM-DD date. */
export function addDays(iso: string, days: number): string {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Day of week (0 = Sunday) of a YYYY-MM-DD date. */
export const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/** The church plan whose dates include `today`; when two overlap, the newest one. */
export function planForDate(plans: PlanSummary[], today: string): PlanSummary | undefined {
	return plans
		.filter((p) => p.mode === 'church' && p.start && p.end && p.start <= today && today <= p.end)
		.sort((a, b) => (a.start! < b.start! ? 1 : -1))[0];
}

/** The next church plan that hasn't started yet. */
export function nextPlan(plans: PlanSummary[], today: string): PlanSummary | undefined {
	return plans
		.filter((p) => p.mode === 'church' && p.start && p.start > today)
		.sort((a, b) => (a.start! < b.start! ? -1 : 1))[0];
}

/** Sunday-to-Saturday week containing `date`, as the plan days that fall in it. */
export function weekOf(plan: PlanV2, date: string): { start: string; end: string; days: Day[] } {
	const start = addDays(date, -weekday(date));
	const end = addDays(start, 6);
	return { start, end, days: plan.schedule.filter((d) => d.date && d.date >= start && d.date <= end) };
}

/** "Monday, November 23" */
export const longDate = (iso: string) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** "Nov 23" */
export const shortDate = (iso: string) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Mon" */
export const shortWeekday = (iso: string) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
