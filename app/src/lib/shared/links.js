// @ts-check
/** Builds reading links from structured references, for the reader's chosen app and translation. */

/** @typedef {{ book: string, name: string, chapter: number, verses?: string }} Ref */

/** YouVersion translation ids. */
export const YOUVERSION_IDS = /** @type {const} */ ({
  ESV: 59, CSB: 1713, KJV: 1, LSB: 3345, NASB: 2692, NIV: 111, NKJV: 114, NLT: 116,
});

/** @typedef {keyof typeof YOUVERSION_IDS} Translation */
/** Blue Letter Bible version codes, where they differ from our translation names. */
const BLB_VERSIONS = /** @type {Partial<Record<Translation, string>>} */ ({ NASB: 'NASB20' });

/** @typedef {'youversion' | 'esv' | 'lsb' | 'biblegateway' | 'blueletterbible'} ReadingApp */

/**
 * @param {Ref} ref
 * @param {{ app?: ReadingApp, translation?: Translation }} [prefs]
 */
export function passageUrl(ref, { app = 'youversion', translation = 'ESV' } = {}) {
  const label = `${ref.name} ${ref.chapter}${ref.verses ? `:${ref.verses}` : ''}`;
  if (app === 'esv') return `https://www.esv.org/${encodeURIComponent(label).replace(/%20/g, '+')}/`;
  // read.lsbible.org only has the LSB, so the translation choice doesn't apply.
  if (app === 'lsb') return `https://read.lsbible.org/?q=${encodeURIComponent(label).replace(/%20/g, '+')}`;
  if (app === 'biblegateway') {
    return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(label)}&version=${translation}`;
  }
  if (app === 'blueletterbible') {
    // BLB's search endpoint takes a plain reference (including verse ranges) and redirects to the passage.
    const version = BLB_VERSIONS[translation] ?? translation;
    return `https://www.blueletterbible.org/search/preSearch.cfm?Criteria=${encodeURIComponent(label).replace(/%20/g, '+')}&t=${version}`;
  }
  const id = YOUVERSION_IDS[translation] ?? 59;
  return `https://www.bible.com/bible/${id}/${ref.book}.${ref.chapter}${ref.verses ? `.${ref.verses}` : ''}`;
}

/** @param {Ref} ref */
export const refLabel = (ref) => `${ref.name} ${ref.chapter}${ref.verses ? `:${ref.verses}` : ''}`;
