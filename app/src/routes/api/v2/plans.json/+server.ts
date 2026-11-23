import { plans } from '#lib/server/plans.ts';
import { summary } from '#lib/server/v2.ts';

export const prerender = true;

/** v2: small index of every plan (no days). The app picks today's plan from the dates. */
export function GET() {
	return new Response(JSON.stringify({ plans: plans.map(summary) }), { headers: { 'content-type': 'application/json' } });
}
