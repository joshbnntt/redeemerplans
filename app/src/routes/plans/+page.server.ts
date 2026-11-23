import { plans } from '#lib/server/plans.ts';
import { summary } from '#lib/server/v2.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	plans: plans.map(summary).sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))
});
