import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RULER_LABEL_SCREEN_PX,
  buildRulerTicks,
  canvasToScreen,
  chooseMajorStep,
  chooseMinorStep,
  formatRulerLabel,
  iframeClientRectToCanvas,
  rulerHighlight,
  rulerOrigin,
  rulerTrack,
  unionCanvasRects,
} from '@/lib/canvas-rulers';

test('major tick step grows as zoom decreases and labels stay readable', () => {
  const scales = [2, 1, 0.5, 0.25, 0.1];
  let previous = 0;
  for (const scale of scales) {
    const step = chooseMajorStep(scale);
    assert.ok(step >= previous, `step ${step} at ${scale} shrank`);
    previous = step;
    const screen = step * scale;
    assert.ok(
      screen >= RULER_LABEL_SCREEN_PX - 0.01,
      `${scale} places labels ${screen}px apart`,
    );
    assert.ok(
      screen <= RULER_LABEL_SCREEN_PX * 2.5 + 0.01,
      `${scale} places labels ${screen}px apart`,
    );
  }
});

test('minor ticks drop out when zoom would pack them tighter than 6 screen pixels', () => {
  assert.equal(chooseMinorStep(100, 1), 10);
  assert.equal(chooseMinorStep(250, 0.4), 25);
  assert.equal(chooseMinorStep(100, 0.05), null);
});

test('page pixels map through zoom and the iframe scroll', () => {
  assert.equal(canvasToScreen(50, 20, 2), 120);
  assert.equal(rulerOrigin(120, 20, 10, 2), 80);
  assert.deepEqual(rulerTrack(20, 800, 20, 1), {
    origin: 0,
    length: 780,
    scale: 1,
  });
});

test('ticks label page coordinates and line up with the track origin', () => {
  const geometry = rulerTrack(40, 220, 20, 0.5);
  const ticks = buildRulerTicks(geometry);
  const labeled = ticks.filter((tick) => tick.label).map((tick) => tick.value);
  assert.deepEqual(labeled, [0, 250]);

  for (const tick of ticks) {
    assert.equal(tick.offset, canvasToScreen(tick.value, geometry.origin, geometry.scale));
    assert.ok(tick.offset >= -0.5 && tick.offset <= geometry.length + 0.5);
  }

  const zero = ticks.find((tick) => tick.value === 0);
  assert.ok(zero);
  assert.equal(zero?.offset, 20);
  assert.equal(zero?.label, '0');
  assert.equal(ticks.some((tick) => tick.value === 25 && !tick.major), true);
});

test('selection range scales with zoom and clips to the track', () => {
  assert.deepEqual(rulerHighlight(100, 50, 0, 1, 400), { start: 100, size: 50 });
  assert.deepEqual(rulerHighlight(100, 50, 0, 2, 400), { start: 200, size: 100 });
  assert.deepEqual(rulerHighlight(-10, 30, 0, 1, 100), { start: 0, size: 20 });
  assert.equal(rulerHighlight(10, 0, 0, 1, 100), null);
  assert.equal(rulerHighlight(500, 20, 0, 1, 100), null);
});

test('selection bounds union iframe rects in page pixels', () => {
  assert.deepEqual(
    iframeClientRectToCanvas({ left: 12, top: 4, width: 30, height: 8 }, { x: 100, y: 40 }),
    { x: 112, y: 44, width: 30, height: 8 },
  );
  assert.deepEqual(
    unionCanvasRects([
      { x: 10, y: 20, width: 40, height: 10 },
      { x: 30, y: 5, width: 10, height: 30 },
      { x: 0, y: 0, width: 0, height: 0 },
    ]),
    { x: 10, y: 5, width: 40, height: 30 },
  );
  assert.equal(unionCanvasRects([]), null);
});

test('ruler labels are whole page pixels', () => {
  assert.equal(formatRulerLabel(100), '100');
  assert.equal(formatRulerLabel(-50), '-50');
  assert.equal(formatRulerLabel(100.04), '100');
  assert.equal(buildRulerTicks({ origin: 0, length: 0, scale: 1 }).length, 0);
  assert.equal(buildRulerTicks({ origin: 0, length: 100, scale: 0 }).length, 0);
});
