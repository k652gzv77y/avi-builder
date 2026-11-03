import assert from 'node:assert/strict';
import test from 'node:test';

import {
  alignBoxes,
  alignLayerTree,
  distributeBoxes,
  normalizeRect,
  outermostIntersectingIds,
  rectsIntersect,
} from '@/lib/canvas-align';
import type { Layer } from '@/types';

function layer(partial: Partial<Layer> & Pick<Layer, 'id'>): Layer {
  return { name: 'div', classes: '', ...partial };
}

const boxes = [
  { id: 'a', left: 0, top: 10, width: 40, height: 20 },
  { id: 'b', left: 80, top: 40, width: 20, height: 30 },
  { id: 'c', left: 30, top: 0, width: 10, height: 10 },
];

test('align moves every box to the shared edge or center', () => {
  assert.deepEqual(alignBoxes(boxes, 'left').map((box) => box.left), [0, 0, 0]);
  assert.deepEqual(alignBoxes(boxes, 'right').map((box) => box.left + box.width), [100, 100, 100]);
  assert.deepEqual(alignBoxes(boxes, 'top').map((box) => box.top), [0, 0, 0]);
  assert.deepEqual(alignBoxes(boxes, 'bottom').map((box) => box.top + box.height), [70, 70, 70]);

  const centered = alignBoxes(boxes, 'center');
  assert.equal(centered[0].left + centered[0].width / 2, 50);
  assert.equal(centered[1].left + centered[1].width / 2, 50);

  const middle = alignBoxes(boxes, 'middle');
  assert.equal(middle[0].top + middle[0].height / 2, 35);
  assert.equal(middle[2].top + middle[2].height / 2, 35);
});

test('distribute keeps the outer edges and equalizes the gaps', () => {
  const row = [
    { id: 'a', left: 0, top: 0, width: 10, height: 10 },
    { id: 'b', left: 20, top: 5, width: 10, height: 10 },
    { id: 'c', left: 100, top: 8, width: 10, height: 10 },
  ];
  const spaced = distributeBoxes(row, 'horizontal');
  assert.equal(spaced[0].left, 0);
  assert.equal(spaced[1].left, 50);
  assert.equal(spaced[2].left, 100);
  assert.equal(spaced[1].top, 5);

  assert.deepEqual(
    distributeBoxes(row.slice(0, 2), 'horizontal').map((box) => box.left),
    [0, 20],
  );
});

test('align persists left and top and keeps a right pin', () => {
  const layers = [
    layer({
      id: 'wide',
      classes: 'absolute left-[0px] top-[10px] w-[40px] h-[20px]',
      design: {
        positioning: { isActive: true, position: 'absolute', left: '0px', top: '10px' },
        sizing: { isActive: true, width: '40px', height: '20px' },
      },
    }),
    layer({
      id: 'pinned',
      classes: 'absolute right-[300px] top-[40px] w-[20px] h-[30px]',
      design: {
        positioning: { isActive: true, position: 'absolute', right: '300px', top: '40px' },
        sizing: { isActive: true, width: '20px', height: '30px' },
      },
    }),
  ];
  const next = alignLayerTree(layers, [
    { id: 'wide', left: 0, top: 10, width: 40, height: 20, parentWidth: 400, parentHeight: 300 },
    { id: 'pinned', left: 80, top: 40, width: 20, height: 30, parentWidth: 400, parentHeight: 300 },
  ], { type: 'align', edge: 'left' });

  const wide = next[0];
  const pinned = next[1];
  assert.equal(wide.design?.positioning?.left, '0px');
  assert.equal(pinned.design?.positioning?.left, undefined);
  assert.equal(pinned.design?.positioning?.right, '380px');
  assert.match(String(pinned.classes), /right-\[380px\]/);
  assert.equal(pinned.design?.sizing?.width, '20px');
});

test('marquee selects the outermost intersecting layers', () => {
  const marquee = normalizeRect(90, 40, 10, 10);
  assert.equal(marquee.left, 10);
  assert.equal(marquee.top, 10);
  assert.equal(rectsIntersect(marquee, { left: 0, top: 0, width: 30, height: 30 }), true);
  assert.equal(rectsIntersect(marquee, { left: 200, top: 200, width: 10, height: 10 }), false);

  const ids = outermostIntersectingIds([
    { id: 'frame', parentId: null, box: { left: 0, top: 0, width: 200, height: 120 } },
    { id: 'card', parentId: 'frame', box: { left: 20, top: 20, width: 40, height: 40 } },
    { id: 'label', parentId: 'card', box: { left: 24, top: 24, width: 20, height: 12 } },
    { id: 'outside', parentId: null, box: { left: 300, top: 0, width: 20, height: 20 } },
    { id: 'body', parentId: null, box: { left: 0, top: 0, width: 800, height: 600 } },
  ], marquee);
  assert.deepEqual(ids, ['frame']);
});
