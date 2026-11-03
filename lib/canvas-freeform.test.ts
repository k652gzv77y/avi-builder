import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyFreeformBox,
  collectSnapLines,
  constrainAxis,
  isFreeformDraggable,
  movedBox,
  nudgeFreeformLayer,
  pointerToWindowPoint,
  respectShiftLock,
  resizedBox,
  screenDeltaToCanvas,
  snapResizedBox,
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

test('every resize handle moves only the edges it owns', () => {
  const start = box({ left: 40, top: 30, width: 120, height: 50 });
  const drag = screenDeltaToCanvas(0, 0, 32, 24, 100);
  assert.deepEqual(drag, { dx: 32, dy: 24 });
  // At 50% zoom the same screen movement is twice as many canvas pixels.
  assert.deepEqual(screenDeltaToCanvas(0, 0, 30, 20, 50), { dx: 60, dy: 40 });

  const se = resizedBox(start, 'se', drag.dx, drag.dy);
  assert.equal(se.left, 40);
  assert.equal(se.top, 30);
  assert.equal(se.width, 152);
  assert.equal(se.height, 74);

  const nw = resizedBox(start, 'nw', 32, 24);
  assert.equal(nw.left, 72);
  assert.equal(nw.top, 54);
  assert.equal(nw.width, 88);
  assert.equal(nw.height, 26);

  const ne = resizedBox(start, 'ne', 10, -8);
  assert.equal(ne.left, 40);
  assert.equal(ne.top, 22);
  assert.equal(ne.width, 130);
  assert.equal(ne.height, 58);

  const sw = resizedBox(start, 'sw', -6, 12);
  assert.equal(sw.left, 34);
  assert.equal(sw.top, 30);
  assert.equal(sw.width, 126);
  assert.equal(sw.height, 62);

  const east = resizedBox(start, 'e', 25, 40);
  assert.equal(east.left, 40);
  assert.equal(east.top, 30);
  assert.equal(east.width, 145);
  assert.equal(east.height, 50);

  const south = resizedBox(start, 's', 25, 18);
  assert.equal(south.width, 120);
  assert.equal(south.height, 68);
  assert.equal(south.top, 30);

  const north = resizedBox(start, 'n', 0, -10);
  assert.equal(north.top, 20);
  assert.equal(north.height, 60);
  assert.equal(north.left, 40);
  assert.equal(north.width, 120);

  const west = resizedBox(start, 'w', -15, 9);
  assert.equal(west.left, 25);
  assert.equal(west.width, 135);
  assert.equal(west.top, 30);
  assert.equal(west.height, 50);
});

test('a corner resize persists the new width and height', () => {
  const absolute = layer({
    id: 'frame',
    classes: 'absolute left-[40px] top-[30px] w-[120px] h-[50px]',
    design: {
      positioning: { isActive: true, position: 'absolute', left: '40px', top: '30px' },
      sizing: { isActive: true, width: '120px', height: '50px' },
    },
  });
  const delta = screenDeltaToCanvas(100, 200, 132, 240, 100);
  const nextBox = resizedBox(
    box({ left: 40, top: 30, width: 120, height: 50 }),
    'se',
    delta.dx,
    delta.dy,
  );
  const next = applyFreeformBox(absolute, nextBox, 'resize');
  assert.equal(next.design?.positioning?.left, '40px');
  assert.equal(next.design?.positioning?.top, '30px');
  assert.equal(next.design?.sizing?.width, '152px');
  assert.equal(next.design?.sizing?.height, '90px');
  assert.match(String(next.classes), /w-\[152px\]/);
  assert.match(String(next.classes), /h-\[90px\]/);
});

test('iframe resize events are scaled into window pixels', () => {
  assert.deepEqual(
    pointerToWindowPoint(80, 40, true, { left: 100, top: 50 }, 50),
    { x: 140, y: 70 },
  );
  assert.deepEqual(
    pointerToWindowPoint(10, 12, false, { left: 100, top: 50 }, 50),
    { x: 10, y: 12 },
  );
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

  const locked = { dx: 12, dy: 0 };
  const pulled = snapTranslation(box({ top: 3 }), locked.dx, locked.dy, collectSnapLines([], 400, 300));
  assert.equal(pulled.dy, -3);
  const kept = respectShiftLock(pulled, locked, true);
  assert.equal(kept.dx, 12);
  assert.equal(kept.dy, 0);
  assert.equal(kept.guides.some((guide) => guide.axis === 'y'), false);
});

test('move snaps to parent center, sibling edges, and sibling centers within 5px', () => {
  const targets = collectSnapLines([{ left: 200, top: 80, width: 40, height: 20 }], 400, 300);
  const wide = collectSnapLines([{ left: 100, top: 0, width: 200, height: 20 }], 900, 300);

  const toSiblingEdge = snapTranslation(box({ left: 10, width: 100 }), 186, 0, targets);
  assert.equal(toSiblingEdge.dx, 190);
  assert.equal(toSiblingEdge.guides.some((guide) => guide.axis === 'x' && guide.at === 200), true);

  const toSiblingCenter = snapTranslation(box({ left: 10, top: 80, width: 30 }), 171, 0, wide);
  assert.equal(toSiblingCenter.dx, 175);
  assert.deepEqual(toSiblingCenter.guides, [{ axis: 'x', at: 200 }]);

  const toParentCenter = snapTranslation(box({ top: 128, height: 40 }), 0, 0, targets);
  assert.equal(toParentCenter.dy, 2);
  assert.equal(toParentCenter.guides.some((guide) => guide.axis === 'y' && guide.at === 150), true);

  const onThreshold = snapTranslation(box(), -5, 0, collectSnapLines([], 400, 300));
  assert.equal(onThreshold.dx, -10);
  const pastThreshold = snapTranslation(box(), -4, 0, collectSnapLines([], 400, 300));
  assert.equal(pastThreshold.dx, -4);
  assert.equal(pastThreshold.guides.length, 0);
});

test('a shared correction draws every aligned guide and an opposite tie does not', () => {
  const bothEdges = snapTranslation(
    box({ left: 8, width: 100, parentWidth: 100 }),
    -6,
    0,
    collectSnapLines([], 100, 300),
  );
  assert.equal(bothEdges.dx, -8);
  assert.deepEqual(bothEdges.guides.map((guide) => guide.at).sort((a, b) => a - b), [0, 50, 100]);

  const tie = snapTranslation(box({ left: 10, width: 20 }), -5, 0, {
    x: [0, 30],
    y: [],
  });
  assert.equal(tie.dx, -10);
  assert.deepEqual(tie.guides, [{ axis: 'x', at: 0 }]);
});

test('resize snaps the moving edge and refuses a snap that would collapse it', () => {
  const targets = collectSnapLines([{ left: 150, top: 70, width: 10, height: 10 }], 400, 300);
  const east = snapResizedBox(box({ left: 40, top: 30, width: 80, height: 50 }), 'e', 28, 0, targets);
  assert.equal(east.box.left, 40);
  assert.equal(east.box.width, 110);
  assert.equal(east.guides.some((guide) => guide.axis === 'x' && guide.at === 150), true);

  const west = snapResizedBox(box({ left: 12, width: 40 }), 'w', -8, 0, collectSnapLines([], 400, 300));
  assert.equal(west.box.left, 0);
  assert.equal(west.box.width, 52);

  const north = snapResizedBox(box({ top: 18, height: 40 }), 'n', 0, -14, collectSnapLines([], 400, 300));
  assert.equal(north.box.top, 0);
  assert.equal(north.box.height, 58);
  assert.equal(north.guides.some((guide) => guide.axis === 'y' && guide.at === 0), true);

  const collapsed = snapResizedBox(box({ left: 0, width: 30 }), 'e', -28, 0, collectSnapLines([], 400, 300));
  assert.equal(collapsed.box.width, 2);
  assert.equal(collapsed.guides.length, 0);
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
