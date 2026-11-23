import type { PlanSummary } from '#lib/server/v2.ts';
import { checkSchedule } from '#lib/shared/planCheck.js';
import { localISODate } from '#lib/today.ts';

export type AdminPlan = PlanSummary & { current: boolean; errors: number; notes: number };

export async function loadAdminPlans(fetchImpl: typeof fetch = fetch): Promise<{ plans: AdminPlan[]; builtAt: string }> {
	const res = await fetchImpl('/api/admin/plans.json', { cache: 'no-cache' });
	if (!res.ok) throw new Error(`Couldn’t load the plan list (${res.status}).`);
	const body = await res.json();
	if (!Array.isArray(body?.plans)) throw new Error('The plan list is missing.');
	return body;
}

export type Status = 'live' | 'upcoming' | 'past' | 'self-paced';

export function statusOf(p: { start?: string; end?: string }, today = localISODate()): Status {
	if (!p.start || !p.end) return 'self-paced';
	if (today < p.start) return 'upcoming';
	if (today > p.end) return 'past';
	return 'live';
}

export const statusLabel: Record<Status, string> = {
	live: 'Live now',
	upcoming: 'Scheduled',
	past: 'Past',
	'self-paced': 'Start any day'
};

/** Overlaps and "nothing scheduled after …" across church plans. */
export function scheduleNotes(plans: { title: string; start?: string; end?: string }[], today = localISODate()): string[] {
	const asDate = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`) : null);
	return checkSchedule(
		plans.map((p) => ({ title: p.title, start: asDate(p.start), end: asDate(p.end) })),
		new Date(`${today}T00:00:00Z`)
	);
}

/** "Jan 4, 2027" */
export const niceDate = (iso: string) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
