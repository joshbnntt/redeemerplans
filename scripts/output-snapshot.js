#!/usr/bin/env node
/**
 * Snapshot of the public outputs other systems depend on, so the v2 rewrite can prove it
 * produces the same thing:
 *   - Subsplash XML (the church app reads it): stored in full, so a diff is readable
 *   - v1 JSON API and the calendar feed: stored as SHA-256 hashes
 *
 *   npm run build && npm run snapshot:update   after an intentional change (e.g. a plan edit)
 *   npm run test:output                        build, then compare with the snapshot
 *
 * This is a development check, not part of the deploy: editing a plan changes these
 * outputs on purpose, and must never block the pastor from publishing.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, '_site');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');

function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

/** Outputs to protect, relative to _site. */
function trackedFiles(site = SITE) {
  if (!fs.existsSync(site)) throw new Error(`No ${site} folder. Build first.`);
  return walk(site)
    .filter((f) => /^subsplash\/.*\.xml$/.test(f) || f === 'currentplan.xml' || /^api\/.*\.json$/.test(f) || f === 'feed.ics')
    .sort();
}

/**
 * Removes differences that never mattered: feed.ics build timestamps, and the order of
 * api/plans.json and feed.ics events (11ty orders them by file timestamps, which differ on
 * every checkout).
 */
function normalize(file, text) {
  if (file.endsWith('.ics')) {
    // Event order also follows file timestamps, so compare events as a sorted set.
    const noStamp = text.replace(/^DTSTAMP:.*\r?\n/gm, '');
    const events = noStamp.match(/BEGIN:VEVENT\r?\n[\s\S]*?END:VEVENT\r?\n/g) || [];
    const header = noStamp.slice(0, noStamp.indexOf('BEGIN:VEVENT'));
    const footer = noStamp.slice(noStamp.lastIndexOf('END:VEVENT') + 'END:VEVENT'.length).replace(/^\r?\n/, '');
    return header + events.sort().join('') + footer;
  }
  if (file === 'api/plans.json') {
    return JSON.stringify(JSON.parse(text).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
  }
  return text;
}

function normalized(file, site = SITE) {
  return normalize(file, fs.readFileSync(path.join(site, file), 'utf8'));
}

const isFullCopy = (f) => f.endsWith('.xml');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Hashes of the tracked outputs in a built site folder (the 11ty `_site`, or the v2 app's output). */
function current(site = SITE) {
  const hashes = {};
  for (const f of trackedFiles(site)) hashes[f] = sha256(normalized(f, site));
  return hashes;
}

function update() {
  fs.rmSync(FIXTURES, { recursive: true, force: true });
  const hashes = current();
  for (const f of Object.keys(hashes).filter(isFullCopy)) {
    const dest = path.join(FIXTURES, 'output', f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, normalized(f));
  }
  fs.writeFileSync(path.join(FIXTURES, 'output-hashes.json'), JSON.stringify(hashes, null, 2) + '\n');
  console.log(`Snapshot updated: ${Object.keys(hashes).length} files (${Object.keys(hashes).filter(isFullCopy).length} XML copies).`);
}

if (require.main === module) update();

module.exports = { FIXTURES, SITE, current, normalized, isFullCopy, trackedFiles };
