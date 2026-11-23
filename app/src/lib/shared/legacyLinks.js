// @ts-check
/**
 * Builds the prebuilt HTML anchors in the v1 JSON API (`readinglinks`). Kept byte-for-byte
 * compatible with the original 11ty helper; new code should use `links.js` with structured refs.
 */
import { resolveBook } from './scripture.js';

/** @type {Record<string, number>} */
export const TRANSLATIONS = {
  KJV: 1,
  ESV: 59,
  CSB: 1713,
  NASB: 2692,
  LSB: 3345,
  NIV: 111,
  NKJV: 114,
  NLT: 116,
};

/**
 * @param {string | undefined} references e.g. "Genesis 1, Psalm 119:1-32"
 * @param {string} [translation]
 * @returns {string | null}
 */
export function generateBibleLinks(references, translation = 'ESV') {
  const tcode = TRANSLATIONS[translation] ?? 59;
  try {
    if (typeof references === 'undefined') return null;
    if (references === 'Grace Day' || references === "Lord's Day") return references;
    const referencesArray = references.split(',').map((reference) => reference.trim());
    const links = [];

    for (let i = 0; i < referencesArray.length; i++) {
      const reference = referencesArray[i];
      const parts = reference.split(' ');
      const book = parts.slice(0, -1).join(' '); // book names can have several words
      const versePart = parts[parts.length - 1];
      const isLast = i + 1 === referencesArray.length;
      let chapter = '';
      let verse = '';

      if (versePart.includes(':')) {
        [chapter, verse] = versePart.split(':');
      } else {
        chapter = versePart;
      }

      // Accepts aliases too ("Song of Songs", "Psalms"). Unknown books are skipped here
      // and reported by the plan checks.
      const bookInfo = resolveBook(book);
      if (!bookInfo) continue;

      let link = 'https://www.bible.com/bible/' + tcode + '/' + bookInfo.code + '.' + chapter;
      if (verse) link += '.' + verse;
      const endAnchorTag = isLast ? '</a>' : ',</a>';
      links.push('<a class="block underline text-base-content" href="' + link + '" alt="' + reference + '">' + reference + endAnchorTag);
    }

    return links.join(' ');
  } catch (e) {
    console.log(e);
    return /** @type {string} */ (references);
  }
}
