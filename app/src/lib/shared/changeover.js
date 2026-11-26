// @ts-check
/**
 * Decides whether the "current" plan should move to a plan that has just started.
 * Used by the daily scheduled check (/api/cron/changeover). Pure: no network, no file system.
 */
import { parsePlanDate, planDayDate } from './planDate.js';

/*
 * The current plan is what the church app (Subsplash) shows, so this is deliberately cautious:
 * - extra plans (`supplemental: true`, e.g. Advent) are never switched to;
 * - a plan only takes over from the current one if it starts strictly later, so two plans
 *   starting the same day never move the flag;
 * - and only within CATCH_UP_DAYS of its start.
 */

/** A plan is only switched to within this many days of its start, so a manual choice made
 *  later is never overridden, while a missed daily run is still caught up. */
export const CATCH_UP_DAYS = 3;

/**
 * @typedef {{ file: string, title: string, start: unknown, current: boolean, days: number, supplemental?: boolean }} ChangeoverPlan
 * @typedef {{ action: 'none', reason: string }
 *         | { action: 'switch', to: ChangeoverPlan, from: ChangeoverPlan[] }} ChangeoverDecision
 */

/**
 * @param {ChangeoverPlan[]} plans every plan, as currently published
 * @param {string} today the church's local date, YYYY-MM-DD
 * @returns {ChangeoverDecision}
 */
export function decideChangeover(plans, today) {
  const t = /** @type {Date} */ (parsePlanDate(today));
  const live = plans
    .filter((p) => !p.supplemental)
    .map((p) => {
      const start = parsePlanDate(p.start);
      const end = start && p.days ? planDayDate(start, p.days - 1) : null;
      return { p, start, end };
    })
    .filter((x) => x.start && x.end && x.start <= t && t <= x.end)
    // Newest first; on the same start date the current plan wins, then file name (so it's stable).
    .sort(
      (a, b) =>
        +(/** @type {Date} */ (b.start)) - +(/** @type {Date} */ (a.start)) ||
        Number(b.p.current) - Number(a.p.current) ||
        (a.p.file < b.p.file ? -1 : a.p.file > b.p.file ? 1 : 0)
    );

  const newest = live[0];
  if (!newest) return { action: 'none', reason: 'No church plan covers today.' };
  if (newest.p.current) return { action: 'none', reason: `“${newest.p.title}” is already current.` };

  // Never replace the current plan with one that started on the same day or earlier.
  const flaggedStarts = plans.filter((p) => p.current).map((p) => parsePlanDate(p.start)).filter((d) => d !== null);
  if (flaggedStarts.some((d) => +d >= +(/** @type {Date} */ (newest.start)))) {
    return { action: 'none', reason: `“${newest.p.title}” doesn’t start after the current plan; leaving the current plan alone.` };
  }

  const daysSinceStart = Math.round((+t - +(/** @type {Date} */ (newest.start))) / 86400000);
  if (daysSinceStart > CATCH_UP_DAYS) {
    return {
      action: 'none',
      reason: `“${newest.p.title}” started ${daysSinceStart} days ago and isn’t current; leaving that choice alone.`
    };
  }
  return { action: 'switch', to: newest.p, from: plans.filter((p) => p.current && p.file !== newest.p.file) };
}

/**
 * Sets `current:` in a plan file's front matter by changing (or adding) that one line, so the
 * rest of the file stays exactly as it was.
 * @param {string} text
 * @param {boolean} value
 */
export function setCurrentFlag(text, value) {
  const line = `current: ${value}`;
  if (/^current:.*$/m.test(text)) return text.replace(/^current:.*$/m, line);
  // No current line yet: add it after `start:` (or after the opening ---).
  if (/^start:.*$/m.test(text)) return text.replace(/^(start:.*)$/m, `$1\n${line}`);
  return text.replace(/^---\r?\n/, `---\n${line}\n`);
}

/**
 * The calendar date in a time zone, as YYYY-MM-DD.
 * @param {Date} now
 * @param {string} timeZone e.g. "America/Chicago"
 */
export function dateInZone(now, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
