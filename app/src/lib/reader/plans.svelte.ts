/** Loads plans for the reader screens, once per visit. */
import type { PlanSummary, PlanV2 } from '#lib/today.ts';
import { localISODate, planForDate, nextPlan } from '#lib/today.ts';

let index: Promise<PlanSummary[]> | null = null;
const cache = new Map<string, Promise<PlanV2>>();

export function loadIndex(fetchImpl: typeof fetch = fetch): Promise<PlanSummary[]> {
	index ??= fetchImpl('/api/v2/plans.json').then((r) => r.json()).then((b) => b.plans as PlanSummary[]);
	return index;
}

export function loadPlan(id: string, fetchImpl: typeof fetch = fetch): Promise<PlanV2> {
	let p = cache.get(id);
	if (!p) {
		p = fetchImpl(`/api/v2/plans/${id}.json`).then((r) => {
			if (!r.ok) throw new Error('Couldn’t load the plan.');
			return r.json();
		});
		cache.set(id, p);
	}
	return p;
}

/** Today's church plan (or null), plus the next one if none is running. */
export async function loadToday(today = localISODate()) {
	const plans = await loadIndex();
	const summary = planForDate(plans, today);
	return { plans, summary, upcoming: summary ? undefined : nextPlan(plans, today), plan: summary ? await loadPlan(summary.id) : null };
}
