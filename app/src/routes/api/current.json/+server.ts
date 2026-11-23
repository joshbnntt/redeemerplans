import { error } from '@sveltejs/kit';
import { flaggedCurrentPlan } from '#lib/server/plans.ts';
import { v1Plan } from '#lib/server/v1.ts';

export const prerender = true;

/** v1: the plan marked `current: true`. */
export function GET() {
	if (!flaggedCurrentPlan) error(404, 'No plan is marked current');
	return new Response(JSON.stringify(v1Plan(flaggedCurrentPlan)), { headers: { 'content-type': 'application/json' } });
}
