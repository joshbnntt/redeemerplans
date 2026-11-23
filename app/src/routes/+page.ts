import type { PageLoad } from './$types';
import type { PlanSummary } from '#lib/today.ts';

// The small plan index is baked into the page at build time. Which plan and day to show
// depends on the reader's own date, so that's worked out in the browser.
export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/v2/plans.json');
	const { plans } = (await res.json()) as { plans: PlanSummary[] };
	return { plans };
};
