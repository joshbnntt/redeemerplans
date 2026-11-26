/** Which followed plan the Plan and Progress tabs show. Remembered on this device. */
import { followedPlans } from './following.svelte.ts';
import { load, save } from './storage.ts';
import type { PlanSummary } from '#lib/today.ts';

const KEY = 'shown-plan';
/** Picked in this visit (reactive); until then, what was saved on the device. */
const chosen = $state({ id: '' });
let saved: string | null = null;

/** Shows this plan on the Plan and Progress tabs from now on. */
export function choosePlan(id: string) {
	chosen.id = id;
	save(KEY, id);
}

/** The followed plan to show: the one last picked if it's still followed, otherwise the first (church plan first). */
export function shownPlan(plans: PlanSummary[], today: string): PlanSummary | undefined {
	saved ??= load(KEY, '');
	const id = chosen.id || saved;
	const list = followedPlans(plans, today);
	return list.find((p) => p.id === id) ?? list[0];
}
