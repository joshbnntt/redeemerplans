import { error } from '@sveltejs/kit';
import { calendar, getPlan, plans } from '#lib/server/plans.ts';
import { planCalendar } from '#lib/server/v2.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;
// Self-paced plans have no dates, so no calendar.
export const entries: EntryGenerator = () => plans.filter((p) => p.start).map((p) => ({ id: p.id }));

export const GET: RequestHandler = ({ params }) => {
	const plan = getPlan(params.id);
	if (!plan?.start) error(404, 'No calendar for this plan');
	return new Response(planCalendar(plan, calendar.url), { headers: { 'content-type': 'text/calendar; charset=utf-8' } });
};
