import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Layer } from '@/types';
import { insertLayerIntoTree, resolveClickInsertTarget } from '@/lib/insert-layer';

function layer(id: string, name: string, children?: Layer[], extra?: Partial<Layer>): Layer {
  return {
    id,
    name,
    classes: [],
    children,
    ...extra,
  };
}

const incoming = layer('new', 'div');

test('resolveClickInsertTarget nests into containers and follows leaves', () => {
  const layers = [
    layer('body', 'body', [
      layer('stack', 'div'),
      layer('label', 'text'),
    ]),
  ];

  assert.deepEqual(resolveClickInsertTarget(layers, 'stack'), {
    targetLayerId: 'stack',
    position: 'inside',
  });
  assert.deepEqual(resolveClickInsertTarget(layers, 'label'), {
    targetLayerId: 'label',
    position: 'below',
  });
});

test('insertLayerIntoTree appends when the target is missing', () => {
  const layers = [layer('body', 'body')];
  const result = insertLayerIntoTree(layers, incoming, {
    targetLayerId: 'missing',
    position: 'inside',
  });

  assert.deepEqual(result.layers.map((item) => item.id), ['body', 'new']);
  assert.equal(result.parentToExpand, null);
  assert.equal(layers.length, 1);
});

test('insertLayerIntoTree nests inside a container and expands that parent', () => {
  const layers = [layer('body', 'body', [layer('stack', 'div')])];
  const result = insertLayerIntoTree(layers, incoming, {
    targetLayerId: 'stack',
    position: 'inside',
  });

  assert.deepEqual(result.layers[0].children?.[0].children?.map((item) => item.id), ['new']);
  assert.equal(result.parentToExpand, 'stack');
});

test('insertLayerIntoTree places a sibling above or below', () => {
  const layers = [layer('body', 'body', [layer('a', 'text'), layer('b', 'text')])];

  const above = insertLayerIntoTree(layers, incoming, {
    targetLayerId: 'b',
    position: 'above',
  });
  assert.deepEqual(above.layers[0].children?.map((item) => item.id), ['a', 'new', 'b']);
  assert.equal(above.parentToExpand, 'body');

  const below = insertLayerIntoTree(layers, layer('after', 'div'), {
    targetLayerId: 'a',
    position: 'below',
  });
  assert.deepEqual(below.layers[0].children?.map((item) => item.id), ['a', 'after', 'b']);
});

test('insertLayerIntoTree does not nest inside a component instance', () => {
  const layers = [
    layer('body', 'body', [
      layer('inst', 'div', [], { componentId: 'cmp' }),
    ]),
  ];

  const result = insertLayerIntoTree(layers, incoming, {
    targetLayerId: 'inst',
    position: 'inside',
  });

  assert.deepEqual(result.layers[0].children?.map((item) => item.id), ['inst', 'new']);
  assert.equal(result.parentToExpand, 'body');
});
