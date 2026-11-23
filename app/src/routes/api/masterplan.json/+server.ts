import { masterplan } from '#lib/server/plans.ts';
import { v1Masterplan } from '#lib/server/v1.ts';

export const prerender = true;

export function GET() {
	return new Response(JSON.stringify(v1Masterplan(masterplan)), { headers: { 'content-type': 'application/json' } });
}
