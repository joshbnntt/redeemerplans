import { error, json } from '@sveltejs/kit';
import { logPublish, requireEditor } from '#lib/server/auth.ts';
import { gitHubConfig } from '#lib/server/env.ts';
import { gitHub, GitHubError } from '#lib/server/github.ts';
import { plans } from '#lib/server/plans.ts';
import { publishPlan, readInput } from '#lib/server/publish.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	const editor = await requireEditor(request);
	const config = gitHubConfig();
	if (!config) error(503, 'Publishing isn’t set up yet (no GitHub token).');
	const input = readInput(await request.json().catch(() => null));
	if (!input) error(400, 'That doesn’t look like a reading plan.');

	try {
		const result = await publishPlan(gitHub(config), input, input.file ? [] : plans.map((p) => p.id));
		if (!result.ok) return json(result, { status: result.status });
		await logPublish(editor, {
			plan_id: result.id,
			title: input.source.title.trim(),
			file_path: result.path,
			commit_sha: result.commit,
			commit_url: result.url
		});
		return json(result);
	} catch (e) {
		if (e instanceof GitHubError) {
			console.error(e.message);
			error(502, e.status === 401 || e.status === 403 ? 'GitHub refused the change. The GitHub token may have expired.' : 'Couldn’t reach GitHub. Try again in a minute.');
		}
		throw e;
	}
};
