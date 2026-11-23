/** Sign-in state for the admin pages (browser only). */
import type { Session } from '@supabase/supabase-js';
import { supabase } from '#lib/supabase.ts';

export { supabase };

type Status = 'loading' | 'signed-out' | 'not-editor' | 'editor';

export const auth = $state<{ status: Status; session: Session | null; email: string }>({
	status: 'loading',
	session: null,
	email: ''
});

async function update(session: Session | null) {
	auth.session = session;
	auth.email = session?.user.email ?? '';
	if (!session) {
		auth.status = 'signed-out';
		return;
	}
	const { data, error } = await supabase.rpc('is_plan_editor');
	auth.status = !error && data === true ? 'editor' : 'not-editor';
}

let started = false;
/** Call once from the admin layout. */
export function startAuth() {
	if (started) return;
	started = true;
	supabase.auth.getSession().then(({ data }) => update(data.session));
	supabase.auth.onAuthStateChange((event, session) => {
		// Token refreshes don't change who's signed in.
		if (event === 'TOKEN_REFRESHED') auth.session = session;
		else update(session);
	});
}

/** Sends a sign-in link (and code) to the email address. */
export async function sendSignIn(email: string) {
	return supabase.auth.signInWithOtp({
		email,
		options: { emailRedirectTo: `${location.origin}/admin/`, shouldCreateUser: true }
	});
}

/** Signs in with the 6-digit code from the email (handy when the link opens in another browser). */
export async function verifyCode(email: string, token: string) {
	return supabase.auth.verifyOtp({ email, token, type: 'email' });
}

export const signOut = () => supabase.auth.signOut();

/** Calls the admin API with the current sign-in. Throws with the server's message on failure. */
export async function adminApi<T>(path: string, init: RequestInit = {}): Promise<T> {
	const { data } = await supabase.auth.getSession();
	const res = await fetch(path, {
		...init,
		headers: {
			...(init.body ? { 'content-type': 'application/json' } : {}),
			authorization: `Bearer ${data.session?.access_token ?? ''}`,
			...init.headers
		}
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		const err = new Error(body.message ?? `Request failed (${res.status})`) as Error & { status: number; body: unknown };
		err.status = res.status;
		err.body = body;
		throw err;
	}
	return body as T;
}
