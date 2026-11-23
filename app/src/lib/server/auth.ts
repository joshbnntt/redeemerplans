/** Checks that a request comes from a signed-in plan editor (Supabase access token). */
import { error } from '@sveltejs/kit';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '#lib/config.ts';

export type Editor = { id: string; email?: string; token: string };

export async function requireEditor(request: Request, fetchImpl: typeof fetch = fetch): Promise<Editor> {
	const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
	if (!token) error(401, 'Please sign in.');
	const headers = { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${token}` };

	const userRes = await fetchImpl(`${SUPABASE_URL}/auth/v1/user`, { headers });
	if (!userRes.ok) error(401, 'Your sign-in has expired. Please sign in again.');
	const user = (await userRes.json()) as { id: string; email?: string };

	const roleRes = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/is_plan_editor`, {
		method: 'POST',
		headers: { ...headers, 'content-type': 'application/json' },
		body: '{}'
	});
	if (!roleRes.ok || (await roleRes.json()) !== true) error(403, 'Your account doesn’t have permission to edit plans.');
	return { id: user.id, email: user.email, token };
}

/** Adds a row to the publish log as the editor (row-level security checks they're an editor). */
export async function logPublish(
	editor: Editor,
	entry: { plan_id: string; title: string; file_path: string; commit_sha: string; commit_url: string },
	fetchImpl: typeof fetch = fetch
) {
	await fetchImpl(`${SUPABASE_URL}/rest/v1/plan_publishes`, {
		method: 'POST',
		headers: {
			apikey: SUPABASE_ANON_KEY,
			authorization: `Bearer ${editor.token}`,
			'content-type': 'application/json',
			prefer: 'return=minimal'
		},
		body: JSON.stringify({ ...entry, published_by: editor.id })
	}).catch(() => {
		/* the commit is what matters; a missing log row isn't worth failing the publish */
	});
}
