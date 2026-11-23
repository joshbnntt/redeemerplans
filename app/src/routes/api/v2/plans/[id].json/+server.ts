import { error } from '@sveltejs/kit';
import { getPlan, plans } from '#lib/server/plans.ts';
import { planV2 } from '#lib/server/v2.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;
export const entries: EntryGenerator = () => plans.map((p) => ({ id: p.id }));

export const GET: RequestHandler = ({ params }) => {
	const plan = getPlan(params.id);
	if (!plan) error(404, 'Plan not found');
	return new Response(JSON.stringify(planV2(plan)), { headers: { 'content-type': 'application/json' } });
};
