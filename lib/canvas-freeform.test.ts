import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyFreeformBox,
  collectSnapLines,
  constrainAxis,
  isFreeformDraggable,
  movedBox,
  nudgeFreeformLayer,
  resizedBox,
  snapTranslation,
  type FreeformBox,
} from '@/lib/canvas-freeform';
import type { Layer } from '@/types';

function layer(partial: Partial<Layer> & Pick<Layer, 'id'>): Layer {
  return {
    name: 'div',
    classes: '',
    ...partial,
  };
}

const box = (overrides: Partial<FreeformBox> = {}): FreeformBox => ({
  left: 10,
  top: 20,
  width: 100,
  height: 40,
  parentWidth: 400,
  parentHeight: 300,
  ...overrides,
});

test('stack and grid children stay in flow unless they are absolute or fixed', () => {
  const stack = layer({
    id: 'stack',
    classes: 'flex flex-col',
    design: { layout: { isActive: true, display: 'flex' } },
  });
  const grid = layer({
    id: 'grid',
    classes: 'grid',
    design: { layout: { isActive: true, display: 'grid' } },
  });
  const child = layer({
    id: 'child',
    classes: 'relative',
    design: { positioning: { isActive: true, position: 'relative' } },
  });
  const absoluteChild = layer({
    id: 'abs',
    classes: 'absolute left-[8px] top-[8px]',
    design: { positioning: { isActive: true, position: 'absolute', left: '8px', top: '8px' } },
  });
  const body = layer({ id: 'body', name: 'body', classes: 'relative flex flex-col' });

  assert.equal(isFreeformDraggable(child, stack), false);
  assert.equal(isFreeformDraggable(child, grid), false);
  assert.equal(isFreeformDraggable(child, body), false);
  assert.equal(isFreeformDraggable(absoluteChild, stack), true);
  assert.equal(isFreeformDraggable(body, null), false);
});

test('frame children are free-form and a drag promotes them to absolute', () => {
  const frame = layer({
    id: 'frame',
    classes: 'relative',
    design: { positioning: { isActive: true, position: 'relative' } },
  });
  const child = layer({
    id: 'card',
    classes: 'p-[8px] bg-[#111111]',
  });

  assert.equal(isFreeformDraggable(child, frame), true);

  const next = applyFreeformBox(child, box({ left: 24, top: 36 }), 'move');
  assert.equal(next.design?.positioning?.position, 'absolute');
  assert.equal(next.design?.positioning?.left, '24px');
  assert.equal(next.design?.positioning?.top, '36px');
  assert.match(String(next.classes), /\babsolute\b/);
  assert.match(String(next.classes), /left-\[24px\]/);
  assert.match(String(next.classes), /top-\[36px\]/);
  assert.match(String(next.classes), /p-\[8px\]/);
  assert.match(String(next.classes), /bg-\[#111111\]/);
});

test('dragging an absolute layer updates left and top and keeps its size', () => {
  const absolute = layer({
    id: 'badge',
    classes: 'absolute left-[10px] top-[20px] w-[100px] h-[40px]',
    design: {
      positioning: { isActive: true, position: 'absolute', left: '10px', top: '20px' },
      sizing: { isActive: true, width: '100px', height: '40px' },
    },
  });

  const next = applyFreeformBox(absolute, movedBox(box(), 15, -4), 'move');
  assert.equal(next.design?.positioning?.position, 'absolute');
  assert.equal(next.design?.positioning?.left, '25px');
  assert.equal(next.design?.positioning?.top, '16px');
  assert.equal(next.design?.sizing?.width, '100px');
  assert.match(String(next.classes), /left-\[25px\]/);
  assert.match(String(next.classes), /top-\[16px\]/);
  assert.match(String(next.classes), /w-\[100px\]/);
  assert.doesNotMatch(String(next.classes), /left-\[10px\]/);
});

test('a right-pinned layer moves its right offset and stays fixed when it started fixed', () => {
  const pinned = layer({
    id: 'pin',
    classes: 'fixed right-[20px] bottom-[12px] w-[100px] h-[40px]',
    design: {
      positioning: { isActive: true, position: 'fixed', right: '20px', bottom: '12px' },
      sizing: { isActive: true, width: '100px', height: '40px' },
    },
  });

  const next = applyFreeformBox(pinned, box({ left: 80, top: 48 }), 'move');
  assert.equal(next.design?.positioning?.position, 'fixed');
  assert.equal(next.design?.positioning?.right, '220px');
  assert.equal(next.design?.positioning?.bottom, '212px');
  assert.equal(next.design?.positioning?.left, undefined);
  assert.match(String(next.classes), /right-\[220px\]/);
  assert.doesNotMatch(String(next.classes), /\bleft-/);
});

test('moving a layer pinned to both edges shifts both edges and preserves width', () => {
  const stretched = layer({
    id: 'bar',
    classes: 'absolute left-[10px] right-[290px] top-[20px]',
    design: {
      positioning: { isActive: true, position: 'absolute', left: '10px', right: '290px', top: '20px' },
    },
  });

  const next = applyFreeformBox(stretched, movedBox(box(), 8, 0), 'move');
  assert.equal(next.design?.positioning?.left, '18px');
  assert.equal(next.design?.positioning?.right, '282px');
  assert.equal(next.design?.sizing?.width, undefined);
});

test('resize writes a fixed box and clears the opposite pins', () => {
  const pinned = layer({
    id: 'card',
    classes: 'absolute right-[16px] bottom-[8px] w-full h-[40px]',
    design: {
      positioning: { isActive: true, position: 'absolute', right: '16px', bottom: '8px' },
      sizing: { isActive: true, width: '100%', height: '40px' },
    },
  });

  const west = resizedBox(box({ left: 40, width: 80 }), 'w', 10, 0);
  assert.equal(west.left, 50);
  assert.equal(west.width, 70);

  const next = applyFreeformBox(pinned, resizedBox(box({ left: 40, top: 30, width: 120, height: 50 }), 'se', 20, 10), 'resize');
  assert.equal(next.design?.positioning?.left, '40px');
  assert.equal(next.design?.positioning?.top, '30px');
  assert.equal(next.design?.positioning?.right, undefined);
  assert.equal(next.design?.positioning?.bottom, undefined);
  assert.equal(next.design?.sizing?.width, '140px');
  assert.equal(next.design?.sizing?.height, '60px');
  assert.match(String(next.classes), /left-\[40px\]/);
  assert.match(String(next.classes), /w-\[140px\]/);
  assert.match(String(next.classes), /h-\[60px\]/);
  assert.doesNotMatch(String(next.classes), /right-\[/);
  assert.doesNotMatch(String(next.classes), /w-full/);
});

test('resize cannot collapse the box through the opposite edge', () => {
  const shrunk = resizedBox(box({ left: 10, width: 20 }), 'w', 40, 0);
  assert.equal(shrunk.width, 1);
  assert.equal(shrunk.left + shrunk.width, 30);
});

test('drag snaps to the parent edge and shift locks the smaller axis', () => {
  const targets = collectSnapLines([{ left: 200, top: 80, width: 40, height: 20 }], 400, 300);
  const snapped = snapTranslation(box({ left: 8, top: 40 }), -6, 12, targets);
  assert.equal(snapped.dx, -8);
  assert.equal(snapped.guides.some((guide) => guide.axis === 'x' && guide.at === 0), true);

  assert.deepEqual(constrainAxis(12, 4, true), { dx: 12, dy: 0 });
  assert.deepEqual(constrainAxis(3, 9, false), { dx: 3, dy: 9 });
});

test('arrow nudge uses the measured box and falls back to stored px pins', () => {
  const absolute = layer({
    id: 'nudge',
    classes: 'absolute left-[10px] top-[20px]',
    design: { positioning: { isActive: true, position: 'absolute', left: '10px', top: '20px' } },
  });

  const measured = nudgeFreeformLayer(absolute, 1, -1, box());
  assert.equal(measured?.design?.positioning?.left, '11px');
  assert.equal(measured?.design?.positioning?.top, '19px');

  const stored = nudgeFreeformLayer(absolute, 10, 0, null);
  assert.equal(stored?.design?.positioning?.left, '20px');
  assert.equal(stored?.design?.positioning?.top, '20px');

  const unpinned = layer({ id: 'plain', classes: 'relative' });
  assert.equal(nudgeFreeformLayer(unpinned, 1, 0, null), null);
});
