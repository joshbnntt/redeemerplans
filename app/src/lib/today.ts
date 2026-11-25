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

/** Whole days from `a` to `b` (both YYYY-MM-DD). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** Day number (1-based) of a date in a dated plan, or undefined if the plan doesn't run that day. */
export function dayNumber(plan: Pick<PlanSummary, 'start' | 'end'>, iso: string): number | undefined {
	if (!plan.start || !plan.end || iso < plan.start || iso > plan.end) return undefined;
	return daysBetween(plan.start, iso) + 1;
}

/** The scheduled date of day `n` in a dated plan. */
export const dayDate = (plan: Pick<PlanSummary, 'start'>, n: number) => (plan.start ? addDays(plan.start, n - 1) : undefined);

/**
 * Whether check-offs in this plan are also written to the old date-only `haveread` table, which the
 * current site and the admin Readers page read. Only the church plan on its own dates is.
 */
export const isLegacyPlan = (p: Pick<PlanSummary, 'mode' | 'supplemental'>) => p.mode === 'church' && !p.supplemental;

/**
 * Which plan day an old date-only check-off belongs to: the plan it was tagged with when that plan
 * ran on the date, otherwise the church plan for that date.
 */
export function locateDate(plans: PlanSummary[], iso: string, slug?: string | null): { plan: PlanSummary; n: number } | undefined {
	const tagged = slug ? plans.find((p) => p.id === slug && isLegacyPlan(p) && dayNumber(p, iso)) : undefined;
	const plan = tagged ?? planForDate(plans, iso);
	const n = plan && dayNumber(plan, iso);
	return plan && n ? { plan, n } : undefined;
}

/** Day of week (0 = Sunday) of a YYYY-MM-DD date. */
export const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/**
 * The church plan for `today`: the current plan (the one the church app shows) while its dates
 * include today; otherwise, when two church plans overlap, the newest one. Extra plans are skipped.
 */
export function planForDate(plans: PlanSummary[], today: string): PlanSummary | undefined {
	const live = plans
		.filter((p) => p.mode === 'church' && !p.supplemental && p.start && p.end && p.start <= today && today <= p.end)
		.sort((a, b) => (a.start! < b.start! ? 1 : a.start! > b.start! ? -1 : a.id < b.id ? -1 : 1));
	return live.find((p) => p.current) ?? live[0];
}

/** The next church plan that hasn't started yet. */
export function nextPlan(plans: PlanSummary[], today: string): PlanSummary | undefined {
	return plans
		.filter((p) => p.mode === 'church' && !p.supplemental && p.start && p.start > today)
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
