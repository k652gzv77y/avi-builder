import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dismissOnPointer } from '@/lib/interactions-framer';
import {
  OVERLAY_ANCHOR_GAP,
  OVERLAY_VIEWPORT_MARGIN,
  defaultDismissForKind,
  overlayIsAnchored,
  overlayTakesFocus,
  overlayTrapsFocus,
  overlayUsesBackdrop,
  placeAnchoredOverlay,
  placeModalOverlay,
  placeSheetOverlay,
  placementForKind,
  pointerZoneForDismiss,
  resolveOverlayKind,
  trapFocusIndex,
} from '@/lib/overlay-position';

const viewport = { width: 400, height: 300 };

test('modal centers and pins to the margin when it is larger than the screen', () => {
  const centered = placeModalOverlay({
    overlay: { width: 100, height: 80 },
    viewport,
  });
  assert.deepEqual(centered, { top: 110, left: 150 });

  const oversized = placeModalOverlay({
    overlay: { width: 500, height: 500 },
    viewport,
  });
  assert.deepEqual(oversized, {
    top: OVERLAY_VIEWPORT_MARGIN,
    left: OVERLAY_VIEWPORT_MARGIN,
  });
});

test('sheet sits on the bottom edge and clamps a wide panel', () => {
  const fitted = placeSheetOverlay({
    overlay: { width: 200, height: 80 },
    viewport,
  });
  assert.deepEqual(fitted, { top: 212, left: 100 });

  const wide = placeSheetOverlay({
    overlay: { width: 500, height: 80 },
    viewport,
  });
  assert.equal(wide.left, OVERLAY_VIEWPORT_MARGIN);
  assert.equal(wide.top, 212);
});

test('anchored overlay prefers the requested side when it fits', () => {
  const placed = placeAnchoredOverlay({
    anchor: { top: 40, left: 16, width: 80, height: 24 },
    overlay: { width: 120, height: 60 },
    viewport,
    side: 'bottom',
  });
  assert.equal(placed.flipped, false);
  assert.equal(placed.side, 'bottom');
  assert.equal(placed.top, 40 + 24 + OVERLAY_ANCHOR_GAP);
  assert.equal(placed.left, 16);
});

test('anchored overlay flips to the opposite side and then clamps', () => {
  const flippedUp = placeAnchoredOverlay({
    anchor: { top: 250, left: 20, width: 40, height: 30 },
    overlay: { width: 100, height: 80 },
    viewport,
    side: 'bottom',
  });
  assert.equal(flippedUp.flipped, true);
  assert.equal(flippedUp.side, 'top');
  assert.equal(flippedUp.top, 250 - OVERLAY_ANCHOR_GAP - 80);
  assert.equal(flippedUp.left, 20);

  const flippedLeft = placeAnchoredOverlay({
    anchor: { top: 40, left: 340, width: 40, height: 20 },
    overlay: { width: 100, height: 40 },
    viewport,
    side: 'right',
  });
  assert.equal(flippedLeft.flipped, true);
  assert.equal(flippedLeft.side, 'left');
  assert.equal(flippedLeft.left, 340 - OVERLAY_ANCHOR_GAP - 100);
  assert.equal(flippedLeft.top, 40);

  const clamped = placeAnchoredOverlay({
    anchor: { top: 40, left: 360, width: 20, height: 20 },
    overlay: { width: 100, height: 40 },
    viewport,
    side: 'bottom',
  });
  assert.equal(clamped.flipped, false);
  assert.equal(clamped.left, 400 - OVERLAY_VIEWPORT_MARGIN - 100);
  assert.equal(clamped.top, 40 + 20 + OVERLAY_ANCHOR_GAP);
});

test('anchored overlay clamps when neither side can fit', () => {
  const placed = placeAnchoredOverlay({
    anchor: { top: 100, left: 40, width: 20, height: 20 },
    overlay: { width: 80, height: 500 },
    viewport,
    side: 'bottom',
  });
  assert.equal(placed.flipped, false);
  assert.equal(placed.side, 'bottom');
  assert.equal(placed.top, OVERLAY_VIEWPORT_MARGIN);
  assert.equal(placed.left, 40);
});

test('focus trap wraps at the ends and pulls outside focus back in', () => {
  assert.equal(trapFocusIndex(0, 3, true), 2);
  assert.equal(trapFocusIndex(2, 3, false), 0);
  assert.equal(trapFocusIndex(1, 3, false), null);
  assert.equal(trapFocusIndex(null, 3, false), 0);
  assert.equal(trapFocusIndex(null, 3, true), 2);
  assert.equal(trapFocusIndex(0, 0, false), null);
});

test('close rules treat the backdrop as an outside click', () => {
  const dismiss = { escape: true, outside: true, restoreFocus: true };
  assert.equal(pointerZoneForDismiss('backdrop'), 'outside');
  assert.equal(pointerZoneForDismiss('overlay'), 'overlay');
  assert.equal(dismissOnPointer(dismiss, pointerZoneForDismiss('backdrop')), true);
  assert.equal(dismissOnPointer(dismiss, pointerZoneForDismiss('overlay')), false);
  assert.equal(
    dismissOnPointer({ ...dismiss, outside: false }, pointerZoneForDismiss('backdrop')),
    false,
  );
});

test('kind defaults preserve older fixed and relative overlays', () => {
  assert.equal(resolveOverlayKind({ placement: 'fixed' }), 'modal');
  assert.equal(resolveOverlayKind({ placement: 'relative' }), 'popover');
  assert.equal(resolveOverlayKind({ placement: 'fixed', kind: 'sheet' }), 'sheet');
  assert.equal(placementForKind('sheet'), 'fixed');
  assert.equal(placementForKind('menu'), 'relative');
  assert.equal(overlayIsAnchored('popover'), true);
  assert.equal(overlayIsAnchored('modal'), false);
  assert.equal(overlayUsesBackdrop('modal'), true);
  assert.equal(overlayUsesBackdrop('sheet'), true);
  assert.equal(overlayUsesBackdrop('tooltip'), false);
  assert.equal(overlayTrapsFocus('modal'), true);
  assert.equal(overlayTrapsFocus('tooltip'), false);
  assert.equal(overlayTakesFocus('menu'), true);
  assert.equal(overlayTakesFocus('tooltip'), false);
  assert.equal(defaultDismissForKind('tooltip').restoreFocus, false);
  assert.equal(defaultDismissForKind('popover').restoreFocus, true);
});
