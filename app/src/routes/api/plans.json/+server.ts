import { plans } from '#lib/server/plans.ts';
import { v1Plan } from '#lib/server/v1.ts';

export const prerender = true;

/** v1: every plan with every day (large; v2 has a small index at /api/v2/plans.json). */
export function GET() {
	return new Response(JSON.stringify(plans.map(v1Plan)), { headers: { 'content-type': 'application/json' } });
}
