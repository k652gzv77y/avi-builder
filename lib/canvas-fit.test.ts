import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FRAME_ADD_BUTTON_SIZE,
  FRAME_LABEL_HEIGHT,
  PAGE_CAMERA_STORAGE_KEY,
  PHONE_VIEWPORT_HEIGHT,
  centerBoardCamera,
  centerScrollOffset,
  createPageViewStore,
  deviceViewportHeight,
  fitBoardZoom,
  layerOverlayBox,
  layoutPublishedFrame,
  pageEnterView,
  panCamera,
  parseSavedPageViews,
  resolveFrameHeight,
  wheelPanDelta,
  zoomCamera,
  type CanvasBoardFit,
} from '@/lib/canvas-fit';

const board: CanvasBoardFit = {
  frameWidths: [1200, 810, 390, 1343],
  frameHeights: [800, 700, 600, 900],
  gap: 100,
  labelHeight: FRAME_LABEL_HEIGHT,
  trailingScreenWidth: FRAME_ADD_BUTTON_SIZE,
  padding: 20,
};

function scaledBoard(zoom: number) {
  const scale = zoom / 100;
  const pageWidth = board.frameWidths.reduce((sum, width) => sum + width, 0)
    + board.gap * board.frameWidths.length;
  const pageHeight = Math.max(...board.frameHeights);
  return {
    width: pageWidth * scale + board.trailingScreenWidth,
    height: board.labelHeight + pageHeight * scale,
  };
}

test('fit uses the visible canvas and keeps padding around the frames', () => {
  const windowWidth = 1920;
  const leftPanel = 256;
  const rightPanel = 256;
  const visibleWidth = windowWidth - leftPanel - rightPanel;
  const visibleHeight = 900;

  const zoom = fitBoardZoom(board, visibleWidth, visibleHeight, 10, 1000);
  const fitted = scaledBoard(zoom);

  assert.ok(fitted.width <= visibleWidth - board.padding * 2 + 0.01);
  assert.ok(fitted.height <= visibleHeight - board.padding * 2 + 0.01);

  const fittedToWindow = fitBoardZoom(board, windowWidth, visibleHeight, 10, 1000);
  assert.ok(fittedToWindow > zoom);
  const tooWide = scaledBoard(fittedToWindow);
  assert.ok(tooWide.width > visibleWidth - board.padding * 2);
});

test('fit is limited by width when the board is wide and by height when it is tall', () => {
  const wide = fitBoardZoom({
    ...board,
    frameHeights: [100, 100, 100, 100],
  }, 640, 2000, 10, 100);
  const wideScale = wide / 100;
  const pageWidth = board.frameWidths.reduce((sum, width) => sum + width, 0)
    + board.gap * board.frameWidths.length;
  assert.equal(wide, ((640 - 40 - FRAME_ADD_BUTTON_SIZE) / pageWidth) * 100);
  assert.ok(100 * wideScale + FRAME_LABEL_HEIGHT < 2000 - 40);

  const tall = fitBoardZoom({
    frameWidths: [400],
    frameHeights: [4000],
    gap: 100,
    labelHeight: FRAME_LABEL_HEIGHT,
    trailingScreenWidth: FRAME_ADD_BUTTON_SIZE,
    padding: 20,
  }, 2000, 500, 10, 100);
  assert.equal(tall, ((500 - 40 - FRAME_LABEL_HEIGHT) / 4000) * 100);
});

test('fit stays between the minimum zoom and 100%', () => {
  assert.equal(fitBoardZoom({
    frameWidths: [8000],
    frameHeights: [8000],
    gap: 0,
    labelHeight: 0,
    trailingScreenWidth: 0,
    padding: 0,
  }, 100, 100, 10, 100), 10);

  assert.equal(fitBoardZoom({
    frameWidths: [100],
    frameHeights: [100],
    gap: 0,
    labelHeight: 0,
    trailingScreenWidth: 0,
    padding: 0,
  }, 2000, 2000, 10, 1000), 100);
});

test('centerScrollOffset centers overflow and stays at the origin when content fits', () => {
  assert.equal(centerScrollOffset(1400, 800), 300);
  assert.equal(centerScrollOffset(800, 800), 0);
  assert.equal(centerScrollOffset(500, 800), 0);
});

test('kolbo homepage row keeps every card and at least the device height', () => {
  const collapsedCard = 140;
  const frame = layoutPublishedFrame({
    breakpointWidth: 1249,
    cards: [
      { title: 'Happiness', height: collapsedCard },
      { title: 'Focus', height: collapsedCard },
      { title: 'Calm', height: collapsedCard },
    ],
  });

  assert.deepEqual(frame.titles, ['Happiness', 'Focus', 'Calm']);
  assert.equal(frame.viewport, deviceViewportHeight(1249));
  assert.equal(frame.height, resolveFrameHeight(collapsedCard, 1249));
  assert.ok(frame.height > collapsedCard);
  assert.equal(deviceViewportHeight(390), PHONE_VIEWPORT_HEIGHT);
  assert.equal(deviceViewportHeight(810), 1080);
});

test('a page taller than the device grows the frame', () => {
  const frame = layoutPublishedFrame({
    breakpointWidth: 390,
    cards: [{ title: 'Happiness', height: 1800 }],
  });
  assert.deepEqual(frame.titles, ['Happiness']);
  assert.equal(frame.height, 1800);
});

test('centerBoardCamera centers frames on both axes', () => {
  const camera = centerBoardCamera({
    viewportWidth: 1000,
    viewportHeight: 800,
    boardWidth: 600,
    frameHeight: 200,
    labelHeight: 32,
  });
  assert.equal(camera.x, 200);
  assert.equal(camera.y, (800 - 200) / 2 - 32);
});

test('wheel pans the camera even when the board fits the viewport', () => {
  const fitted = centerBoardCamera({
    viewportWidth: 1000,
    viewportHeight: 800,
    boardWidth: 600,
    frameHeight: 200,
    labelHeight: 32,
  });
  const vertical = panCamera(fitted, 0, 48, false);
  assert.equal(vertical.x, fitted.x);
  assert.equal(vertical.y, fitted.y - 48);

  const horizontal = panCamera(fitted, -12, 0, false);
  assert.equal(horizontal.x, fitted.x + 12);
  assert.equal(horizontal.y, fitted.y);

  const shifted = panCamera(fitted, 0, 30, true);
  assert.equal(shifted.x, fitted.x - 30);
  assert.equal(shifted.y, fitted.y);
});

test('zoom keeps the point under the cursor fixed', () => {
  const camera = { x: 100, y: 80 };
  const next = zoomCamera(camera, 100, 200, 50, 40);
  const before = (50 - camera.x) / 1;
  const after = (50 - next.x) / 2;
  assert.equal(before, after);
  assert.equal((40 - camera.y) / 1, (40 - next.y) / 2);
});

test('selection overlay and badge move by the same delta as the camera', () => {
  const container = { left: 20, top: 40 };
  const element = { left: 8, top: 12, width: 200, height: 80 };
  const before = layerOverlayBox(
    { left: 120, top: 160, width: 500, height: 300 },
    container,
    element,
    0.5,
  );
  const cameraDx = -48;
  const cameraDy = 30;
  const after = layerOverlayBox(
    { left: 120 + cameraDx, top: 160 + cameraDy, width: 500, height: 300 },
    container,
    element,
    0.5,
  );

  assert.equal(after.left - before.left, cameraDx);
  assert.equal(after.top - before.top, cameraDy);
  assert.equal(after.width, before.width);
  assert.equal(after.height, before.height);
  assert.equal(before.left, 120 - 20 + 8 * 0.5);
  assert.equal(before.width, 100);
});

test('the body outline covers the frame, which moves with the camera', () => {
  const before = layerOverlayBox(
    { left: 80, top: 60, width: 400, height: 700 },
    { left: 10, top: 16 },
    null,
    1,
  );
  const after = layerOverlayBox(
    { left: 80 + 25, top: 60 - 10, width: 400, height: 700 },
    { left: 10, top: 16 },
    null,
    1,
  );
  assert.deepEqual(before, { left: 70, top: 44, width: 400, height: 700 });
  assert.equal(after.left - before.left, 25);
  assert.equal(after.top - before.top, -10);
});

test('a page opens on the fitted board unless that page has a saved camera', () => {
  const fitted = { x: 12, y: -4, zoom: 42 };
  assert.deepEqual(pageEnterView(null, fitted), fitted);

  const saved = { x: 300, y: 40, zoom: 80 };
  assert.deepEqual(pageEnterView(saved, fitted), saved);
});

test('saved page cameras round-trip and ignore invalid entries', () => {
  const storage = new Map<string, string>();
  const store = createPageViewStore({
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
      storage.set(key, value);
    },
  });

  store.write('page-a', { x: 10, y: 20, zoom: 55 });
  store.write('page-b', { x: -5, y: 8, zoom: 100 });
  store.remove('page-a');
  assert.equal(store.read('page-a'), null);
  assert.deepEqual(store.read('page-b'), { x: -5, y: 8, zoom: 100 });
  store.write('page-a', { x: 10, y: 20, zoom: 55 });
  assert.deepEqual(store.read('page-a'), { x: 10, y: 20, zoom: 55 });
  assert.deepEqual(store.read('page-b'), { x: -5, y: 8, zoom: 100 });
  assert.equal(store.read('missing'), null);
  assert.equal(store.read(''), null);

  storage.set(PAGE_CAMERA_STORAGE_KEY, JSON.stringify({
    bad: { x: 'no', y: 1, zoom: 1 },
    zero: { x: 1, y: 2, zoom: 0 },
    nan: { x: Number.NaN, y: 1, zoom: 1 },
    ok: { x: 3, y: 4, zoom: 25 },
  }));
  assert.deepEqual(store.read('ok'), { x: 3, y: 4, zoom: 25 });
  assert.equal(store.read('bad'), null);
  assert.equal(store.read('zero'), null);
  assert.equal(store.read('nan'), null);
  assert.deepEqual(parseSavedPageViews('not json'), {});
  assert.deepEqual(parseSavedPageViews(null), {});
});

test('wheel deltaY pans vertically, deltaX horizontally, and shift+wheel pans horizontally', () => {
  assert.deepEqual(wheelPanDelta(0, 48, false), { x: 0, y: 48 });
  assert.deepEqual(wheelPanDelta(-16, 0, false), { x: -16, y: 0 });
  assert.deepEqual(wheelPanDelta(6, 20, false), { x: 6, y: 20 });

  assert.deepEqual(wheelPanDelta(0, 48, true), { x: 48, y: 0 });
  assert.deepEqual(wheelPanDelta(48, 0, true), { x: 48, y: 0 });
  assert.deepEqual(wheelPanDelta(-10, 48, true), { x: -10, y: 0 });
});
