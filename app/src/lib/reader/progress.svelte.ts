/**
 * Which plan days the reader has read, per plan: `reading_log(user_id, plan_id, day_n)`.
 *
 * - Signed out: kept on this device, and uploaded when the reader signs in.
 * - Signed in: shown instantly from a copy on the device, synced with Supabase; changes made
 *   offline are queued and sent when the connection comes back.
 *
 * The church plan's check-offs are also written to the old date-only `haveread` table, and
 * anything in `haveread` is read back in, so the current site and the admin Readers page stay in
 * step while both exist.
 */
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '#lib/supabase.ts';
import { dayDate, isLegacyPlan, locateDate, type PlanSummary } from '#lib/today.ts';
import { loadIndex } from './plans.svelte.ts';
import { load, save } from './storage.ts';
import { fromStored, toStored } from './stats.ts';

/** plan id → day numbers read */
type Log = Record<string, number[]>;
/** `date` is set when the check-off is mirrored to `haveread` (the church plan on its own dates). */
type Op = { op: 'add' | 'remove'; plan: string; n: number; date?: string };

export const progress = $state({
	log: new SvelteMap<string, SvelteSet<number>>(),
	session: null as Session | null,
	ready: false,
	/** Last sync problem, shown quietly in Settings. */
	syncError: ''
});

const EMPTY: ReadonlySet<number> = new Set();

/** Day numbers read in a plan (reactive). */
export const readIn = (plan: string): ReadonlySet<number> => progress.log.get(plan) ?? EMPTY;
export const isRead = (plan: string, n: number) => readIn(plan).has(n);
/** Whether anything at all has been checked off. */
export const hasProgress = () => [...progress.log.values()].some((s) => s.size > 0);

/**
 * Dates read, on each plan's schedule (for the year calendar).
 * @param plans the plan index
 * @param startOf the reader's own start date for a plan, if they have one
 */
export function readDates(plans: PlanSummary[], startOf: (id: string) => string | undefined = () => undefined): Set<string> {
	const dates = new Set<string>();
	for (const p of plans) {
		const start = startOf(p.id) ?? p.start;
		if (!start) continue;
		for (const n of readIn(p.id)) dates.add(dayDate({ start }, n)!);
	}
	return dates;
}

const KEYS = { guest: 'log-guest', cache: 'log-cache', pending: 'log-pending' };
/** Keys used before check-offs were kept per plan (lists of dates, and date-based ops). */
const OLD_KEYS = { guest: 'read-guest', pending: 'read-pending' };

const toLog = (entries: Iterable<[string, number]>): Log => {
	const log: Log = {};
	for (const [plan, n] of entries) (log[plan] ??= []).includes(n) || log[plan].push(n);
	return log;
};
const entries = (log: Log): [string, number][] => Object.entries(log).flatMap(([plan, ns]) => ns.map((n): [string, number] => [plan, n]));
const current = (): Log => Object.fromEntries([...progress.log].map(([plan, s]) => [plan, [...s]]));

function show(log: Log) {
	progress.log.clear();
	for (const [plan, ns] of Object.entries(log)) progress.log.set(plan, new SvelteSet(ns));
}
function apply(log: Log, op: Op) {
	const ns = new Set(log[op.plan] ?? []);
	if (op.op === 'add') ns.add(op.n);
	else ns.delete(op.n);
	log[op.plan] = [...ns];
}

/** Old date-only check-offs → plan days. Dates no church plan covered are dropped. */
function fromDates(index: PlanSummary[], dates: Iterable<{ date: string; slug?: string | null }>): [string, number][] {
	const out: [string, number][] = [];
	for (const { date, slug } of dates) {
		const at = locateDate(index, date, slug);
		if (at) out.push([at.plan.id, at.n]);
	}
	return out;
}

/** Moves anything saved on this device in the old date-only format over to the new one. */
async function migrateDevice() {
	const oldGuest = load<string[] | null>(OLD_KEYS.guest, null);
	const oldPending = load<{ op: 'add' | 'remove'; date: string; plan?: string }[] | null>(OLD_KEYS.pending, null);
	if (!oldGuest?.length && !oldPending?.length) return;
	let index: PlanSummary[];
	try {
		index = await loadIndex();
	} catch {
		return; // try again next time
	}
	if (oldGuest?.length) {
		const log = load<Log>(KEYS.guest, {});
		for (const [plan, n] of fromDates(index, oldGuest.map((date) => ({ date })))) apply(log, { op: 'add', plan, n });
		save(KEYS.guest, log);
	}
	if (oldPending?.length) {
		const pending = load<Op[]>(KEYS.pending, []);
		for (const o of oldPending) {
			const at = locateDate(index, o.date, o.plan);
			if (at) pending.push({ op: o.op, plan: at.plan.id, n: at.n, date: o.date });
		}
		save(KEYS.pending, pending);
	}
	save(OLD_KEYS.guest, []);
	save(OLD_KEYS.pending, []);
}

async function pageAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
	const all: T[] = [];
	for (let from = 0; ; from += 1000) {
		const { data, error } = await query(from, from + 999);
		if (error) throw error;
		all.push(...(data ?? []));
		if ((data ?? []).length < 1000) return all;
	}
}

async function fetchRemote(): Promise<Log> {
	const [rows, legacy, index] = await Promise.all([
		pageAll<{ plan_id: string; day_n: number }>((a, b) => supabase.from('reading_log').select('plan_id, day_n').range(a, b)),
		pageAll<{ plan_day: string | null; plan_slug: string | null }>((a, b) => supabase.from('haveread').select('plan_day, plan_slug').range(a, b)),
		loadIndex()
	]);
	// Check-offs made on the current site only exist in haveread.
	const old = fromDates(
		index,
		legacy.filter((r) => r.plan_day).map((r) => ({ date: fromStored(r.plan_day!), slug: r.plan_slug }))
	);
	return toLog([...rows.map((r): [string, number] => [r.plan_id, r.day_n]), ...old]);
}

async function send(op: Op, userId: string) {
	if (op.op === 'add') {
		const { error } = await supabase
			.from('reading_log')
			.upsert({ user_id: userId, plan_id: op.plan, day_n: op.n }, { onConflict: 'user_id,plan_id,day_n', ignoreDuplicates: true });
		if (error) throw error;
		if (op.date) {
			const stored = toStored(op.date);
			const { data } = await supabase.from('haveread').select('id').eq('plan_day', stored).limit(1);
			if (!data?.length) {
				const { error: e } = await supabase.from('haveread').insert({ plan_day: stored, user_id: userId, plan_slug: op.plan });
				if (e) throw e;
			}
		}
	} else {
		const { error } = await supabase.from('reading_log').delete().eq('plan_id', op.plan).eq('day_n', op.n);
		if (error) throw error;
		if (op.date) {
			const { error: e } = await supabase.from('haveread').delete().eq('plan_day', toStored(op.date));
			if (e) throw e;
		}
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
	await migrateDevice();
	if (!session) {
		show(load<Log>(KEYS.guest, {}));
		progress.ready = true;
		return;
	}
	// Show the last known state right away, then refresh from the server.
	show(load<Log>(KEYS.cache, {}));
	progress.ready = true;
	try {
		await flush();
		const remote = await fetchRemote();
		// Upload anything read while signed out.
		const guest = entries(load<Log>(KEYS.guest, {})).filter(([plan, n]) => !remote[plan]?.includes(n));
		if (guest.length) {
			const index = await loadIndex();
			const pending = load<Op[]>(KEYS.pending, []);
			for (const [plan, n] of guest) {
				const p = index.find((x) => x.id === plan);
				pending.push({ op: 'add', plan, n, ...(p && isLegacyPlan(p) && p.start ? { date: dayDate(p, n) } : {}) });
				apply(remote, { op: 'add', plan, n });
			}
			save(KEYS.pending, pending);
			save(KEYS.guest, {});
			await flush();
		}
		// Re-apply anything still waiting to be sent.
		for (const op of load<Op[]>(KEYS.pending, [])) apply(remote, op);
		show(remote);
		save(KEYS.cache, remote);
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

/**
 * Marks a plan day read or unread.
 * @param plan the plan (its id, and whether it's the church plan, which is also saved by date)
 * @param n day number
 * @param date the day's date, when it's on the plan's own schedule
 */
export async function setRead(plan: Pick<PlanSummary, 'id' | 'mode' | 'supplemental' | 'personal'>, n: number, value: boolean, date?: string) {
	let s = progress.log.get(plan.id);
	if (!s) progress.log.set(plan.id, (s = new SvelteSet()));
	if (value) s.add(n);
	else s.delete(n);
	if (!progress.session) {
		save(KEYS.guest, current());
		return;
	}
	save(KEYS.cache, current());
	const pending = load<Op[]>(KEYS.pending, []).filter((o) => o.plan !== plan.id || o.n !== n);
	pending.push({ op: value ? 'add' : 'remove', plan: plan.id, n, ...(date && isLegacyPlan(plan) ? { date } : {}) });
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
