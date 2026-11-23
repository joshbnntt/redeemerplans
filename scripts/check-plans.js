#!/usr/bin/env node
/**
 * Checks every reading plan in src/plan/ for mistakes before they reach readers.
 *
 *   npm run check:plans            errors + warnings, summarised
 *   npm run check:plans -- -v      list every repeated chapter too
 *   npm run check:plans -- --json  machine-readable output
 *
 * Exits 1 when any plan has an error (unknown book, chapter that doesn't exist, missing
 * chapter number, unreadable entry, bad start date), so a broken plan fails the build
 * and the live site stays on the last good version. Warnings never fail the build.
 *
 * Front-matter options a plan can set:
 *   intentional_repeats: [Proverbs, "John 6"]   books or chapters whose repeats are on purpose
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { BOOKS, isSpecialDay, splitReferences, parseReference, suggestBook } = require('../src/lib/scripture');
const { parsePlanDate, planDayDate, formatISO } = require('../src/lib/planDate');

const PLAN_DIR = path.join(__dirname, '..', 'src', 'plan');
/** Warn when the last scheduled church plan ends within this many days. */
const LOOKAHEAD_DAYS = 60;

function loadPlans(dir = PLAN_DIR) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      // A missing closing "---" is tolerated (as 11ty does): the rest of the file is front matter.
      const match = text.match(/^---\r?\n([\s\S]*?)(?:\r?\n---[ \t]*(?:\r?\n|$)|$)/);
      if (!match) return { file, error: 'No front matter found' };
      try {
        return { file, data: yaml.load(match[1]) || {} };
      } catch (e) {
        return { file, error: `YAML could not be read: ${e.message.split('\n')[0]}` };
      }
    });
}

const fmtDate = (d) =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Validates one plan. Returns { errors, warnings, info } lists of human-readable strings. */
function checkPlan(data) {
  const errors = [];
  const warnings = [];
  const info = [];
  const days = Array.isArray(data.plan) ? data.plan : [];
  const start = parsePlanDate(data.start);

  if (!data.title) errors.push('Plan has no title.');
  if (!Array.isArray(data.plan) || days.length === 0) errors.push('Plan has no days.');
  if (data.start && !start) errors.push(`Start date "${data.start}" isn't a real date (use MM-DD-YYYY or YYYY-MM-DD).`);

  const where = (i) => {
    const date = start ? planDayDate(start, i) : null;
    return date ? `Day ${i + 1} (${fmtDate(date)})` : `Day ${i + 1}`;
  };

  const allowRepeat = new Set((data.intentional_repeats || []).map((s) => String(s).toLowerCase()));
  const firstSeen = new Map(); // "Book N" → day index, whole-chapter readings only
  const repeats = [];
  const chaptersByBook = new Map(); // book name → Set of chapters

  days.forEach((entry, i) => {
    if (entry == null || typeof entry !== 'object') {
      errors.push(`${where(i)}: empty row.`);
      return;
    }
    for (const field of ['day', 'alt']) {
      const value = entry[field];
      if (value == null || value === '') {
        if (field === 'day') errors.push(`${where(i)}: no reading.`);
        continue;
      }
      if (isSpecialDay(value)) {
        if (field === 'day' && String(value).trim() === "Lord's Day" && start) {
          const date = planDayDate(start, i);
          if (date.getUTCDay() !== 0) warnings.push(`${where(i)}: "Lord's Day" isn't on a Sunday. Rows may have shifted.`);
        }
        continue;
      }
      for (const text of splitReferences(value)) {
        const ref = parseReference(text);
        const label = field === 'alt' ? `${where(i)} (alternate)` : where(i);
        if (!ref.ok) {
          if (ref.reason === 'unknown-book') {
            const guess = suggestBook(ref.bookName);
            errors.push(`${label}: "${ref.text}" isn't a book of the Bible.${guess ? ` Did you mean ${guess.name}?` : ''}`);
          } else if (ref.reason === 'missing-chapter') {
            errors.push(
              `${label}: "${ref.text}" has no chapter number.` +
                (ref.book.chapters === 1 ? ` ${ref.book.name} has only one chapter: use "${ref.book.name} 1".` : '')
            );
          } else if (ref.reason === 'chapter-out-of-range') {
            errors.push(`${label}: "${ref.text}" doesn't exist. ${ref.book.name} has ${ref.book.chapters} chapters.`);
          } else {
            errors.push(`${label}: couldn't read "${ref.text}".`);
          }
          continue;
        }
        if (field !== 'day') continue;
        if (!chaptersByBook.has(ref.book.name)) chaptersByBook.set(ref.book.name, new Set());
        chaptersByBook.get(ref.book.name).add(ref.chapter);
        if (ref.verses) continue; // split chapters (Psalm 119:1-32, …) aren't repeats
        const key = `${ref.book.name} ${ref.chapter}`;
        if (firstSeen.has(key)) {
          if (!allowRepeat.has(ref.book.name.toLowerCase()) && !allowRepeat.has(key.toLowerCase())) {
            repeats.push({ key, first: firstSeen.get(key), again: i });
          }
        } else {
          firstSeen.set(key, i);
        }
      }
    }
  });

  if (repeats.length) {
    const detail = repeats.map((r) => `${r.key} (days ${r.first + 1} and ${r.again + 1})`);
    warnings.push({ summary: `${repeats.length} chapter(s) read more than once`, detail });
  }

  // A book read almost straight through with a few holes is probably a typo
  // (e.g. Jeremiah 43, 45, 46, 48, 48 → 44 and 47 missing).
  for (const [name, chapters] of chaptersByBook) {
    const sorted = [...chapters].sort((a, b) => a - b);
    const lo = sorted[0];
    const hi = sorted[sorted.length - 1];
    const missing = [];
    for (let c = lo; c <= hi; c++) if (!chapters.has(c)) missing.push(c);
    const span = hi - lo + 1;
    if (missing.length > 0 && missing.length <= 3 && sorted.length >= 5 && missing.length / span <= 0.1) {
      warnings.push(`${name} ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} never read, though ${name} ${lo}–${hi} is otherwise read straight through.`);
    }
  }

  const totalChapters = [...chaptersByBook.values()].reduce((n, s) => n + s.size, 0);
  info.push(`${days.length} days, ${totalChapters} different chapters from ${chaptersByBook.size} books.`);

  return { errors, warnings, info, start, end: start && days.length ? planDayDate(start, days.length - 1) : null };
}

/** Checks between plans: overlapping dates, and whether anything is scheduled after the last plan. */
function checkSchedule(results, today = new Date()) {
  const warnings = [];
  const dated = results.filter((r) => r.start && r.end).sort((a, b) => a.start - b.start);
  for (let i = 1; i < dated.length; i++) {
    const prev = dated[i - 1];
    const cur = dated[i];
    if (cur.start <= prev.end) {
      const overlapDays = Math.round((prev.end - cur.start) / 86400000) + 1;
      warnings.push(`"${prev.title}" (ends ${fmtDate(prev.end)}) overlaps "${cur.title}" (starts ${fmtDate(cur.start)}) by ${overlapDays} day(s).`);
    }
  }
  const last = dated[dated.length - 1];
  const todayUTC = parsePlanDate(today);
  if (last && (last.end - todayUTC) / 86400000 <= LOOKAHEAD_DAYS) {
    const next = new Date(last.end);
    next.setUTCDate(next.getUTCDate() + 1);
    warnings.push(`Nothing is scheduled after ${fmtDate(last.end)} ("${last.title}"). Readers will see no reading from ${fmtDate(next)}.`);
  }
  return warnings;
}

function run(argv = process.argv.slice(2)) {
  const verbose = argv.includes('-v') || argv.includes('--verbose');
  const asJson = argv.includes('--json');
  const plans = loadPlans();
  const results = plans.map(({ file, data, error }) => {
    if (error) return { file, title: file, errors: [error], warnings: [], info: [] };
    return { file, title: data.title || file, ...checkPlan(data) };
  });
  const scheduleWarnings = checkSchedule(results);
  const errorCount = results.reduce((n, r) => n + r.errors.length, 0);

  if (asJson) {
    const out = results.map(({ start, end, ...r }) => ({ ...r, start: start && formatISO(start), end: end && formatISO(end) }));
    console.log(JSON.stringify({ plans: out, schedule: scheduleWarnings, errorCount }, null, 2));
    return errorCount ? 1 : 0;
  }

  const c = process.stdout.isTTY ? { red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', dim: '\x1b[2m', reset: '\x1b[0m' } : { red: '', yellow: '', green: '', dim: '', reset: '' };
  for (const r of results) {
    const status = r.errors.length ? `${c.red}✗` : r.warnings.length ? `${c.yellow}!` : `${c.green}✓`;
    const range = r.start ? `${formatISO(r.start)} → ${formatISO(r.end)}` : 'no start date';
    console.log(`${status} ${r.title}${c.reset} ${c.dim}(${r.file}, ${range})${c.reset}`);
    for (const e of r.errors) console.log(`    ${c.red}error${c.reset}    ${e}`);
    for (const w of r.warnings) {
      if (typeof w === 'string') {
        console.log(`    ${c.yellow}warning${c.reset}  ${w}`);
      } else {
        const shown = verbose ? w.detail : w.detail.slice(0, 5);
        const more = w.detail.length - shown.length;
        console.log(`    ${c.yellow}warning${c.reset}  ${w.summary}: ${shown.join('; ')}${more ? `; … ${more} more (use -v)` : ''}`);
      }
    }
  }
  for (const w of scheduleWarnings) console.log(`${c.yellow}!${c.reset} ${w}`);
  console.log(
    errorCount
      ? `\n${c.red}${errorCount} error(s). Fix these before publishing.${c.reset}`
      : `\n${c.green}No errors.${c.reset} ${BOOKS.length}-book canon, ${results.length} plans checked.`
  );
  return errorCount ? 1 : 0;
}

if (require.main === module) process.exit(run());

module.exports = { loadPlans, checkPlan, checkSchedule };
