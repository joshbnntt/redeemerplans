import { error, json } from '@sveltejs/kit';
import { CHURCH_TIME_ZONE } from '#lib/config.ts';
import { cronSecret, gitHubConfig } from '#lib/server/env.ts';
import { gitHub } from '#lib/server/github.ts';
import { runChangeover } from '#lib/server/changeover.ts';
import { dateInZone } from '#lib/shared/changeover.js';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * Called once a day by a Vercel Schedule at 12:05am Central (see vercel.json). `?dryRun=1` reports what it would do
 * without changing anything; `?today=YYYY-MM-DD` (dry run only) checks a future date.
 */
export const GET: RequestHandler = async ({ request, url }) => {
	const secret = cronSecret();
	if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) error(401, 'Not allowed.');
	const config = gitHubConfig();
	if (!config) error(503, 'Publishing isn’t set up (no GitHub token).');

	const dryRun = url.searchParams.has('dryRun');
	const asked = url.searchParams.get('today');
	if (asked && (!dryRun || !/^\d{4}-\d{2}-\d{2}$/.test(asked))) error(400, '`today` only works with dryRun, as YYYY-MM-DD.');
	const today = asked ?? dateInZone(new Date(), CHURCH_TIME_ZONE);

	const result = await runChangeover(gitHub(config), today, { dryRun });
	console.log('plan changeover', JSON.stringify(result));
	return json(result);
};
