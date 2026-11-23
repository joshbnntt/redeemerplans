// @ts-check
/**
 * Plan checks shared by the build (`npm run check:plans`), the v2 app and, later, the admin
 * page in the browser. Pure functions: no file system, no network.
 */
import { BOOKS, isSpecialDay, splitReferences, parseReference, suggestBook } from './scripture.js';
import { parsePlanDate, planDayDate } from './planDate.js';

/**
 * @typedef {{ day?: string, alt?: string } | null | undefined} PlanEntry
 * @typedef {{ title?: string, description?: string, start?: unknown, current?: boolean,
 *             plan?: PlanEntry[], intentional_repeats?: string[] }} PlanData
 * @typedef {{ level: 'error' | 'warning', message: string, day?: number, fix?: string, detail?: string[] }} Issue
 * @typedef {'live' | 'upcoming' | 'past' | 'self-paced'} PlanStatus
 */

/** @param {Date} d */
export const fmtDate = (d) =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const DAY_MS = 86400000;

/**
 * Where a plan sits relative to `today`. Only live and upcoming plans can block a deploy.
 * @param {PlanData} data
 * @param {Date} [today]
 * @returns {{ status: PlanStatus, start: Date | null, end: Date | null }}
 */
export function planStatus(data, today = new Date()) {
  const start = parsePlanDate(data.start);
  const days = Array.isArray(data.plan) ? data.plan.length : 0;
  const end = start && days ? planDayDate(start, days - 1) : null;
  const t = /** @type {Date} */ (parsePlanDate(today));
  if (!start || !end) return { status: 'self-paced', start, end };
  if (t < start) return { status: 'upcoming', start, end };
  if (t > end) return { status: data.current ? 'live' : 'past', start, end };
  return { status: 'live', start, end };
}

/**
 * Checks one plan.
 * @param {PlanData} data
 * @returns {{ issues: Issue[], days: number, chapters: number, books: number }}
 */
export function checkPlan(data) {
  /** @type {Issue[]} */
  const issues = [];
  const days = Array.isArray(data.plan) ? data.plan : [];
  const start = parsePlanDate(data.start);
  /** @type {(message: string, day?: number, fix?: string) => void} */
  const error = (message, day, fix) => {
    issues.push({ level: 'error', message, day, fix });
  };
  /** @type {(message: string, day?: number) => void} */
  const warn = (message, day) => {
    issues.push({ level: 'warning', message, day });
  };

  if (!data.title) error('Plan has no title.');
  if (days.length === 0) error('Plan has no days.');
  if (data.start && !start) error(`Start date "${data.start}" isn't a real date (use MM-DD-YYYY or YYYY-MM-DD).`);

  /** @param {number} i */
  const where = (i) => {
    const date = start ? planDayDate(start, i) : null;
    return date ? `Day ${i + 1} (${fmtDate(date)})` : `Day ${i + 1}`;
  };

  const allowRepeat = new Set((data.intentional_repeats || []).map((s) => String(s).toLowerCase()));
  /** @type {Map<string, number>} */
  const firstSeen = new Map();
  /** @type {{ key: string, first: number, again: number }[]} */
  const repeats = [];
  /** @type {Map<string, Set<number>>} */
  const chaptersByBook = new Map();

  days.forEach((entry, i) => {
    if (entry == null || typeof entry !== 'object') {
      error(`${where(i)}: empty row.`, i + 1);
      return;
    }
    for (const field of /** @type {const} */ (['day', 'alt'])) {
      const value = entry[field];
      if (value == null || value === '') {
        if (field === 'day') error(`${where(i)}: no reading.`, i + 1);
        continue;
      }
      if (isSpecialDay(value)) {
        if (field === 'day' && String(value).trim() === "Lord's Day" && start) {
          const date = /** @type {Date} */ (planDayDate(start, i));
          if (date.getUTCDay() !== 0) warn(`${where(i)}: "Lord's Day" isn't on a Sunday.`, i + 1);
        }
        continue;
      }
      for (const text of splitReferences(value)) {
        const ref = parseReference(text);
        const label = field === 'alt' ? `${where(i)} (alternate)` : where(i);
        if (!ref.ok) {
          if (ref.reason === 'unknown-book') {
            const guess = suggestBook(ref.bookName || '');
            const fixed = guess ? ref.text.replace(/^.*?(?=\s*\d+(?::[\d\s\-–]+)?$)/, guess.name) : undefined;
            error(`${label}: "${ref.text}" isn't a book of the Bible.${guess ? ` Did you mean ${guess.name}?` : ''}`, i + 1, fixed);
          } else if (ref.reason === 'missing-chapter' && ref.book) {
            const single = ref.book.chapters === 1;
            error(
              `${label}: "${ref.text}" has no chapter number.${single ? ` ${ref.book.name} has only one chapter.` : ''}`,
              i + 1,
              single ? `${ref.book.name} 1` : undefined
            );
          } else if (ref.reason === 'chapter-out-of-range' && ref.book) {
            error(`${label}: "${ref.text}" doesn't exist. ${ref.book.name} has ${ref.book.chapters} chapters.`, i + 1);
          } else {
            error(`${label}: couldn't read "${ref.text}".`, i + 1);
          }
          continue;
        }
        if (field !== 'day') continue;
        let set = chaptersByBook.get(ref.book.name);
        if (!set) chaptersByBook.set(ref.book.name, (set = new Set()));
        set.add(ref.chapter);
        if (ref.verses) continue; // split chapters (Psalm 119:1-32, …) aren't repeats
        const key = `${ref.book.name} ${ref.chapter}`;
        const seen = firstSeen.get(key);
        if (seen === undefined) firstSeen.set(key, i);
        else if (!allowRepeat.has(ref.book.name.toLowerCase()) && !allowRepeat.has(key.toLowerCase())) {
          repeats.push({ key, first: seen, again: i });
        }
      }
    }
  });

  if (repeats.length) {
    issues.push({
      level: 'warning',
      message: `${repeats.length} chapter${repeats.length === 1 ? ' is' : 's are'} read more than once.`,
      detail: repeats.map((r) => `${r.key} (days ${r.first + 1} and ${r.again + 1})`),
    });
  }

  // A book read almost straight through with a few holes is probably a typo.
  for (const [name, chapters] of chaptersByBook) {
    const sorted = [...chapters].sort((a, b) => a - b);
    const lo = sorted[0];
    const hi = sorted[sorted.length - 1];
    const missing = [];
    for (let c = lo; c <= hi; c++) if (!chapters.has(c)) missing.push(c);
    if (missing.length > 0 && missing.length <= 3 && sorted.length >= 5 && missing.length / (hi - lo + 1) <= 0.1) {
      warn(`${name} ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} skipped (${name} ${lo}–${hi} is otherwise read straight through).`);
    }
  }

  return {
    issues,
    days: days.length,
    chapters: [...chaptersByBook.values()].reduce((n, s) => n + s.size, 0),
    books: chaptersByBook.size,
  };
}

/**
 * Checks across plans: overlapping dates, and whether anything is scheduled ahead.
 * @param {{ title: string, start: Date | null, end: Date | null }[]} plans
 * @param {Date} [today]
 * @param {number} [lookaheadDays] warn when the last plan ends within this many days
 * @returns {string[]}
 */
export function checkSchedule(plans, today = new Date(), lookaheadDays = 60) {
  const warnings = [];
  const dated = /** @type {{ title: string, start: Date, end: Date }[]} */ (plans.filter((p) => p.start && p.end)).sort(
    (a, b) => +a.start - +b.start
  );
  for (let i = 1; i < dated.length; i++) {
    const prev = dated[i - 1];
    const cur = dated[i];
    if (cur.start <= prev.end) {
      const overlap = Math.round((+prev.end - +cur.start) / DAY_MS) + 1;
      warnings.push(`"${prev.title}" and "${cur.title}" overlap by ${overlap} day${overlap === 1 ? '' : 's'}.`);
    }
  }
  const last = dated[dated.length - 1];
  const t = /** @type {Date} */ (parsePlanDate(today));
  if (last && last.end >= t && (+last.end - +t) / DAY_MS <= lookaheadDays) {
    warnings.push(`No plan is scheduled after ${fmtDate(last.end)}.`);
  }
  return warnings;
}

export const CANON_SIZE = BOOKS.length;
