#!/usr/bin/env node
/**
 * Checks the reading plans in src/plan/ (the checks themselves live in
 * app/src/lib/shared/planCheck.js and are shared with the v2 app).
 *
 *   npm run check:plans           short summary
 *   npm run check:plans -- -v     every detail
 *
 * Runs as part of `npm run build`. Only errors in a plan readers are on now, or will be on
 * soon (bad book name, chapter that doesn't exist, missing chapter number, bad start date),
 * stop a deploy, as does anything wrong with which plan is current (more than one, or an extra
 * plan), since that's what the church app shows. Anything in past or self-paced plans is just reported.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { checkCurrent, checkPlan, checkSchedule, isSupplemental, planStatus } = require('../app/src/lib/shared/planCheck.js');

const PLAN_DIR = path.join(__dirname, '..', 'src', 'plan');

function loadPlans(dir = PLAN_DIR) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      // A missing closing "---" is tolerated (as 11ty does): the rest of the file is front matter.
      const match = text.match(/^---\r?\n([\s\S]*?)(?:\r?\n---[ \t]*(?:\r?\n|$)|$)/);
      if (!match) return { file, error: 'No front matter found' };
      try {
        return { file, data: yaml.load(match[1]) || {} };
      } catch (e) {
        return { file, error: `YAML could not be read: ${e.message.split('\n')[0]}` };
      }
    });
}

function run(argv = process.argv.slice(2), today = new Date()) {
  const verbose = argv.includes('-v') || argv.includes('--verbose');
  const results = loadPlans().map(({ file, data, error }) => {
    if (error) return { file, title: file, status: 'live', issues: [{ level: 'error', message: error }] };
    const title = data.title || file;
    return { file, title, current: data.current === true, supplemental: isSupplemental(data), ...planStatus(data, today), ...checkPlan(data) };
  });
  // Which plan is current decides what the church app (Subsplash) shows: always blocking.
  const current = checkCurrent(results);
  const blocking = [
    ...current.errors.map((message) => ({ plan: 'Current plan', message })),
    ...results.flatMap((r) =>
      ['live', 'upcoming'].includes(r.status) ? r.issues.filter((i) => i.level === 'error').map((i) => ({ ...i, plan: r.title })) : []
    ),
  ];

  console.log(`Plan checks: ${results.length} plans, ${blocking.length ? `${blocking.length} problem(s) to fix` : 'nothing blocking'}.`);
  for (const b of blocking) console.log(`  ✗ ${b.plan}: ${b.message}${b.fix ? ` → "${b.fix}"` : ''}`);
  for (const r of results) {
    const notes = r.issues.filter((i) => !blocking.some((b) => b.plan === r.title && b.message === i.message));
    if (!notes.length) continue;
    if (!verbose) {
      console.log(`  · ${r.title} (${r.status}): ${notes.length} note(s)`);
      continue;
    }
    console.log(`  · ${r.title} (${r.status}, ${r.file})`);
    for (const n of notes) {
      console.log(`      ${n.message}${n.fix ? ` → "${n.fix}"` : ''}`);
      for (const d of n.detail || []) console.log(`        ${d}`);
    }
  }
  for (const w of [...current.warnings, ...checkSchedule(results, today)]) console.log(`  · ${w}`);
  if (!verbose && results.some((r) => r.issues.length)) console.log('  (npm run check:plans -- -v for details)');
  return blocking.length ? 1 : 0;
}

if (require.main === module) process.exit(run());

module.exports = { loadPlans, run };
