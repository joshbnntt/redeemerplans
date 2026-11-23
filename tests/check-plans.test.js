const test = require('node:test');
const assert = require('node:assert/strict');
const { checkPlan, checkSchedule, loadPlans } = require('../scripts/check-plans');

const flat = (list) => list.map((w) => (typeof w === 'string' ? w : w.summary)).join('\n');

test('reports typos, missing chapters and impossible chapters as errors', () => {
  const { errors } = checkPlan({
    title: 'T',
    start: '2024-08-01',
    plan: [{ day: 'Revealtion 7' }, { day: 'Jude' }, { day: 'Psalm 151' }, { day: '' }, { day: 'Genesis 1', alt: 'Habakuk 1' }],
  });
  assert.equal(errors.length, 5);
  assert.match(errors[0], /Did you mean Revelation\?/);
  assert.match(errors[1], /use "Jude 1"/);
  assert.match(errors[2], /Psalm has 150 chapters/);
  assert.match(errors[3], /no reading/);
  assert.match(errors[4], /alternate.*Habakkuk/);
});

test('warns about repeats, skipped chapters and misplaced Lord\'s Days', () => {
  const plan = ['Jeremiah 1, Jeremiah 2', 'Jeremiah 3, Jeremiah 5', "Lord's Day", 'Jeremiah 6, Jeremiah 7', 'Jeremiah 8, Jeremiah 9, Jeremiah 10', 'Jeremiah 10'].map((day) => ({ day }));
  // 2026-11-23 is a Monday, so day 3 (Wednesday) is not a Sunday.
  const { errors, warnings } = checkPlan({ title: 'T', start: '2026-11-23', plan });
  assert.equal(errors.length, 0);
  const text = flat(warnings);
  assert.match(text, /read more than once/);
  assert.match(text, /Jeremiah 4 is never read/);
  assert.match(text, /isn't on a Sunday/);
});

test('intentional repeats and split chapters are not warned about', () => {
  const { warnings } = checkPlan({
    title: 'T',
    intentional_repeats: ['Proverbs'],
    plan: [{ day: 'Proverbs 1' }, { day: 'Proverbs 1' }, { day: 'Psalm 119:1-88' }, { day: 'Psalm 119:89-176' }],
  });
  assert.equal(warnings.length, 0);
});

test('schedule: overlaps and nothing scheduled ahead', () => {
  const a = { title: 'A', ...checkPlan({ title: 'A', start: '2026-01-01', plan: Array(10).fill({ day: 'John 1' }) }) };
  const b = { title: 'B', ...checkPlan({ title: 'B', start: '2026-01-08', plan: Array(10).fill({ day: 'John 1' }) }) };
  const warnings = checkSchedule([a, b], new Date(Date.UTC(2026, 0, 2)));
  assert.match(warnings[0], /overlaps "B".* by 3 day/);
  assert.match(warnings[1], /Nothing is scheduled after Sat, Jan 17, 2026/);
});

test('every plan in the repository has no errors', () => {
  for (const { file, data, error } of loadPlans()) {
    assert.equal(error, undefined, file);
    assert.deepEqual(checkPlan(data).errors, [], file);
  }
});
