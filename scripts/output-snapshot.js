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
function trackedFiles() {
  if (!fs.existsSync(SITE)) throw new Error('No _site folder. Run `npm run build` first.');
  return walk(SITE)
    .filter((f) => /^subsplash\/.*\.xml$/.test(f) || f === 'currentplan.xml' || /^api\/.*\.json$/.test(f) || f === 'feed.ics')
    .sort();
}

/** feed.ics contains build timestamps; drop them so the hash is stable. */
function normalized(file) {
  const text = fs.readFileSync(path.join(SITE, file), 'utf8');
  return file.endsWith('.ics') ? text.replace(/^DTSTAMP:.*\r?\n/gm, '') : text;
}

const isFullCopy = (f) => f.endsWith('.xml');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function current() {
  const hashes = {};
  for (const f of trackedFiles()) hashes[f] = sha256(normalized(f));
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

module.exports = { FIXTURES, SITE, current, normalized, isFullCopy };
