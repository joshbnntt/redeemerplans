import { error } from '@sveltejs/kit';
import { getPlan, plans } from '#lib/server/plans.ts';
import { planV2 } from '#lib/server/v2.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => plans.map((p) => ({ id: p.id }));

export const load: PageServerLoad = ({ params }) => {
	const plan = getPlan(params.id);
	if (!plan) error(404, 'Plan not found');
	return { plan: planV2(plan) };
};
