import { error } from '@sveltejs/kit';
import { flaggedCurrentPlan } from '#lib/server/plans.ts';
import { subsplashXml } from '#lib/server/v1.ts';

export const prerender = true;

export function GET() {
	if (!flaggedCurrentPlan) error(404, 'No plan is marked current');
	return new Response(subsplashXml(flaggedCurrentPlan, { finalNewline: false }), { headers: { 'content-type': 'application/xml' } });
}
