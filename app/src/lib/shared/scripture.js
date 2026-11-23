// @ts-check
/**
 * Bible canon + reference parsing, shared by the v2 app (build, admin, browser), the
 * legacy 11ty site and the plan checker. Plain ES module, no dependencies.
 *
 * `code` is the USFM book code used by YouVersion (bible.com) URLs.
 */

/** @typedef {{ name: string, code: string, chapters: number, aliases: string[] }} Book */

/** @type {Book[]} */
export const BOOKS = /** @type {[string, string, number, string[]][]} */ ([
  ['Genesis', 'GEN', 50, ['Gen', 'Ge', 'Gn']],
  ['Exodus', 'EXO', 40, ['Exod', 'Exo', 'Ex']],
  ['Leviticus', 'LEV', 27, ['Lev', 'Lv']],
  ['Numbers', 'NUM', 36, ['Num', 'Nm', 'Nu']],
  ['Deuteronomy', 'DEU', 34, ['Deut', 'Deu', 'Dt']],
  ['Joshua', 'JOS', 24, ['Josh', 'Jos']],
  ['Judges', 'JDG', 21, ['Judg', 'Jdg', 'Jg']],
  ['Ruth', 'RUT', 4, ['Rth', 'Ru']],
  ['1 Samuel', '1SA', 31, ['1 Sam', '1 Sa', '1Sam', 'I Samuel']],
  ['2 Samuel', '2SA', 24, ['2 Sam', '2 Sa', '2Sam', 'II Samuel']],
  ['1 Kings', '1KI', 22, ['1 Kgs', '1 Ki', '1Kgs', 'I Kings']],
  ['2 Kings', '2KI', 25, ['2 Kgs', '2 Ki', '2Kgs', 'II Kings']],
  ['1 Chronicles', '1CH', 29, ['1 Chron', '1 Chr', '1 Ch', '1Chr', 'I Chronicles']],
  ['2 Chronicles', '2CH', 36, ['2 Chron', '2 Chr', '2 Ch', '2Chr', 'II Chronicles']],
  ['Ezra', 'EZR', 10, ['Ezr']],
  ['Nehemiah', 'NEH', 13, ['Neh', 'Ne']],
  ['Esther', 'EST', 10, ['Esth', 'Est', 'Es']],
  ['Job', 'JOB', 42, ['Jb']],
  ['Psalm', 'PSA', 150, ['Psalms', 'Ps', 'Psa', 'Pss']],
  ['Proverbs', 'PRO', 31, ['Prov', 'Pro', 'Prv', 'Pr']],
  ['Ecclesiastes', 'ECC', 12, ['Eccl', 'Ecc', 'Qoh']],
  ['Song of Solomon', 'SNG', 8, ['Song of Songs', 'Song', 'Song of Sol', 'SS', 'Canticles']],
  ['Isaiah', 'ISA', 66, ['Isa', 'Is']],
  ['Jeremiah', 'JER', 52, ['Jer', 'Je']],
  ['Lamentations', 'LAM', 5, ['Lam', 'La']],
  ['Ezekiel', 'EZK', 48, ['Ezek', 'Eze', 'Ezk']],
  ['Daniel', 'DAN', 12, ['Dan', 'Da', 'Dn']],
  ['Hosea', 'HOS', 14, ['Hos', 'Ho']],
  ['Joel', 'JOL', 3, ['Jl']],
  ['Amos', 'AMO', 9, ['Am']],
  ['Obadiah', 'OBA', 1, ['Obad', 'Ob']],
  ['Jonah', 'JON', 4, ['Jon', 'Jnh']],
  ['Micah', 'MIC', 7, ['Mic', 'Mc']],
  ['Nahum', 'NAM', 3, ['Nah', 'Na']],
  ['Habakkuk', 'HAB', 3, ['Hab', 'Hb']],
  ['Zephaniah', 'ZEP', 3, ['Zeph', 'Zep', 'Zp']],
  ['Haggai', 'HAG', 2, ['Hag', 'Hg']],
  ['Zechariah', 'ZEC', 14, ['Zech', 'Zec', 'Zc']],
  ['Malachi', 'MAL', 4, ['Mal', 'Ml']],
  ['Matthew', 'MAT', 28, ['Matt', 'Mat', 'Mt']],
  ['Mark', 'MRK', 16, ['Mrk', 'Mk', 'Mr']],
  ['Luke', 'LUK', 24, ['Luk', 'Lk']],
  ['John', 'JHN', 21, ['Jhn', 'Jn']],
  ['Acts', 'ACT', 28, ['Act', 'Ac']],
  ['Romans', 'ROM', 16, ['Rom', 'Ro', 'Rm']],
  ['1 Corinthians', '1CO', 16, ['1 Cor', '1 Co', '1Cor', 'I Corinthians']],
  ['2 Corinthians', '2CO', 13, ['2 Cor', '2 Co', '2Cor', 'II Corinthians']],
  ['Galatians', 'GAL', 6, ['Gal', 'Ga']],
  ['Ephesians', 'EPH', 6, ['Eph', 'Ephes']],
  ['Philippians', 'PHP', 4, ['Phil', 'Php', 'Pp']],
  ['Colossians', 'COL', 4, ['Col']],
  ['1 Thessalonians', '1TH', 5, ['1 Thess', '1 Th', '1Thess', 'I Thessalonians']],
  ['2 Thessalonians', '2TH', 3, ['2 Thess', '2 Th', '2Thess', 'II Thessalonians']],
  ['1 Timothy', '1TI', 6, ['1 Tim', '1 Ti', '1Tim', 'I Timothy']],
  ['2 Timothy', '2TI', 4, ['2 Tim', '2 Ti', '2Tim', 'II Timothy']],
  ['Titus', 'TIT', 3, ['Tit']],
  ['Philemon', 'PHM', 1, ['Philem', 'Phm', 'Phlm']],
  ['Hebrews', 'HEB', 13, ['Heb']],
  ['James', 'JAS', 5, ['Jas', 'Jm']],
  ['1 Peter', '1PE', 5, ['1 Pet', '1 Pe', '1Pet', 'I Peter']],
  ['2 Peter', '2PE', 3, ['2 Pet', '2 Pe', '2Pet', 'II Peter']],
  ['1 John', '1JN', 5, ['1 Jn', '1 Jhn', '1Jn', 'I John']],
  ['2 John', '2JN', 1, ['2 Jn', '2 Jhn', '2Jn', 'II John']],
  ['3 John', '3JN', 1, ['3 Jn', '3 Jhn', '3Jn', 'III John']],
  ['Jude', 'JUD', 1, ['Jud', 'Jd']],
  ['Revelation', 'REV', 22, ['Rev', 'Re', 'Revelations', 'Apocalypse']],
]).map(([name, code, chapters, aliases]) => ({ name, code, chapters, aliases }));

/** Entries that are not Scripture references (rest days etc.). */
export const SPECIAL_DAYS = ["Lord's Day", 'Grace Day'];

/** @param {unknown} s */
const normalizeKey = (s) => String(s).toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();

const LOOKUP = new Map();
for (const book of BOOKS) {
  for (const key of [book.name, book.code, ...book.aliases]) LOOKUP.set(normalizeKey(key), book);
}

/**
 * Finds a book by its name, USFM code or a common abbreviation (case-insensitive).
 * @param {string | null | undefined} name
 * @returns {Book | null}
 */
export function resolveBook(name) {
  if (name == null) return null;
  return LOOKUP.get(normalizeKey(name)) || null;
}

/** @param {unknown} text */
export function isSpecialDay(text) {
  return SPECIAL_DAYS.includes(String(text).trim());
}

/**
 * Splits a day/alt string into individual references ("A 1, B 2" → ["A 1", "B 2"]).
 * @param {unknown} text
 * @returns {string[]}
 */
export function splitReferences(text) {
  if (text == null) return [];
  return String(text).split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * @typedef {{ ok: true, book: Book, chapter: number, verses: string | null, text: string }} Reference
 * @typedef {{ ok: false, reason: 'unparseable' | 'unknown-book' | 'missing-chapter' | 'chapter-out-of-range',
 *             text: string, book?: Book, bookName?: string, chapter?: number }} BadReference
 */

/**
 * Parses one reference such as "Psalm 119:1-32" or "1 John 3".
 * @param {unknown} text
 * @returns {Reference | BadReference}
 */
export function parseReference(text) {
  const ref = String(text).trim().replace(/\s+/g, ' ');
  const m = ref.match(/^(.*?)\s*(\d+)(?:\s*:\s*(\d+(?:\s*[-–]\s*\d+)?))?$/);
  if (!m || !m[1]) {
    // Maybe a bare book name with no chapter ("Jude").
    const book = resolveBook(ref);
    if (book) return { ok: false, reason: 'missing-chapter', text: ref, book };
    return { ok: false, reason: 'unparseable', text: ref };
  }
  const [, bookName, chapterStr, verses] = m;
  const book = resolveBook(bookName);
  if (!book) {
    return { ok: false, reason: 'unknown-book', text: ref, bookName: bookName.trim() };
  }
  const chapter = Number(chapterStr);
  if (chapter < 1 || chapter > book.chapters) {
    return { ok: false, reason: 'chapter-out-of-range', text: ref, book, chapter };
  }
  return { ok: true, book, chapter, verses: verses ? verses.replace(/\s+/g, '').replace('–', '-') : null, text: ref };
}

/**
 * Levenshtein distance, for "did you mean…?" suggestions.
 * @param {string} a
 * @param {string} b
 */
function distance(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/**
 * Closest book to a misspelling, or null if nothing is reasonably close.
 * @param {string} name
 * @returns {Book | null}
 */
export function suggestBook(name) {
  let best = null;
  let bestScore = Infinity;
  for (const book of BOOKS) {
    for (const candidate of [book.name, ...book.aliases]) {
      const d = distance(name, candidate);
      if (d < bestScore) {
        bestScore = d;
        best = book;
      }
    }
  }
  return bestScore <= Math.max(2, Math.floor(name.length / 4)) ? best : null;
}

