import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { normalizeReading } from './normalize.js';
import { parsePlanFile, serializePlanFile, toPlanDate, gitBlobSha } from './planFile.js';
import { importSheet, parseSheetDate, splitRows } from './importSheet.js';

describe('normalizeReading', () => {
	it('expands abbreviations and chapter ranges into the plan format', () => {
		expect(normalizeReading('Gen 1-3; Ps 23')).toBe('Genesis 1, Genesis 2, Genesis 3, Psalm 23');
		expect(normalizeReading('Matt 1')).toBe('Matthew 1');
		expect(normalizeReading('1 Cor 13, Song of Songs 2')).toBe('1 Corinthians 13, Song of Solomon 2');
		expect(normalizeReading('Psalm 119:1–32')).toBe('Psalm 119:1-32');
		expect(normalizeReading('Romans 5:12-21, Genesis 3')).toBe('Romans 5:12-21, Genesis 3');
	});

	it('recognizes rest days however they are typed', () => {
		expect(normalizeReading("lords day")).toBe("Lord's Day");
		expect(normalizeReading('Lord’s Day')).toBe("Lord's Day");
		expect(normalizeReading('Grace day')).toBe('Grace Day');
	});

	it('leaves anything it does not understand for the checks to point out', () => {
		expect(normalizeReading('Habakuk 1')).toBe('Habakuk 1');
		expect(normalizeReading('Jude')).toBe('Jude');
		expect(normalizeReading('Jude 1-3')).toBe('Jude 1-3'); // verses, not chapters
		expect(normalizeReading('John 3:16-4:2')).toBe('John 3:16-4:2');
		expect(normalizeReading('  ')).toBe('');
	});
});

describe('plan files', () => {
	it('round-trips every existing plan without changing its data', () => {
		const dir = '../src/plan/';
		for (const f of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
			const a = parsePlanFile(readFileSync(dir + f, 'utf8'));
			expect(parsePlanFile(serializePlanFile(a)), f).toEqual(a);
		}
	});

	it('writes the same layout as the existing files', () => {
		const text = serializePlanFile({
			title: '2027 Bible Reading Plan',
			description: 'Our reading plan for the year 2027.',
			start: '2027-01-04',
			current: false,
			plan: [{ day: 'Genesis 1, Genesis 2' }, { day: "Lord's Day" }, { day: 'Psalm 2', alt: 'Psalm 3' }],
			extra: {}
		});
		expect(text).toBe(
			[
				'---',
				'title: 2027 Bible Reading Plan',
				'description: Our reading plan for the year 2027.',
				'start: 01-04-2027',
				'current: false',
				'plan:',
				'  - day: Genesis 1, Genesis 2',
				"  - day: Lord's Day",
				'  - day: Psalm 2',
				'    alt: Psalm 3',
				'---',
				''
			].join('\n')
		);
	});

	it('uses MM-DD-YYYY dates, which the current site expects', () => {
		expect(toPlanDate('2027-01-04')).toBe('01-04-2027');
		expect(toPlanDate('01-04-2027')).toBe('01-04-2027');
	});

	it('computes the same file id as git', async () => {
		// `printf 'hello\n' | git hash-object --stdin`
		expect(await gitBlobSha('hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
	});
});

describe('paste from spreadsheet', () => {
	it('reads a Google Sheets paste with a header row', () => {
		const r = importSheet('Date\tReading\tAlternate\n1/4/2027\tGen 1-2\t\n1/5/2027\tGen 3-4, Ps 1\tPs 2\n1/6/2027\tlords day\t');
		expect(r.hasHeader).toBe(true);
		expect(r.start).toBe('2027-01-04');
		expect(r.days.map((d) => d.day)).toEqual(['Genesis 1, Genesis 2', 'Genesis 3, Genesis 4, Psalm 1', "Lord's Day"]);
		expect(r.days[1].alt).toBe('Psalm 2');
		expect(r.notes).toEqual([]);
	});

	it('finds the date column without a header, in any common format', () => {
		const r = importSheet('Jan 4, 2027\tMatt 1\n2027-01-05\tMatt 2\n01-06-27\tMatt 3');
		expect(r.hasHeader).toBe(false);
		expect(r.columns).toMatchObject({ date: 0, day: 1 });
		expect(r.days.map((d) => d.date)).toEqual(['2027-01-04', '2027-01-05', '2027-01-06']);
	});

	it('reads one column of readings with no dates', () => {
		const r = importSheet('Genesis 1, Genesis 2\nGenesis 3\n');
		expect(r.start).toBeUndefined();
		expect(r.days).toHaveLength(2);
		expect(r.days[0].day).toBe('Genesis 1, Genesis 2');
	});

	it('reads a CSV file with quoted readings', () => {
		const rows = splitRows('date,reading\n2027-01-04,"Genesis 1, Genesis 2"\n2027-01-05,"He said ""hi"""\n');
		expect(rows[1]).toEqual(['2027-01-04', 'Genesis 1, Genesis 2']);
		expect(rows[2][1]).toBe('He said "hi"');
	});

	it('points out a missing or extra row when the dates jump', () => {
		const r = importSheet('1/4/2027\tMatt 1\n1/5/2027\tMatt 2\n1/7/2027\tMatt 3');
		expect(r.notes[0]).toMatch(/Row 3: the date \(2027-01-07\) doesn't follow/);
	});

	it('keeps blank rows in the middle as blank days, so later days don’t shift', () => {
		const r = importSheet('\nMatt 1\nMatt 2\n\nMatt 3\n\n\n');
		expect(r.days.map((d) => d.day)).toEqual(['Matthew 1', 'Matthew 2', '', 'Matthew 3']);
		expect(r.notes).toContain('1 day has no reading.');
	});

	it('parses dates people type', () => {
		expect(parseSheetDate('Monday, January 4, 2027')).toBe('2027-01-04');
		expect(parseSheetDate('2/30/2027')).toBeNull();
		expect(parseSheetDate('Genesis 1')).toBeNull();
	});
});
