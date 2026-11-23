/**
 * Which days the reader has read. Uses the same `haveread` table (one row per date, stored as
 * "MM/DD/YYYY") as the current site, so check-offs carry over and stay in sync between the two.
 *
 * - Signed out: kept on this device, and uploaded when the reader signs in.
 * - Signed in: shown instantly from a copy on the device, synced with Supabase; changes made
 *   offline are queued and sent when the connection comes back.
 */
import { SvelteSet } from 'svelte/reactivity';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '#lib/supabase.ts';
import { load, save } from './storage.ts';
import { fromStored, toStored } from './stats.ts';

type Op = { op: 'add' | 'remove'; date: string; plan?: string };

export const progress = $state({
	read: new SvelteSet<string>(),
	session: null as Session | null,
	ready: false,
	/** Last sync problem, shown quietly in Settings. */
	syncError: ''
});

const KEYS = { guest: 'read-guest', cache: 'read-cache', pending: 'read-pending' };

function show(dates: Iterable<string>) {
	progress.read.clear();
	for (const d of dates) progress.read.add(d);
}

async function fetchRemote(): Promise<Set<string>> {
	const all = new Set<string>();
	for (let from = 0; ; from += 1000) {
		const { data, error } = await supabase.from('haveread').select('plan_day').range(from, from + 999);
		if (error) throw error;
		for (const row of data) if (row.plan_day) all.add(fromStored(row.plan_day));
		if (data.length < 1000) return all;
	}
}

async function send(op: Op, userId: string) {
	if (op.op === 'add') {
		const { error } = await supabase.from('haveread').insert({ plan_day: toStored(op.date), user_id: userId, plan_slug: op.plan ?? null });
		if (error) throw error;
	} else {
		const { error } = await supabase.from('haveread').delete().eq('plan_day', toStored(op.date));
		if (error) throw error;
	}
}

async function flush() {
	const user = progress.session?.user;
	if (!user) return;
	const pending = load<Op[]>(KEYS.pending, []);
	while (pending.length) {
		try {
			await send(pending[0], user.id);
			pending.shift();
			save(KEYS.pending, pending);
		} catch (e) {
			progress.syncError = e instanceof Error ? e.message : 'Couldn’t sync.';
			return;
		}
	}
	progress.syncError = '';
}

async function useSession(session: Session | null) {
	progress.session = session;
	if (!session) {
		show(load<string[]>(KEYS.guest, []));
		progress.ready = true;
		return;
	}
	// Show the last known state right away, then refresh from the server.
	show(load<string[]>(KEYS.cache, []));
	progress.ready = true;
	try {
		await flush();
		const remote = await fetchRemote();
		// Upload anything read while signed out.
		const guest = load<string[]>(KEYS.guest, []).filter((d) => !remote.has(d));
		if (guest.length) {
			const { error } = await supabase
				.from('haveread')
				.insert(guest.map((d) => ({ plan_day: toStored(d), user_id: session.user.id })));
			if (!error) {
				guest.forEach((d) => remote.add(d));
				save(KEYS.guest, []);
			}
		}
		// Re-apply anything still waiting to be sent.
		for (const op of load<Op[]>(KEYS.pending, [])) op.op === 'add' ? remote.add(op.date) : remote.delete(op.date);
		show(remote);
		save(KEYS.cache, [...remote]);
		progress.syncError = '';
	} catch (e) {
		progress.syncError = e instanceof Error ? e.message : 'Couldn’t load your progress.';
	}
}

let started = false;
export function startProgress() {
	if (started) return;
	started = true;
	supabase.auth.getSession().then(({ data }) => useSession(data.session));
	supabase.auth.onAuthStateChange((event, session) => {
		if (event === 'TOKEN_REFRESHED') progress.session = session;
		else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') useSession(session);
	});
	window.addEventListener('online', flush);
}

/** Marks a day read or unread. */
export async function setRead(date: string, value: boolean, plan?: string) {
	if (value) progress.read.add(date);
	else progress.read.delete(date);
	if (!progress.session) {
		save(KEYS.guest, [...progress.read]);
		return;
	}
	save(KEYS.cache, [...progress.read]);
	const pending = load<Op[]>(KEYS.pending, []).filter((o) => o.date !== date);
	pending.push({ op: value ? 'add' : 'remove', date, plan });
	save(KEYS.pending, pending);
	await flush();
}

export async function signInReader(email: string) {
	return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/settings/` } });
}
export async function verifyReaderCode(email: string, token: string) {
	return supabase.auth.verifyOtp({ email, token, type: 'email' });
}
export const signOutReader = () => supabase.auth.signOut();
