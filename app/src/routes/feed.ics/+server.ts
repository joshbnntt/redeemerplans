import { legacyFeed } from '#lib/server/v1.ts';

export const prerender = true;

export function GET() {
	return new Response(legacyFeed(), { headers: { 'content-type': 'text/calendar; charset=utf-8' } });
}
