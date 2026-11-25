/**
 * Which plans the reader follows: `user_plans(user_id, plan_id, following, start_date)`.
 *
 * - The church plan (the current one, which the church app also shows) is followed unless the
 *   reader turns it off. Every other plan is followed only once the reader starts it.
 * - A plan with no dates (e.g. Praying the Psalms) gets a start date when it's followed, so it has
 *   a day for today. (Moving a dated plan to the reader's own pace comes later.)
 * - Signed out: kept on this device, and saved to the account when the reader signs in.
 */
import { SvelteMap } from 'svelte/reactivity';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '#lib/supabase.ts';
import { localISODate, planForDate, type PlanSummary } from '#lib/today.ts';
import { load, save } from './storage.ts';

export type Choice = { following: boolean; start?: string };
type Row = { plan_id: string; following: boolean; start_date: string | null };

export const following = $state({
	choices: new SvelteMap<string, Choice>(),
	ready: false,
	syncError: ''
});

const KEYS = { guest: 'plans-guest', cache: 'plans-cache', pending: 'plans-pending' };
let session: Session | null = null;

const snapshot = () => Object.fromEntries(following.choices);
function show(choices: Record<string, Choice>) {
	following.choices.clear();
	for (const [id, c] of Object.entries(choices)) following.choices.set(id, c);
}

/** Whether the reader follows a plan. `church` is the plan the church is reading now. */
export function isFollowing(plan: Pick<PlanSummary, 'id'>, church?: Pick<PlanSummary, 'id'>): boolean {
	const c = following.choices.get(plan.id);
	if (c) return c.following;
	return !!church && church.id === plan.id;
}

/** The reader's start date for a plan they follow without set dates. */
export const startOf = (planId: string) => following.choices.get(planId)?.start;

/**
 * The plans the reader follows, church plan first, then the rest by when they were started.
 * Plans whose dates are over are left out; plans that haven't started yet are kept.
 */
export function followedPlans(plans: PlanSummary[], today: string): PlanSummary[] {
	const church = planForDate(plans, today);
	const out = plans.filter((p) => isFollowing(p, church) && (!p.end || p.end >= today));
	const order = [...following.choices.keys()];
	return out.sort((a, b) => {
		if (a.id === church?.id) return -1;
		if (b.id === church?.id) return 1;
		return order.indexOf(a.id) - order.indexOf(b.id);
	});
}

async function send(planId: string, c: Choice, userId: string) {
	const { error } = await supabase.from('user_plans').upsert(
		{ user_id: userId, plan_id: planId, following: c.following, start_date: c.start ?? null, updated_at: new Date().toISOString() },
		{ onConflict: 'user_id,plan_id' }
	);
	if (error) throw error;
}

async function flush() {
	const user = session?.user;
	if (!user) return;
	const pending = load<string[]>(KEYS.pending, []);
	while (pending.length) {
		const id = pending[0];
		const c = following.choices.get(id);
		try {
			if (c) await send(id, c, user.id);
			pending.shift();
			save(KEYS.pending, pending);
		} catch (e) {
			following.syncError = e instanceof Error ? e.message : 'Couldn’t sync.';
			return;
		}
	}
	following.syncError = '';
}

async function useSession(s: Session | null) {
	session = s;
	if (!s) {
		show(load(KEYS.guest, {}));
		following.ready = true;
		return;
	}
	show(load(KEYS.cache, {}));
	following.ready = true;
	try {
		await flush();
		const { data, error } = await supabase.from('user_plans').select('plan_id, following, start_date').order('updated_at');
		if (error) throw error;
		const remote: Record<string, Choice> = {};
		for (const r of (data ?? []) as Row[]) remote[r.plan_id] = { following: r.following, ...(r.start_date ? { start: r.start_date } : {}) };
		// Choices made while signed out are kept, unless the account already has a choice for that plan.
		const guest = load<Record<string, Choice>>(KEYS.guest, {});
		const toSend = Object.keys(guest).filter((id) => !(id in remote));
		for (const id of toSend) remote[id] = guest[id];
		for (const id of load<string[]>(KEYS.pending, [])) if (following.choices.has(id)) remote[id] = following.choices.get(id)!;
		show(remote);
		save(KEYS.cache, remote);
		if (toSend.length) {
			save(KEYS.pending, [...new Set([...load<string[]>(KEYS.pending, []), ...toSend])]);
			await flush();
		}
		save(KEYS.guest, {});
		following.syncError = '';
	} catch (e) {
		following.syncError = e instanceof Error ? e.message : 'Couldn’t load your plans.';
	}
}

let started = false;
export function startFollowing() {
	if (started) return;
	started = true;
	supabase.auth.getSession().then(({ data }) => useSession(data.session));
	supabase.auth.onAuthStateChange((event, s) => {
		if (event === 'TOKEN_REFRESHED') session = s;
		else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') useSession(s);
	});
	window.addEventListener('online', flush);
}

async function choose(planId: string, c: Choice) {
	// Re-adding moves a plan to the end of the list.
	following.choices.delete(planId);
	following.choices.set(planId, c);
	if (!session) {
		save(KEYS.guest, snapshot());
		return;
	}
	save(KEYS.cache, snapshot());
	save(KEYS.pending, [...load<string[]>(KEYS.pending, []).filter((id) => id !== planId), planId]);
	await flush();
}

/** Starts following a plan. A plan without dates starts today (or on `start`). */
export function follow(plan: Pick<PlanSummary, 'id' | 'start'>, start = localISODate()) {
	const existing = following.choices.get(plan.id)?.start;
	return choose(plan.id, { following: true, ...(plan.start ? {} : { start: existing ?? start }) });
}

/** Stops following a plan. Progress in it is kept, so following it again picks up where it was. */
export function unfollow(plan: Pick<PlanSummary, 'id' | 'start'>) {
	const start = following.choices.get(plan.id)?.start;
	return choose(plan.id, { following: false, ...(start ? { start } : {}) });
}

