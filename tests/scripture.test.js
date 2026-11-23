const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { BOOKS, resolveBook, parseReference, suggestBook, splitReferences } = require('../src/lib/scripture');
const { parsePlanDate, planDayDate, formatUS, formatISO } = require('../src/lib/planDate');
const getReadingDate = require('../src/lib/getReadingDate');
const generateBibleLinks = require('../src/lib/generateBibleLinks');

test('canon has 66 books and 1,189 chapters', () => {
  assert.equal(BOOKS.length, 66);
  assert.equal(BOOKS.reduce((n, b) => n + b.chapters, 0), 1189);
});

test('canon chapter counts agree with src/data/bible.yml', () => {
  const bible = yaml.load(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'bible.yml'), 'utf8'));
  for (const entry of bible) {
    const book = resolveBook(entry.Book);
    assert.ok(book, `unknown book in bible.yml: ${entry.Book}`);
    assert.equal(book.chapters, entry.Chapters.split(',').length, entry.Book);
  }
});

test('resolveBook accepts names, aliases and abbreviations', () => {
  assert.equal(resolveBook('Psalms').name, 'Psalm');
  assert.equal(resolveBook('Song of Songs').name, 'Song of Solomon');
  assert.equal(resolveBook('1 cor').name, '1 Corinthians');
  assert.equal(resolveBook('Gen.').name, 'Genesis');
  assert.equal(resolveBook('Revealtion'), null);
});

test('parseReference', () => {
  assert.deepEqual(
    (({ book, chapter, verses }) => ({ book: book.name, chapter, verses }))(parseReference('Psalm 119:1-32')),
    { book: 'Psalm', chapter: 119, verses: '1-32' }
  );
  assert.equal(parseReference('1 John 3').book.name, '1 John');
  assert.equal(parseReference('Jude').reason, 'missing-chapter');
  assert.equal(parseReference('1 John').reason, 'missing-chapter');
  assert.equal(parseReference('Jude 2').reason, 'chapter-out-of-range');
  assert.equal(parseReference('Revealtion 7').reason, 'unknown-book');
  assert.equal(suggestBook('Revealtion').name, 'Revelation');
  assert.equal(suggestBook('Habakuk').name, 'Habakkuk');
  assert.equal(suggestBook('Banana'), null);
  assert.deepEqual(splitReferences(' Genesis 1,  Genesis 2 ,'), ['Genesis 1', 'Genesis 2']);
});

test('plan dates are time-zone independent and accept both formats', () => {
  assert.equal(formatISO(parsePlanDate('01-01-2026')), '2026-01-01');
  assert.equal(formatISO(parsePlanDate('2026-01-01')), '2026-01-01');
  assert.equal(parsePlanDate('02-30-2026'), null);
  assert.equal(parsePlanDate(''), null);
  assert.equal(formatUS(planDayDate('01-01-2026', 367)), '01/03/2027');
  // Across the US daylight-saving change.
  assert.equal(getReadingDate('03-01-2026', 10), '03/11/2026');
  assert.equal(getReadingDate('', 3), '');
});

test('generateBibleLinks keeps v1 output and now links aliases', () => {
  assert.equal(
    generateBibleLinks('Psalm 119:1-32, John 3'),
    '<a class="block underline text-base-content" href="https://www.bible.com/bible/59/PSA.119.1-32" alt="Psalm 119:1-32">Psalm 119:1-32,</a> ' +
      '<a class="block underline text-base-content" href="https://www.bible.com/bible/59/JHN.3" alt="John 3">John 3</a>'
  );
  assert.match(generateBibleLinks('Song of Songs 1'), /SNG\.1/);
  assert.equal(generateBibleLinks("Lord's Day"), "Lord's Day");
  assert.equal(generateBibleLinks(undefined), null);
});
