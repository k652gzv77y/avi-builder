import assert from 'node:assert/strict';
import test from 'node:test';

import { findLayerById, getLayerIndexes } from '@/lib/layer-utils';
import type { Layer } from '@/types';

function layer(id: string, children?: Layer[]): Layer {
  return { id, name: 'div', classes: '', children };
}

test('a cyclic layer tree does not overflow while indexing', () => {
  const child = layer('child');
  const parent = layer('parent', [child]);
  child.children = [parent];

  const indexes = getLayerIndexes([parent]);
  assert.equal(indexes.layerMap.get('parent')?.id, 'parent');
  assert.equal(indexes.layerMap.get('child')?.id, 'child');
  assert.equal(findLayerById([parent], 'child')?.id, 'child');
  assert.equal(findLayerById([parent], 'missing'), null);
});
