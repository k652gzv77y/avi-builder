/**
 * Overlay chrome: kind, close rules, and viewport placement.
 * Modal and sheet cover the page. Popover, tooltip, and menu anchor to a layer
 * and flip to the opposite side when they would otherwise leave the viewport.
 */

import type {
  OverlayAnchor,
  OverlayDismiss,
  OverlayKind,
  OverlayPlacement,
} from '@/types';

export const OVERLAY_VIEWPORT_MARGIN = 8;
export const OVERLAY_ANCHOR_GAP = 8;

export const OVERLAY_KINDS: readonly OverlayKind[] = [
  'modal',
  'popover',
  'tooltip',
  'sheet',
  'menu',
];

export interface OverlaySize {
  width: number;
  height: number;
}

export interface OverlayRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface OverlayViewport {
  width: number;
  height: number;
}

export interface AnchoredOverlayPosition {
  top: number;
  left: number;
  side: OverlayAnchor;
  flipped: boolean;
}

const OPPOSITE_SIDE: Record<OverlayAnchor, OverlayAnchor> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

export function resolveOverlayKind(overlay: {
  placement: OverlayPlacement;
  kind?: OverlayKind;
}): OverlayKind {
  if (overlay.kind) return overlay.kind;
  return overlay.placement === 'relative' ? 'popover' : 'modal';
}

export function placementForKind(kind: OverlayKind): OverlayPlacement {
  return kind === 'popover' || kind === 'tooltip' || kind === 'menu' ? 'relative' : 'fixed';
}

export function overlayIsAnchored(kind: OverlayKind): boolean {
  return placementForKind(kind) === 'relative';
}

export function overlayKindLabel(kind: OverlayKind): string {
  switch (kind) {
    case 'modal':
      return 'Modal';
    case 'sheet':
      return 'Sheet';
    case 'popover':
      return 'Popover';
    case 'tooltip':
      return 'Tooltip';
    case 'menu':
      return 'Menu';
    default:
      return 'Modal';
  }
}

export function defaultDismissForKind(kind: OverlayKind): OverlayDismiss {
  if (kind === 'tooltip') {
    return { escape: true, outside: true, restoreFocus: false };
  }
  return { escape: true, outside: true, restoreFocus: true };
}

/** Modal and sheet dim the page. Anchored overlays do not. */
export function overlayUsesBackdrop(kind: OverlayKind): boolean {
  return kind === 'modal' || kind === 'sheet';
}

/** Tooltips stay out of the tab order. Every other kind traps Tab. */
export function overlayTrapsFocus(kind: OverlayKind): boolean {
  return kind !== 'tooltip';
}

/** Tooltips do not move focus. Other kinds focus the overlay while open. */
export function overlayTakesFocus(kind: OverlayKind): boolean {
  return kind !== 'tooltip';
}

export function overlayAriaRole(kind: OverlayKind): 'dialog' | 'tooltip' | 'menu' {
  if (kind === 'tooltip') return 'tooltip';
  if (kind === 'menu') return 'menu';
  return 'dialog';
}

/** A backdrop click uses the same rule as a click outside the overlay. */
export function pointerZoneForDismiss(
  zone: 'overlay' | 'trigger' | 'backdrop' | 'outside',
): 'overlay' | 'trigger' | 'outside' {
  return zone === 'backdrop' ? 'outside' : zone;
}

/**
 * Next focusable index on Tab, or null when the browser should move focus.
 * `activeIndex` null means focus is currently outside the overlay.
 */
export function trapFocusIndex(
  activeIndex: number | null,
  count: number,
  shift: boolean,
): number | null {
  if (count <= 0) return null;
  if (activeIndex === null || activeIndex < 0 || activeIndex >= count) {
    return shift ? count - 1 : 0;
  }
  if (shift && activeIndex === 0) return count - 1;
  if (!shift && activeIndex === count - 1) return 0;
  return null;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function fitsOnSide(
  side: OverlayAnchor,
  anchor: OverlayRect,
  overlay: OverlaySize,
  viewport: OverlayViewport,
  gap: number,
  margin: number,
): boolean {
  if (side === 'bottom') {
    return anchor.top + anchor.height + gap + overlay.height <= viewport.height - margin;
  }
  if (side === 'top') {
    return anchor.top - gap - overlay.height >= margin;
  }
  if (side === 'right') {
    return anchor.left + anchor.width + gap + overlay.width <= viewport.width - margin;
  }
  return anchor.left - gap - overlay.width >= margin;
}

function positionOnSide(
  side: OverlayAnchor,
  anchor: OverlayRect,
  overlay: OverlaySize,
  gap: number,
): { top: number; left: number } {
  if (side === 'bottom') {
    return { top: anchor.top + anchor.height + gap, left: anchor.left };
  }
  if (side === 'top') {
    return { top: anchor.top - gap - overlay.height, left: anchor.left };
  }
  if (side === 'right') {
    return { top: anchor.top, left: anchor.left + anchor.width + gap };
  }
  return { top: anchor.top, left: anchor.left - gap - overlay.width };
}

/**
 * Place an anchored overlay beside the anchor.
 * Prefers `side`, flips to the opposite side when that side fits and the
 * preferred side does not, then clamps the box inside the viewport margin.
 */
export function placeAnchoredOverlay(input: {
  anchor: OverlayRect;
  overlay: OverlaySize;
  viewport: OverlayViewport;
  side?: OverlayAnchor;
  gap?: number;
  margin?: number;
}): AnchoredOverlayPosition {
  const side = input.side ?? 'bottom';
  const gap = input.gap ?? OVERLAY_ANCHOR_GAP;
  const margin = input.margin ?? OVERLAY_VIEWPORT_MARGIN;
  const { anchor, overlay, viewport } = input;

  let chosen = side;
  let flipped = false;
  const preferredFits = fitsOnSide(side, anchor, overlay, viewport, gap, margin);
  const opposite = OPPOSITE_SIDE[side];
  if (!preferredFits && fitsOnSide(opposite, anchor, overlay, viewport, gap, margin)) {
    chosen = opposite;
    flipped = true;
  }

  const raw = positionOnSide(chosen, anchor, overlay, gap);
  const maxLeft = viewport.width - margin - overlay.width;
  const maxTop = viewport.height - margin - overlay.height;
  return {
    top: Math.round(clamp(raw.top, margin, Math.max(margin, maxTop))),
    left: Math.round(clamp(raw.left, margin, Math.max(margin, maxLeft))),
    side: chosen,
    flipped,
  };
}

/** Center a modal dialog, pinned to the viewport margin when it is larger than the screen. */
export function placeModalOverlay(input: {
  overlay: OverlaySize;
  viewport: OverlayViewport;
  margin?: number;
}): { top: number; left: number } {
  const margin = input.margin ?? OVERLAY_VIEWPORT_MARGIN;
  const { overlay, viewport } = input;
  const maxLeft = viewport.width - margin - overlay.width;
  const maxTop = viewport.height - margin - overlay.height;
  return {
    top: Math.round(clamp((viewport.height - overlay.height) / 2, margin, Math.max(margin, maxTop))),
    left: Math.round(clamp((viewport.width - overlay.width) / 2, margin, Math.max(margin, maxLeft))),
  };
}

/** Bottom sheet. Horizontally centered, sitting on the viewport margin. No drag. */
export function placeSheetOverlay(input: {
  overlay: OverlaySize;
  viewport: OverlayViewport;
  margin?: number;
}): { top: number; left: number } {
  const margin = input.margin ?? OVERLAY_VIEWPORT_MARGIN;
  const { overlay, viewport } = input;
  const maxLeft = viewport.width - margin - overlay.width;
  return {
    top: Math.round(Math.max(margin, viewport.height - margin - overlay.height)),
    left: Math.round(clamp((viewport.width - overlay.width) / 2, margin, Math.max(margin, maxLeft))),
  };
}
