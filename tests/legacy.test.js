const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { resolveBook } = require('../src/lib/scripture');
const getReadingDate = require('../src/lib/getReadingDate');
const generateBibleLinks = require('../src/lib/generateBibleLinks');

test('canon chapter counts agree with src/data/bible.yml', () => {
  const bible = yaml.load(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'bible.yml'), 'utf8'));
  for (const entry of bible) {
    const book = resolveBook(entry.Book);
    assert.ok(book, `unknown book in bible.yml: ${entry.Book}`);
    assert.equal(book.chapters, entry.Chapters.split(',').length, entry.Book);
  }
});

test('getReadingDate keeps the v1 format', () => {
  assert.equal(getReadingDate('01-01-2026', 367), '01/03/2027');
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
