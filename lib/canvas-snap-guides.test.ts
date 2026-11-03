import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectSnapLines,
  snapTranslation,
  type FreeformBox,
  type SnapGuide,
} from '@/lib/canvas-freeform';
import { activeGuideEntries } from '@/lib/canvas-snap-guides';
import {
  getActiveSnapGuides,
  setActiveSnapGuides,
  subscribeActiveSnapGuides,
} from '@/lib/canvas-snap-session';

const box = (overrides: Partial<FreeformBox> = {}): FreeformBox => ({
  left: 10,
  top: 20,
  width: 100,
  height: 40,
  parentWidth: 400,
  parentHeight: 300,
  ...overrides,
});

test('an idle snap lists no guides', () => {
  const snapped = snapTranslation(box(), 40, 20, collectSnapLines([], 400, 300));
  assert.equal(snapped.guides.length, 0);
  assert.deepEqual(activeGuideEntries(snapped.guides), []);
});

test('drag snap lists parent and named sibling edges from the same guides', () => {
  const targets = collectSnapLines(
    [{ left: 200, top: 80, width: 40, height: 20, name: 'Card' }],
    400,
    300,
  );
  const snapped = snapTranslation(box({ left: 10, width: 100 }), 186, 0, targets);
  assert.equal(snapped.dx, 190);
  assert.deepEqual(
    activeGuideEntries(snapped.guides).map((entry) => entry.label),
    ['Parent center', 'Card left'],
  );
  assert.equal(activeGuideEntries(snapped.guides)[0]?.at, 200);
});

test('guide rows name centers, measured parents, and unnamed siblings', () => {
  const guides: SnapGuide[] = [
    {
      axis: 'y',
      at: 40,
      targets: [{ role: 'sibling', name: 'Hero', edge: 'top' }],
    },
    {
      axis: 'x',
      at: 12,
      targets: [
        { role: 'parent', edge: 'left' },
        { role: 'parent', name: 'Frame', edge: 'right' },
        { role: 'sibling', edge: 'center' },
      ],
    },
    {
      axis: 'y',
      at: 10,
      targets: [{ role: 'parent', edge: 'center' }],
    },
  ];

  assert.deepEqual(
    activeGuideEntries(guides).map((entry) => `${entry.label}@${entry.at}`),
    [
      'Parent left@12',
      'Frame right@12',
      'Sibling center@12',
      'Parent center@10',
      'Hero top@40',
    ],
  );
});

test('the active guide session publishes a change once', () => {
  setActiveSnapGuides([]);
  const seen: number[] = [];
  const unsubscribe = subscribeActiveSnapGuides(() => {
    seen.push(getActiveSnapGuides().length);
  });
  const guide: SnapGuide = {
    axis: 'x',
    at: 0,
    targets: [{ role: 'parent', edge: 'left' }],
  };
  setActiveSnapGuides([guide]);
  setActiveSnapGuides([{ ...guide, targets: [{ role: 'parent', edge: 'left' }] }]);
  setActiveSnapGuides([]);
  unsubscribe();
  assert.deepEqual(seen, [1, 0]);
  assert.equal(getActiveSnapGuides().length, 0);
});
