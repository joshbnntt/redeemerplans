// @ts-check
/** Builds reading links from structured references, for the reader's chosen app and translation. */

/** @typedef {{ book: string, name: string, chapter: number, verses?: string }} Ref */

/** YouVersion translation ids. */
export const YOUVERSION_IDS = /** @type {const} */ ({
  ESV: 59, CSB: 1713, KJV: 1, LSB: 3345, NASB: 2692, NIV: 111, NKJV: 114, NLT: 116,
});

/** @typedef {keyof typeof YOUVERSION_IDS} Translation */
/** @typedef {'youversion' | 'esv' | 'biblegateway'} ReadingApp */

/**
 * @param {Ref} ref
 * @param {{ app?: ReadingApp, translation?: Translation }} [prefs]
 */
export function passageUrl(ref, { app = 'youversion', translation = 'ESV' } = {}) {
  const label = `${ref.name} ${ref.chapter}${ref.verses ? `:${ref.verses}` : ''}`;
  if (app === 'esv') return `https://www.esv.org/${encodeURIComponent(label).replace(/%20/g, '+')}/`;
  if (app === 'biblegateway') {
    return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(label)}&version=${translation}`;
  }
  const id = YOUVERSION_IDS[translation] ?? 59;
  return `https://www.bible.com/bible/${id}/${ref.book}.${ref.chapter}${ref.verses ? `.${ref.verses}` : ''}`;
}

/** @param {Ref} ref */
export const refLabel = (ref) => `${ref.name} ${ref.chapter}${ref.verses ? `:${ref.verses}` : ''}`;
