import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FRAME_ADD_BUTTON_SIZE,
  FRAME_LABEL_HEIGHT,
  PHONE_VIEWPORT_HEIGHT,
  centerBoardCamera,
  centerScrollOffset,
  deviceViewportHeight,
  fitBoardZoom,
  layoutPublishedFrame,
  panCamera,
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

test('wheel deltaY pans vertically, deltaX horizontally, and shift+wheel pans horizontally', () => {
  assert.deepEqual(wheelPanDelta(0, 48, false), { x: 0, y: 48 });
  assert.deepEqual(wheelPanDelta(-16, 0, false), { x: -16, y: 0 });
  assert.deepEqual(wheelPanDelta(6, 20, false), { x: 6, y: 20 });

  assert.deepEqual(wheelPanDelta(0, 48, true), { x: 48, y: 0 });
  assert.deepEqual(wheelPanDelta(48, 0, true), { x: 48, y: 0 });
  assert.deepEqual(wheelPanDelta(-10, 48, true), { x: -10, y: 0 });
});
