// Compares the built site with tests/fixtures (see scripts/output-snapshot.js).
// Run with `npm run test:output`, which builds first.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { FIXTURES, SITE, current, normalized, isFullCopy } = require('../scripts/output-snapshot');

test('public outputs match the snapshot', { skip: !fs.existsSync(SITE) && 'no _site: run `npm run test:output`' }, () => {
  const expected = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'output-hashes.json'), 'utf8'));
  const actual = current();
  assert.deepEqual(Object.keys(actual), Object.keys(expected), 'set of output files changed');
  for (const [file, hash] of Object.entries(expected)) {
    if (actual[file] === hash) continue;
    if (isFullCopy(file)) {
      // Full text comparison gives a readable diff for the Subsplash feed.
      assert.equal(normalized(file), fs.readFileSync(path.join(FIXTURES, 'output', file), 'utf8'), file);
    }
    assert.fail(`${file} changed. If that's intended, run \`npm run snapshot:update\`.`);
  }
});
