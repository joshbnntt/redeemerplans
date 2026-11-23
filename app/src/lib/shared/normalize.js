// @ts-check
/**
 * Turns what people type or paste into the format the plans already use:
 *   "Gen 1-3; Ps 23"  →  "Genesis 1, Genesis 2, Genesis 3, Psalm 23"
 *   "lords day"       →  "Lord's Day"
 * Anything it can't make sense of is left exactly as typed, so the plan checks can point it out.
 */
import { resolveBook } from './scripture.js';

/** @param {string} s */
const clean = (s) => s.replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').trim();

/** @param {string} text */
function specialDay(text) {
  const key = clean(text).toLowerCase().replace(/[^a-z]/g, '');
  if (key === 'lordsday' || key === 'thelordsday') return "Lord's Day";
  if (key === 'graceday') return 'Grace Day';
  return null;
}

/**
 * Normalizes one reference. Returns one or more references (a chapter range expands to one
 * per chapter, the way the existing plans list them).
 * @param {string} text
 * @returns {string[]}
 */
export function normalizeReference(text) {
  const ref = clean(text);
  // Book, then chapter, then optionally ":verses" or "-lastChapter".
  const m = ref.match(/^(.*?)\s*(\d+)\s*(?::\s*(\d+(?:\s*[-–—]\s*\d+)?)|[-–—]\s*(\d+))?$/);
  if (!m || !m[1]) {
    const book = resolveBook(ref);
    return [book ? book.name : ref]; // "Jude" stays without a chapter; the checks offer "Jude 1"
  }
  const [, bookName, chapterStr, verses, lastChapterStr] = m;
  const book = resolveBook(bookName);
  if (!book) return [ref];
  const chapter = Number(chapterStr);
  if (verses) return [`${book.name} ${chapter}:${verses.replace(/\s+/g, '').replace(/[–—]/g, '-')}`];
  if (lastChapterStr) {
    const last = Number(lastChapterStr);
    // "Jude 1-3" can only mean verses; leave anything that isn't a sensible chapter range alone.
    if (last > chapter && last <= book.chapters && last - chapter < 50) {
      return Array.from({ length: last - chapter + 1 }, (_, i) => `${book.name} ${chapter + i}`);
    }
    return [ref];
  }
  return [`${book.name} ${chapter}`];
}

/**
 * Normalizes a whole day's reading ("Gen 1-2; Matt 1" → "Genesis 1, Genesis 2, Matthew 1").
 * @param {string | null | undefined} text
 * @returns {string}
 */
export function normalizeReading(text) {
  if (text == null) return '';
  const value = clean(String(text));
  if (!value) return '';
  const special = specialDay(value);
  if (special) return special;
  return value
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap(normalizeReference)
    .join(', ');
}
