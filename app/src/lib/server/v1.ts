/**
 * The v1 public outputs, byte-for-byte compatible with the 11ty site:
 * /api/*.json, /subsplash/<plan>.xml (read by the church's Subsplash app), /currentplan.xml
 * and /feed.ics. Verified against tests/fixtures by `npm run test:compat`.
 */
import sindresorhusSlugify from '@sindresorhus/slugify';
import { ICalCalendar, ICalCalendarMethod } from 'ical-generator';
import { generateBibleLinks } from '#lib/shared/legacyLinks.js';
import { planDayDate, formatUS } from '#lib/shared/planDate.js';
import { calendar, legacySlug, plans, type Plan, type PlanEntry } from './plans.ts';

/** "MM/DD/YYYY", or "" without a start date (the old getReadingDate). */
const readingDate = (start: string, offset: number) => {
	const date = planDayDate(start, offset);
	return date ? formatUS(date) : '';
};

const v1Days = (start: string, entries: PlanEntry[]) =>
	entries.map((item, index) => ({
		...item,
		readingdate: readingDate(start, index),
		readinglinks: generateBibleLinks(item.day),
		altReadinglinks: generateBibleLinks(item.alt),
		id: index + 1
	}));

/** One plan in the v1 JSON shape (/api/plan/<id>.json, /api/current.json, /api/plans.json). */
export const v1Plan = (p: Plan) => ({
	id: p.id,
	title: p.title,
	description: p.description,
	start: p.start,
	current: p.current,
	plan: v1Days(p.start, p.plan)
});

/** /api/masterplan.json, built from src/data/masterplan.yaml. */
export const v1Masterplan = (m: { title: string; description?: string; start: string; plan: PlanEntry[] }) => ({
	id: legacySlug(m.title),
	title: m.title,
	description: m.description,
	start: m.start,
	plan: v1Days(m.start, m.plan)
});

/** Subsplash file name: 11ty's `slugify` filter (@sindresorhus/slugify, decamelize off). */
export const subsplashName = (p: Plan) => sindresorhusSlugify('' + p.title, { decamelize: false });

/**
 * Subsplash XML. The whitespace reproduces the original Nunjucks template exactly, because the
 * church app reads this file. (The /currentplan.xml template had no newline at the very end.)
 */
export function subsplashXml(p: Plan, { finalNewline = true } = {}): string {
	let out = '\n<plan>\n  ';
	p.plan.forEach((reading, i) => {
		out += `\n    <reading>\n      <day>${i + 1}</day>\n      \n      `;
		for (const passage of String(reading.day).split(',')) {
			out += `\n        <passage>${passage.replace(/^\s*|\s*$/g, '')}</passage>\n      `;
		}
		out += '\n    </reading>\n  ';
	});
	return out + '\n</plan>' + (finalNewline ? '\n' : '');
}

/** /feed.ics: every dated plan in one calendar (legacy; v2 has one feed per plan under /cal/). */
export function legacyFeed(): string {
	const cal = new ICalCalendar({
		name: calendar.title,
		description: calendar.description,
		prodId: { company: calendar.organization, product: 'Eleventy' },
		url: calendar.url + '/public/feed.ics',
		method: ICalCalendarMethod.PUBLISH
	});
	for (const p of plans) {
		if (!p.start) continue;
		let offset = 0;
		for (const reading of p.plan) {
			const date = readingDate(p.start, offset);
			offset++;
			cal.createEvent({
				id: `${calendar.url}/plan/${p.fileSlug}#${offset}`,
				start: date,
				end: date,
				summary: reading.day,
				allDay: true,
				description: `Reading: ${reading.day}\n${reading.alt ? `Alternate Reading: ${reading.alt}` : ''}
                `
			});
		}
	}
	return cal.toString();
}
