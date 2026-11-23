// @ts-check
/**
 * Plan dates are calendar dates with no time zone. Plans written so far use "MM-DD-YYYY";
 * ISO "YYYY-MM-DD" is also accepted. All arithmetic is done in UTC so results never shift
 * with the build machine's or the reader's time zone.
 */

/**
 * @param {unknown} value
 * @returns {Date | null} midnight UTC of the given calendar date, or null if empty/invalid.
 */
export function parsePlanDate(value) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (value == null || value === '') return null;
  const s = String(value).trim();
  /** @type {string} */ let y, m, d;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) [, y, m, d] = match;
  else if ((match = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) [, m, d, y] = match;
  else return null;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  // Reject impossible dates like 02-30-2026 rather than silently rolling over.
  if (date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return null;
  return date;
}

/**
 * Date of the reading at zero-based `offset` from `start`, or null when the plan has no start.
 * @param {unknown} start
 * @param {number} [offset]
 */
export function planDayDate(start, offset = 0) {
  const date = parsePlanDate(start);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

/**
 * "MM/DD/YYYY", the format used by the v1 JSON API and the Supabase `haveread` table.
 * @param {Date} date
 */
export function formatUS(date) {
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${mm}/${dd}/${date.getUTCFullYear()}`;
}

/**
 * "YYYY-MM-DD"
 * @param {Date} date
 */
export function formatISO(date) {
  return date.toISOString().slice(0, 10);
}

