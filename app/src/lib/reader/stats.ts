/**
 * Reading statistics for one plan, from the set of that plan's day numbers a reader has marked
 * read. Pure functions, so they're easy to test. Dates are YYYY-MM-DD in the reader's local time.
 */
import type { Day, PlanV2 } from '#lib/today.ts';
import { addDays, weekday } from '#lib/today.ts';

export type DayStatus = 'read' | 'missed' | 'today' | 'upcoming' | 'rest';

const isReadingDay = (d: Day) => d.type === 'reading';

/** How a plan day looks on a given date: read, missed, rest (Lord's Day), today, or upcoming. */
export function dayStatus(day: Day, read: ReadonlySet<number>, today: string): DayStatus {
	if (read.has(day.n)) return 'read';
	if (!day.date) return 'upcoming';
	if (!isReadingDay(day)) return 'rest';
	if (day.date === today) return 'today';
	return day.date < today ? 'missed' : 'upcoming';
}

/**
 * Days in a row with the reading done, counting back from today (or from yesterday if today
 * isn't read yet). Rest days don't break a streak.
 */
export function currentStreak(plan: PlanV2, read: ReadonlySet<number>, today: string): number {
	const byDate = new Map(plan.schedule.filter((d) => d.date).map((d) => [d.date!, d]));
	const todayDay = byDate.get(today);
	let date = todayDay && read.has(todayDay.n) ? today : addDays(today, -1);
	let streak = 0;
	for (;;) {
		const day = byDate.get(date);
		if (!day) break;
		if (read.has(day.n)) streak++;
		else if (isReadingDay(day)) break;
		date = addDays(date, -1);
	}
	return streak;
}

/** The longest run of read days in this plan so far (rest days don't break it). */
export function bestStreak(plan: PlanV2, read: ReadonlySet<number>, today: string): number {
	let best = 0;
	let run = 0;
	for (const day of plan.schedule) {
		if (!day.date || day.date > today) break;
		if (read.has(day.n)) best = Math.max(best, ++run);
		else if (isReadingDay(day) && day.date < today) run = 0;
	}
	return best;
}

/** Reading days up to today, and how many of them are read. */
export function planProgress(plan: PlanV2, read: ReadonlySet<number>, today: string) {
	const due = plan.schedule.filter((d) => d.date && d.date <= today && isReadingDay(d));
	const done = due.filter((d) => read.has(d.n)).length;
	return { due: due.length, done, percent: due.length ? Math.round((done / due.length) * 100) : 0 };
}

/** Unread reading days from the last `days` days (not counting today), oldest first. */
export function catchUp(plan: PlanV2, read: ReadonlySet<number>, today: string, days = 7): Day[] {
	const from = addDays(today, -days);
	return plan.schedule.filter((d) => d.date && d.date >= from && d.date < today && isReadingDay(d) && !read.has(d.n));
}

/** Chapters read per book in this plan (counting a split chapter once). */
export function bookProgress(plan: PlanV2, read: ReadonlySet<number>) {
	const books = new Map<string, { name: string; total: Set<number>; done: Set<number>; firstDay: number }>();
	for (const day of plan.schedule) {
		for (const ref of day.refs) {
			let b = books.get(ref.name);
			if (!b) books.set(ref.name, (b = { name: ref.name, total: new Set(), done: new Set(), firstDay: day.n }));
			b.total.add(ref.chapter);
			if (read.has(day.n)) b.done.add(ref.chapter);
		}
	}
	return [...books.values()].map((b) => ({ name: b.name, total: b.total.size, done: b.done.size, firstDay: b.firstDay }));
}

/** Calendar grid for a year: columns are weeks (Sunday first), cells are dates. */
export function yearGrid(year: number): (string | null)[][] {
	const first = `${year}-01-01`;
	const weeks: (string | null)[][] = [];
	let week: (string | null)[] = Array(weekday(first)).fill(null);
	for (let date = first; date.startsWith(String(year)); date = addDays(date, 1)) {
		week.push(date);
		if (week.length === 7) {
			weeks.push(week);
			week = [];
		}
	}
	if (week.length) weeks.push([...week, ...Array(7 - week.length).fill(null)]);
	return weeks;
}

/** "MM/DD/YYYY" (how check-offs are stored) ⇄ "YYYY-MM-DD". */
export const fromStored = (s: string) => {
	const [m, d, y] = s.split('/');
	return `${y}-${m}-${d}`;
};
export const toStored = (iso: string) => {
	const [y, m, d] = iso.split('-');
	return `${m}/${d}/${y}`;
};
