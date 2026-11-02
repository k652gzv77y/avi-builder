import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUICK_INSERT,
  buildInsertCatalog,
  filterInsertEntries,
  nextInsertIndex,
} from '@/lib/insert-menu';

test('quick insert is Frame, Stack, Text, Image, and Collection List', () => {
  assert.deepEqual(QUICK_INSERT.map(entry => entry.label), [
    'Frame',
    'Stack',
    'Text',
    'Image',
    'Collection List',
  ]);
  assert.deepEqual(QUICK_INSERT.map(entry => entry.template), [
    'frame',
    'stack',
    'text',
    'image',
    'collection',
  ]);
});

test('search covers quick insert, other elements, and components', () => {
  const catalog = buildInsertCatalog(
    [
      { template: 'frame', label: 'Frame' },
      { template: 'button', label: 'Button' },
      { template: 'text', label: 'Text' },
    ],
    [{ id: 'cmp-1', name: 'Hero Card' }],
    ['Blog header'],
  );

  assert.deepEqual(filterInsertEntries(catalog, '').map(entry => entry.label), [
    'Frame',
    'Stack',
    'Text',
    'Image',
    'Collection List',
  ]);

  assert.deepEqual(filterInsertEntries(catalog, 'hero').map(entry => entry.template), ['cmp-1']);
  assert.deepEqual(filterInsertEntries(catalog, 'button').map(entry => entry.label), ['Button']);
  assert.ok(filterInsertEntries(catalog, 'blog').some(entry => entry.kind === 'layout'));
  assert.equal(catalog.filter(entry => entry.template === 'frame').length, 1);
});

test('arrow keys wrap the insert highlight', () => {
  assert.equal(nextInsertIndex(0, 1, 5), 1);
  assert.equal(nextInsertIndex(4, 1, 5), 0);
  assert.equal(nextInsertIndex(0, -1, 5), 4);
  assert.equal(nextInsertIndex(0, 1, 0), 0);
});
