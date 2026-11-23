import { error, json } from '@sveltejs/kit';
import { requireEditor } from '#lib/server/auth.ts';
import { gitHubConfig } from '#lib/server/env.ts';
import { gitHub } from '#lib/server/github.ts';
import { FILE_NAME } from '#lib/server/publish.ts';
import { parsePlanFile } from '#lib/shared/planFile.js';
import { PLAN_DIR } from '#lib/config.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/** The latest published version of a plan, straight from GitHub, for editing. */
export const GET: RequestHandler = async ({ request, url }) => {
	await requireEditor(request);
	const file = url.searchParams.get('file') ?? '';
	if (!FILE_NAME.test(file)) error(400, 'Unknown plan file.');
	const config = gitHubConfig();
	if (!config) error(503, 'Publishing isn’t set up yet (no GitHub token).');
	const f = await gitHub(config).getFile(`${PLAN_DIR}/${file}`);
	if (!f) error(404, 'That plan file doesn’t exist.');
	return json({ file, sha: f.sha, source: parsePlanFile(f.text) });
};
