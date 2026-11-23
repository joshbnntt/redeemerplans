import { json } from '@sveltejs/kit';
import { requireEditor } from '#lib/server/auth.ts';
import { gitHubConfig } from '#lib/server/env.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/** Lets the admin page say whether publishing is set up, and where it publishes to. */
export const GET: RequestHandler = async ({ request }) => {
	const editor = await requireEditor(request);
	const config = gitHubConfig();
	return json({ email: editor.email, publishing: config ? { repo: config.repo, branch: config.branch } : null });
};
