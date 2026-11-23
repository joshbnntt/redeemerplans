import { error } from '@sveltejs/kit';
import { getPlan, plans } from '#lib/server/plans.ts';
import { v1Plan } from '#lib/server/v1.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;
export const entries: EntryGenerator = () => plans.map((p) => ({ id: p.id }));

export const GET: RequestHandler = ({ params }) => {
	const plan = getPlan(params.id);
	if (!plan) error(404, 'Plan not found');
	return new Response(JSON.stringify(v1Plan(plan)), { headers: { 'content-type': 'application/json' } });
};
