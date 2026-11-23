// @ts-check
/**
 * Reads rows pasted from Google Sheets / Excel (tab-separated) or a CSV file into plan days.
 *
 * Columns are found automatically: a date column (optional), the reading, and an optional
 * alternate reading. With a header row, names like "Date", "Reading"/"Passage"/"Day" and
 * "Alternate"/"Alt" are recognized; without one, the column that holds dates is the date and the
 * next text column is the reading.
 */
import { normalizeReading } from './normalize.js';

/**
 * @typedef {{ row: number, date?: string, typed: string, day: string, typedAlt?: string, alt?: string }} ImportedDay
 *   `row` is the 1-based line in the pasted text; `date` is YYYY-MM-DD; `day`/`alt` are normalized.
 * @typedef {{ days: ImportedDay[], start?: string, columns: { date?: number, day: number, alt?: number },
 *             hasHeader: boolean, notes: string[] }} ImportResult
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Parses a date as people type it in spreadsheets. Returns YYYY-MM-DD or null.
 * Accepts 1/4/2027, 01-04-2027, 1/4/27, 2027-01-04, "Jan 4, 2027", "Monday, January 4, 2027".
 * @param {string} text
 */
export function parseSheetDate(text) {
  const s = text.trim();
  let y, m, d;
  let match;
  if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [, y, m, d] = match.map(Number);
  else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/))) {
    [, m, d, y] = match.map(Number);
    if (y < 100) y += 2000;
  } else if ((match = s.match(/^(?:[a-z]+,?\s+)?([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/i))) {
    m = MONTHS.indexOf(match[1].toLowerCase()) + 1;
    d = Number(match[2]);
    y = Number(match[3]);
    if (!m) return null;
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Splits pasted text into rows of cells. Tabs win when present (spreadsheet paste); otherwise
 * CSV with quotes is supported. Readings contain commas, so a comma-separated paste without quotes
 * is treated as one column.
 * @param {string} text
 * @returns {string[][]}
 */
export function splitRows(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.some((l) => l.includes('\t'))) return lines.map((l) => l.split('\t'));
  if (!text.includes('"')) return lines.map((l) => [l]);
  // Quoted CSV (e.g. a downloaded .csv file).
  /** @type {string[][]} */
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

/** @param {string} h */
const headerKind = (h) => {
  const k = h.trim().toLowerCase();
  if (/^(date|day of|when)/.test(k)) return 'date';
  if (/^(alt|alternate)/.test(k)) return 'alt';
  if (/^(reading|readings|passage|passages|scripture|day|text|plan)/.test(k)) return 'day';
  return null;
};

/**
 * @param {string} text
 * @returns {ImportResult}
 */
export function importSheet(text) {
  // Blank rows at the start and end are ignored, but blank rows in the middle are kept as
  // blank days; dropping them would shift every later day by one.
  const all = splitRows(text).map((cells, i) => ({ cells: cells.map((c) => c.trim()), line: i + 1 }));
  const filled = (/** @type {{ cells: string[] }} */ r) => r.cells.some(Boolean);
  const first = all.findIndex(filled);
  const last = all.length - 1 - [...all].reverse().findIndex(filled);
  const rows = first === -1 ? [] : all.slice(first, last + 1);
  /** @type {string[]} */
  const notes = [];
  if (!rows.length) return { days: [], columns: { day: 0 }, hasHeader: false, notes: ['Nothing to import.'] };

  // Header row?
  const firstKinds = rows[0].cells.map(headerKind);
  const hasHeader = firstKinds.includes('day') || (firstKinds.includes('date') && !parseSheetDate(rows[0].cells[firstKinds.indexOf('date')] ?? ''));
  const body = hasHeader ? rows.slice(1) : rows;

  /** @type {{ date?: number, day: number, alt?: number }} */
  const columns = { day: 0 };
  if (hasHeader) {
    const at = (/** @type {string} */ kind) => firstKinds.indexOf(/** @type {any} */ (kind));
    if (at('date') >= 0) columns.date = at('date');
    columns.day = at('day') >= 0 ? at('day') : firstKinds.findIndex((k, i) => k === null && i !== columns.date);
    if (columns.day < 0) columns.day = 0;
    if (at('alt') >= 0) columns.alt = at('alt');
  } else {
    // No header: a column where most cells are dates is the date column.
    const width = Math.max(...body.map((r) => r.cells.length));
    for (let c = 0; c < width; c++) {
      const filled = body.filter((r) => r.cells[c]);
      if (filled.length && filled.filter((r) => parseSheetDate(r.cells[c])).length / filled.length > 0.8) {
        columns.date = c;
        break;
      }
    }
    const textCols = [...Array(width).keys()].filter((c) => c !== columns.date);
    columns.day = textCols[0] ?? 0;
    if (textCols[1] !== undefined && body.some((r) => r.cells[textCols[1]])) columns.alt = textCols[1];
  }

  /** @type {ImportedDay[]} */
  const days = body.map((r) => {
    const typed = r.cells[columns.day] ?? '';
    const typedAlt = columns.alt !== undefined ? r.cells[columns.alt] ?? '' : '';
    const date = columns.date !== undefined ? parseSheetDate(r.cells[columns.date] ?? '') ?? undefined : undefined;
    return {
      row: r.line,
      ...(date ? { date } : {}),
      typed,
      day: normalizeReading(typed),
      ...(typedAlt ? { typedAlt, alt: normalizeReading(typedAlt) } : {})
    };
  });

  // Plans are one row per day, so dates must follow on from each other.
  const start = days.find((d) => d.date)?.date;
  if (columns.date !== undefined && start) {
    const startMs = Date.parse(`${start}T00:00:00Z`);
    const offsetOf = (/** @type {string} */ iso) => Math.round((Date.parse(`${iso}T00:00:00Z`) - startMs) / 86400000);
    let reported = 0;
    days.forEach((d, i) => {
      if (reported >= 3) return;
      if (!d.date) {
        notes.push(`Row ${d.row}: the date couldn't be read, so it's counted as the next day.`);
        reported++;
      } else if (offsetOf(d.date) !== i) {
        notes.push(
          `Row ${d.row}: the date (${d.date}) doesn't follow the row before. Each row is one day, so check for a missing or extra row around here.`
        );
        reported++;
      }
    });
  }
  const empty = days.filter((d) => !d.day).length;
  if (empty) notes.push(`${empty} day${empty === 1 ? ' has' : 's have'} no reading.`);

  return { days, ...(start ? { start } : {}), columns, hasHeader, notes };
}
