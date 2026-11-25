/** The v2 static API: plan index, full plans with structured references, and per-plan calendars. */
import { ICalCalendar, ICalCalendarMethod } from 'ical-generator';
import { isSpecialDay, parseReference, splitReferences } from '#lib/shared/scripture.js';
import { formatISO, planDayDate } from '#lib/shared/planDate.js';
import { isSupplemental, planStatus } from '#lib/shared/planCheck.js';
import { calendar, type Plan } from './plans.ts';

export type Ref = { book: string; name: string; chapter: number; verses?: string };
export type DayType = 'reading' | 'lords-day' | 'grace-day';
export type Reading = { label: string; refs: Ref[] };
export type Day = { n: number; date?: string; type: DayType } & Reading & { alt?: Reading };

export type PlanSummary = {
	id: string;
	/** file name in src/plan (used by the admin) */
	file: string;
	title: string;
	description?: string;
	/** church = everyone reads on the same dates · self-paced = each reader picks a start date */
	mode: 'church' | 'self-paced';
	start?: string;
	end?: string;
	days: number;
	/** the church's current plan: the one the church app (Subsplash) shows. Only present when true. */
	current?: true;
	/** an extra plan (e.g. Advent) to follow alongside the church plan. Only present when true. */
	supplemental?: true;
};

export type PlanV2 = PlanSummary & { days: number; schedule: Day[] };

function reading(text: string): Reading {
	const refs: Ref[] = [];
	for (const part of splitReferences(text)) {
		const ref = parseReference(part);
		// References with problems keep their text in `label` but get no link.
		if (ref.ok) refs.push({ book: ref.book.code, name: ref.book.name, chapter: ref.chapter, ...(ref.verses ? { verses: ref.verses } : {}) });
	}
	return { label: String(text).trim(), refs };
}

const dayType = (text: string): DayType =>
	!isSpecialDay(text) ? 'reading' : String(text).trim() === 'Grace Day' ? 'grace-day' : 'lords-day';

export function summary(p: Plan): PlanSummary {
	const { start, end } = planStatus(p);
	return {
		id: p.id,
		file: `${p.fileSlug}.md`,
		title: p.title,
		...(p.description ? { description: p.description } : {}),
		mode: start ? 'church' : 'self-paced',
		...(start && end ? { start: formatISO(start), end: formatISO(end) } : {}),
		days: p.plan.length,
		...(p.current ? { current: true as const } : {}),
		...(isSupplemental(p) ? { supplemental: true as const } : {})
	};
}

export function planV2(p: Plan): PlanV2 {
	const schedule = p.plan.map((entry, i): Day => {
		const text = String(entry.day ?? '');
		const date = planDayDate(p.start, i);
		return {
			n: i + 1,
			...(date ? { date: formatISO(date) } : {}),
			type: dayType(text),
			...reading(text),
			...(entry.alt ? { alt: reading(String(entry.alt)) } : {})
		};
	});
	return { ...summary(p), schedule };
}

/** /cal/<id>.ics: one all-day event per reading day, for calendar subscriptions. */
export function planCalendar(p: Plan, siteUrl: string): string {
	const v2 = planV2(p);
	const cal = new ICalCalendar({
		name: `${p.title} · ${calendar.organization}`,
		description: p.description ?? calendar.description,
		prodId: { company: calendar.organization, product: 'Bible Reading' },
		url: `${siteUrl}/cal/${p.id}.ics`,
		method: ICalCalendarMethod.PUBLISH,
		// Hint to calendar apps to check for plan edits about once a day.
		ttl: 60 * 60 * 24
	});
	for (const day of v2.schedule) {
		if (!day.date) continue;
		// Floating all-day dates are written from local date parts, so build them in local time;
		// that keeps the calendar day correct whatever time zone the build runs in.
		const [y, m, d] = day.date.split('-').map(Number);
		const start = new Date(y, m - 1, d);
		const end = new Date(y, m - 1, d + 1);
		cal.createEvent({
			id: `${p.id}-${day.n}@${new URL(siteUrl).host}`,
			start,
			end,
			allDay: true,
			// Keep the date floating so it shows on the same calendar day in every time zone.
			floating: true,
			summary: day.type === 'reading' ? day.label : day.type === 'lords-day' ? "Lord's Day" : 'Grace Day',
			description: [day.alt ? `Alternate: ${day.alt.label}` : '', `${siteUrl}/plan/${p.id}/`].filter(Boolean).join('\n'),
			url: `${siteUrl}/plan/${p.id}/`
		});
	}
	return cal.toString();
}
