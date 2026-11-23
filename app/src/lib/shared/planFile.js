// @ts-check
/**
 * Reads and writes plan files (`src/plan/<name>.md`) in the same layout as the existing ones,
 * so a plan published from the admin works unchanged with the current site and Subsplash:
 *
 *   ---
 *   title: 2027 Bible Reading Plan
 *   description: Our reading plan for the year 2027.
 *   start: 01-04-2027
 *   current: false
 *   plan:
 *     - day: Genesis 1, Genesis 2
 *   ---
 */
import yaml from 'js-yaml';
import { parsePlanDate } from './planDate.js';

/**
 * @typedef {{ day: string, alt?: string }} PlanDay
 * @typedef {{ title: string, description: string, start: string, current: boolean,
 *             plan: PlanDay[], extra: Record<string, unknown> }} PlanSource
 *   `start` is "" (self-paced) or "MM-DD-YYYY"; `extra` keeps any other front-matter keys.
 */

/**
 * Parses a plan file. A missing closing `---` is tolerated, as 11ty does.
 * @param {string} text
 * @returns {PlanSource}
 */
export function parsePlanFile(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)(?:\r?\n---[ \t]*(?:\r?\n|$)|$)/);
  const data = /** @type {Record<string, unknown>} */ ((match && yaml.load(match[1])) || {});
  const { title, description, start, current, plan, ...extra } = data;
  return {
    title: String(title ?? ''),
    description: String(description ?? ''),
    start: start ? toPlanDate(start) : '',
    current: Boolean(current),
    plan: (Array.isArray(plan) ? plan : []).map((d) => ({
      day: String(d?.day ?? ''),
      ...(d?.alt ? { alt: String(d.alt) } : {})
    })),
    extra
  };
}

/**
 * "MM-DD-YYYY" (what the existing files and the current site use), from either format.
 * @param {unknown} value
 */
export function toPlanDate(value) {
  const date = parsePlanDate(value);
  if (!date) return String(value ?? '');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}-${date.getUTCFullYear()}`;
}

/**
 * Writes a plan file.
 * @param {PlanSource} source
 * @returns {string}
 */
export function serializePlanFile(source) {
  /** @type {Record<string, unknown>} */
  const data = { title: source.title.trim() };
  if (source.description?.trim()) data.description = source.description.trim();
  if (source.start) data.start = toPlanDate(source.start);
  data.current = Boolean(source.current);
  for (const [k, v] of Object.entries(source.extra ?? {})) data[k] = v;
  data.plan = source.plan.map((d) => {
    /** @type {PlanDay} */
    const day = { day: d.day.trim() };
    if (d.alt?.trim()) day.alt = d.alt.trim();
    return day;
  });
  const body = yaml.dump(data, { lineWidth: -1, noRefs: true, quotingType: '"' });
  return `---\n${body}---\n`;
}

/**
 * Git's blob id for file contents (what GitHub calls a file's `sha`). Used to notice when a
 * plan was changed by someone else after it was opened for editing.
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function gitBlobSha(text) {
  const body = new TextEncoder().encode(text);
  const header = new TextEncoder().encode(`blob ${body.length}\0`);
  const all = new Uint8Array(header.length + body.length);
  all.set(header);
  all.set(body, header.length);
  const digest = await crypto.subtle.digest('SHA-1', all);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
