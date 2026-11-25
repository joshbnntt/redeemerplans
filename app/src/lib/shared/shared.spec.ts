import { describe, expect, it } from 'vitest';
import { BOOKS, resolveBook, parseReference, suggestBook, splitReferences } from './scripture.js';
import { parsePlanDate, planDayDate, formatUS, formatISO } from './planDate.js';
import { checkCurrent, checkPlan, checkSchedule, isSupplemental, planStatus } from './planCheck.js';
import { generateBibleLinks } from './legacyLinks.js';
import { passageUrl } from './links.js';

describe('scripture', () => {
	it('has 66 books and 1,189 chapters', () => {
		expect(BOOKS).toHaveLength(66);
		expect(BOOKS.reduce((n, b) => n + b.chapters, 0)).toBe(1189);
	});

	it('resolves names, aliases and abbreviations', () => {
		expect(resolveBook('Psalms')?.name).toBe('Psalm');
		expect(resolveBook('Song of Songs')?.name).toBe('Song of Solomon');
		expect(resolveBook('1 cor')?.name).toBe('1 Corinthians');
		expect(resolveBook('Gen.')?.name).toBe('Genesis');
		expect(resolveBook('Revealtion')).toBeNull();
	});

	it('parses references', () => {
		const ref = parseReference('Psalm 119:1-32');
		expect(ref.ok && [ref.book.name, ref.chapter, ref.verses]).toEqual(['Psalm', 119, '1-32']);
		const john = parseReference('1 John 3');
		expect(john.ok && john.book.name).toBe('1 John');
		expect(parseReference('Jude')).toMatchObject({ ok: false, reason: 'missing-chapter' });
		expect(parseReference('1 John')).toMatchObject({ ok: false, reason: 'missing-chapter' });
		expect(parseReference('Jude 2')).toMatchObject({ ok: false, reason: 'chapter-out-of-range' });
		expect(parseReference('Revealtion 7')).toMatchObject({ ok: false, reason: 'unknown-book' });
		expect(splitReferences(' Genesis 1,  Genesis 2 ,')).toEqual(['Genesis 1', 'Genesis 2']);
	});

	it('suggests the nearest book for a typo', () => {
		expect(suggestBook('Revealtion')?.name).toBe('Revelation');
		expect(suggestBook('Habakuk')?.name).toBe('Habakkuk');
		expect(suggestBook('Banana')).toBeNull();
	});
});

describe('plan dates', () => {
	it('accepts both formats and rejects impossible dates', () => {
		expect(formatISO(parsePlanDate('01-01-2026')!)).toBe('2026-01-01');
		expect(formatISO(parsePlanDate('2026-01-01')!)).toBe('2026-01-01');
		expect(parsePlanDate('02-30-2026')).toBeNull();
		expect(parsePlanDate('')).toBeNull();
	});

	it('counts days across years and daylight-saving changes', () => {
		expect(formatUS(planDayDate('01-01-2026', 367)!)).toBe('01/03/2027');
		expect(formatUS(planDayDate('03-01-2026', 10)!)).toBe('03/11/2026');
	});
});

describe('plan checks', () => {
	it('reports typos, missing chapters and impossible chapters as errors, with fixes', () => {
		const { issues } = checkPlan({
			title: 'T',
			start: '2024-08-01',
			plan: [{ day: 'Revealtion 7' }, { day: 'Jude' }, { day: 'Psalm 151' }, { day: '' }, { day: 'Genesis 1', alt: 'Habakuk 1' }]
		});
		const errors = issues.filter((i) => i.level === 'error');
		expect(errors).toHaveLength(5);
		expect(errors[0]).toMatchObject({ day: 1, fix: 'Revelation 7' });
		expect(errors[1]).toMatchObject({ day: 2, fix: 'Jude 1' });
		expect(errors[2].message).toMatch(/Psalm has 150 chapters/);
		expect(errors[3].message).toMatch(/no reading/);
		expect(errors[4]).toMatchObject({ day: 5, fix: 'Habakkuk 1' });
	});

	it('notes repeats, skipped chapters and a misplaced Lord’s Day', () => {
		const plan = ['Jeremiah 1, Jeremiah 2', 'Jeremiah 3, Jeremiah 5', "Lord's Day", 'Jeremiah 6, Jeremiah 7', 'Jeremiah 8, Jeremiah 9, Jeremiah 10', 'Jeremiah 10'].map(
			(day) => ({ day })
		);
		// 2026-11-23 is a Monday, so day 3 is a Wednesday.
		const { issues } = checkPlan({ title: 'T', start: '2026-11-23', plan });
		expect(issues.every((i) => i.level === 'warning')).toBe(true);
		const text = issues.map((i) => i.message).join('\n');
		expect(text).toMatch(/read more than once/);
		expect(text).toMatch(/Jeremiah 4 is skipped/);
		expect(text).toMatch(/isn't on a Sunday/);
	});

	it('offers “Lord’s Day” for a blank Sunday, but not for a blank weekday', () => {
		// 2027-01-10 is a Sunday.
		const { issues } = checkPlan({ title: 'T', start: '2027-01-09', plan: [{ day: '' }, { day: '' }] });
		expect(issues[0]).toMatchObject({ day: 1, field: 'day', text: '' });
		expect(issues[0].fix).toBeUndefined();
		expect(issues[1]).toMatchObject({ day: 2, field: 'day', text: '', fix: "Lord's Day" });
	});

	it('ignores intentional repeats and split chapters', () => {
		const { issues } = checkPlan({
			title: 'T',
			intentional_repeats: ['Proverbs'],
			plan: [{ day: 'Proverbs 1' }, { day: 'Proverbs 1' }, { day: 'Psalm 119:1-88' }, { day: 'Psalm 119:89-176' }]
		});
		expect(issues).toEqual([]);
	});

	it('knows which plans are live, upcoming, past or self-paced', () => {
		const today = new Date(Date.UTC(2026, 10, 23));
		const days = Array(10).fill({ day: 'John 1' });
		expect(planStatus({ start: '2026-11-20', plan: days }, today).status).toBe('live');
		expect(planStatus({ start: '2027-01-04', plan: days }, today).status).toBe('upcoming');
		expect(planStatus({ start: '2024-01-01', plan: days }, today).status).toBe('past');
		expect(planStatus({ plan: days }, today).status).toBe('self-paced');
	});

	it('notes overlaps and when nothing is scheduled ahead', () => {
		const a = { title: 'A', ...planStatus({ start: '2026-01-01', plan: Array(10).fill({ day: 'John 1' }) }) };
		const b = { title: 'B', ...planStatus({ start: '2026-01-08', plan: Array(10).fill({ day: 'John 1' }) }) };
		const notes = checkSchedule([a, b], new Date(Date.UTC(2026, 0, 2)));
		expect(notes[0]).toMatch(/"A" and "B" overlap by 3 days/);
		expect(notes[1]).toMatch(/No plan is scheduled after Sat, Jan 17, 2026/);
	});

	it('leaves extra plans out of the overlap notes', () => {
		const a = { title: 'A', ...planStatus({ start: '2026-01-01', plan: Array(30).fill({ day: 'John 1' }) }) };
		const advent = { title: 'Advent', supplemental: true, ...planStatus({ start: '2026-01-08', plan: Array(5).fill({ day: 'John 1' }) }) };
		expect(checkSchedule([a, advent], new Date(Date.UTC(2025, 0, 2))).join(' ')).not.toMatch(/overlap/);
	});

	it('requires exactly one current plan, and never an extra one', () => {
		expect(checkCurrent([{ title: 'A', current: true }, { title: 'B' }])).toEqual({ errors: [], warnings: [] });
		expect(checkCurrent([{ title: 'A', current: true }, { title: 'B', current: true }]).errors[0]).toMatch(/2 plans are marked current/);
		expect(checkCurrent([{ title: 'Advent', current: true, supplemental: true }]).errors[0]).toMatch(/extra plan/);
		expect(checkCurrent([{ title: 'A' }]).warnings[0]).toMatch(/No plan is marked current/);
		expect(isSupplemental({ supplemental: true })).toBe(true);
		expect(isSupplemental({ extra: { supplemental: true } })).toBe(true);
		expect(isSupplemental({})).toBe(false);
	});
});

describe('links', () => {
	it('keeps the v1 HTML links', () => {
		expect(generateBibleLinks('Psalm 119:1-32, John 3')).toBe(
			'<a class="block underline text-base-content" href="https://www.bible.com/bible/59/PSA.119.1-32" alt="Psalm 119:1-32">Psalm 119:1-32,</a> ' +
				'<a class="block underline text-base-content" href="https://www.bible.com/bible/59/JHN.3" alt="John 3">John 3</a>'
		);
		expect(generateBibleLinks("Lord's Day")).toBe("Lord's Day");
	});

	it('builds links for each reading app', () => {
		const ref = { book: 'PSA', name: 'Psalm', chapter: 119, verses: '1-32' };
		expect(passageUrl(ref)).toBe('https://www.bible.com/bible/59/PSA.119.1-32');
		expect(passageUrl(ref, { translation: 'CSB' })).toBe('https://www.bible.com/bible/1713/PSA.119.1-32');
		expect(passageUrl(ref, { app: 'esv' })).toBe('https://www.esv.org/Psalm+119%3A1-32/');
		expect(passageUrl(ref, { app: 'lsb', translation: 'NIV' })).toBe('https://read.lsbible.org/?q=Psalm+119%3A1-32');
		expect(passageUrl(ref, { app: 'biblegateway', translation: 'NIV' })).toBe(
			'https://www.biblegateway.com/passage/?search=Psalm%20119%3A1-32&version=NIV'
		);
	});
});
