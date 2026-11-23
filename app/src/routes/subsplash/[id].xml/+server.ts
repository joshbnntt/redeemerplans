import { error } from '@sveltejs/kit';
import { plans } from '#lib/server/plans.ts';
import { subsplashName, subsplashXml } from '#lib/server/v1.ts';
import type { EntryGenerator, RequestHandler } from './$types';

/** Read by the church's Subsplash app. Must stay byte-for-byte identical (see tests/fixtures). */
export const prerender = true;
export const entries: EntryGenerator = () => plans.map((p) => ({ id: subsplashName(p) }));

export const GET: RequestHandler = ({ params }) => {
	const plan = plans.find((p) => subsplashName(p) === params.id);
	if (!plan) error(404, 'Plan not found');
	return new Response(subsplashXml(plan), { headers: { 'content-type': 'application/xml' } });
};
