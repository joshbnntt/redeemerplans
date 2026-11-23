// The v2 app must produce the same public outputs as the 11ty site: Subsplash XML (read by the
// church app), the v1 JSON API and the calendar feed. Run with `npm run test:compat`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { FIXTURES, current, normalized, isFullCopy } = require('../scripts/output-snapshot');

const APP_OUTPUT = path.join(__dirname, '..', 'app', '.vercel', 'output', 'static');

test('v2 app matches the legacy outputs', { skip: !fs.existsSync(APP_OUTPUT) && 'build the app first: npm run test:compat' }, () => {
  const expected = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'output-hashes.json'), 'utf8'));
  const actual = current(APP_OUTPUT);
  for (const [file, hash] of Object.entries(expected)) {
    assert.ok(actual[file], `${file} is missing from the v2 app`);
    if (actual[file] === hash) continue;
    if (isFullCopy(file)) {
      assert.equal(normalized(file, APP_OUTPUT), fs.readFileSync(path.join(FIXTURES, 'output', file), 'utf8'), file);
    }
    assert.fail(`${file} differs from the legacy site`);
  }
});
