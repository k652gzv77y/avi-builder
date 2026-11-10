/**
 * Free-form canvas geometry.
 *
 * Stack and grid children stay in document flow and keep sibling reorder.
 * Absolute and fixed layers, and children of a frame (a relative/absolute
 * container that is not a stack), move by their top/left or right/bottom pins.
 * The drag gesture measures the painted box once and commits a single design
 * update, so zoom is applied by the caller before these numbers are used.
 */

import type { Layer } from '@/types';
import {
  applyBreakpointDesign,
  containerLayoutKind,
  readLayerPosition,
  toClassList,
  type DesignUpdate,
} from '@/lib/layout-model';

export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export interface FreeformBox {
  left: number;
  top: number;
  width: number;
  height: number;
  parentWidth: number;
  parentHeight: number;
}

export type SnapGuideEdge = 'left' | 'right' | 'top' | 'bottom' | 'center';

/** Which edge the snap line belongs to. The canvas and the guides panel share this. */
export interface SnapGuideTarget {
  role: 'parent' | 'sibling';
  /** Sibling or measured parent-layer label. Omitted for the containing block. */
  name?: string;
  edge: SnapGuideEdge;
}

export interface SnapGuide {
  axis: 'x' | 'y';
  at: number;
  targets: SnapGuideTarget[];
}

export interface SnapGuideBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Snap-guide box in iframe document pixels.
 * `viewportOrigin` and `at` come from the iframe document, which does not
 * include the editor camera. Painting the line in this space (absolute, not
 * fixed) keeps it on the element when the camera pans.
 */
export function snapGuideDocumentBox(
  guide: Pick<SnapGuide, 'axis' | 'at'>,
  viewportOrigin: { x: number; y: number },
  size: { width: number; height: number },
  scroll: { x: number; y: number },
): SnapGuideBox {
  const x = viewportOrigin.x + scroll.x;
  const y = viewportOrigin.y + scroll.y;
  if (guide.axis === 'x') {
    return { left: x + guide.at, top: y, width: 1, height: size.height };
  }
  return { left: x, top: y + guide.at, width: size.width, height: 1 };
}

export interface SnapLine {
  at: number;
  target: SnapGuideTarget;
}

export interface SnapTargets {
  x: SnapLine[];
  y: SnapLine[];
}

export interface SnapSample {
  left: number;
  top: number;
  width: number;
  height: number;
  name?: string;
  role?: 'parent' | 'sibling';
}

/** Resolves a canvas layer id to the label shown in the guides panel. */
export type SnapLabeler = (layerId: string) => string | undefined;

const MIN_SIZE = 1;
export const FREEFORM_SNAP_THRESHOLD = 5;

type Edge = 'left' | 'right' | 'top' | 'bottom';

export function isFreeformDraggable(layer: Layer | null | undefined, parent: Layer | null | undefined): boolean {
  if (!layer || layer.id === 'body' || layer.name === 'body') return false;
  const position = readLayerPosition(layer);
  if (position === 'absolute' || position === 'fixed') return true;
  if (position === 'sticky') return false;
  if (!parent || parent.id === 'body' || parent.name === 'body') return false;
  return containerLayoutKind(parent) === 'frame';
}

/** Screen pixels of a handle drag, divided by the editor zoom, in CSS pixels. */
export function screenDeltaToCanvas(
  startX: number,
  startY: number,
  x: number,
  y: number,
  zoomPercent: number,
): { dx: number; dy: number } {
  const scale = zoomPercent > 0 ? zoomPercent / 100 : 1;
  return {
    dx: (x - startX) / scale,
    dy: (y - startY) / scale,
  };
}

/**
 * Overlay handles report window pixels. Events that fall through into the
 * iframe report canvas CSS pixels, so scale those back onto the window.
 */
export function pointerToWindowPoint(
  clientX: number,
  clientY: number,
  fromIframe: boolean,
  iframeOrigin: { left: number; top: number } | null,
  zoomPercent: number,
): { x: number; y: number } {
  if (!fromIframe || !iframeOrigin) return { x: clientX, y: clientY };
  const scale = zoomPercent > 0 ? zoomPercent / 100 : 1;
  return {
    x: iframeOrigin.left + clientX * scale,
    y: iframeOrigin.top + clientY * scale,
  };
}

export function movedBox(box: FreeformBox, dx: number, dy: number): FreeformBox {
  return {
    ...box,
    left: box.left + dx,
    top: box.top + dy,
  };
}

export function resizedBox(box: FreeformBox, handle: ResizeHandle, dx: number, dy: number): FreeformBox {
  let left = box.left;
  let top = box.top;
  let width = box.width;
  let height = box.height;

  if (handle.includes('e')) width = box.width + dx;
  if (handle.includes('s')) height = box.height + dy;
  if (handle.includes('w')) {
    width = box.width - dx;
    left = box.left + dx;
  }
  if (handle.includes('n')) {
    height = box.height - dy;
    top = box.top + dy;
  }

  if (width < MIN_SIZE) {
    if (handle.includes('w')) left -= MIN_SIZE - width;
    width = MIN_SIZE;
  }
  if (height < MIN_SIZE) {
    if (handle.includes('n')) top -= MIN_SIZE - height;
    height = MIN_SIZE;
  }

  return { ...box, left, top, width, height };
}

export function constrainAxis(dx: number, dy: number, enabled: boolean): { dx: number; dy: number } {
  if (!enabled) return { dx, dy };
  if (Math.abs(dx) >= Math.abs(dy)) return { dx, dy: 0 };
  return { dx: 0, dy };
}

function sameGuideTarget(a: SnapGuideTarget, b: SnapGuideTarget): boolean {
  return a.role === b.role && a.edge === b.edge && (a.name ?? '') === (b.name ?? '');
}

function pushSnapLine(lines: SnapLine[], at: number, target: SnapGuideTarget) {
  if (!Number.isFinite(at)) return;
  const existing = lines.find((line) => Math.abs(line.at - at) < 0.01 && sameGuideTarget(line.target, target));
  if (existing) return;
  lines.push({ at, target });
}

export function collectSnapLines(
  siblings: SnapSample[],
  parentWidth: number,
  parentHeight: number,
): SnapTargets {
  const x: SnapLine[] = [];
  const y: SnapLine[] = [];
  pushSnapLine(x, 0, { role: 'parent', edge: 'left' });
  pushSnapLine(x, parentWidth / 2, { role: 'parent', edge: 'center' });
  pushSnapLine(x, parentWidth, { role: 'parent', edge: 'right' });
  pushSnapLine(y, 0, { role: 'parent', edge: 'top' });
  pushSnapLine(y, parentHeight / 2, { role: 'parent', edge: 'center' });
  pushSnapLine(y, parentHeight, { role: 'parent', edge: 'bottom' });
  for (const sibling of siblings) {
    const role = sibling.role ?? 'sibling';
    const name = sibling.name?.trim() || undefined;
    const target = (edge: SnapGuideEdge): SnapGuideTarget => (
      name ? { role, name, edge } : { role, edge }
    );
    pushSnapLine(x, sibling.left, target('left'));
    pushSnapLine(x, sibling.left + sibling.width / 2, target('center'));
    pushSnapLine(x, sibling.left + sibling.width, target('right'));
    pushSnapLine(y, sibling.top, target('top'));
    pushSnapLine(y, sibling.top + sibling.height / 2, target('center'));
    pushSnapLine(y, sibling.top + sibling.height, target('bottom'));
  }
  return { x, y };
}

interface AxisHit {
  at: number;
  targets: SnapGuideTarget[];
}

interface AxisSnap {
  delta: number;
  hits: AxisHit[];
}

function addAxisHit(hits: AxisHit[], at: number, target: SnapGuideTarget) {
  const existing = hits.find((hit) => Math.abs(hit.at - at) < 0.01);
  if (!existing) {
    hits.push({ at, targets: [target] });
    return;
  }
  if (!existing.targets.some((item) => sameGuideTarget(item, target))) {
    existing.targets.push(target);
  }
}

/**
 * Closest line within the threshold wins. Other lines that need the same
 * correction (left edge on the parent and right edge on a sibling) stay
 * visible. An opposite correction at the same distance is ignored so the
 * box is never pulled both ways. Targets that share a line are kept together
 * so one painted guide can name every edge it matches.
 */
function snapAxis(edges: number[], lines: SnapLine[], threshold: number): AxisSnap | null {
  let best: AxisSnap | null = null;
  for (const line of lines) {
    if (!Number.isFinite(line.at)) continue;
    for (const edge of edges) {
      const delta = line.at - edge;
      const distance = Math.abs(delta);
      if (distance > threshold) continue;
      if (!best || distance < Math.abs(best.delta) - 0.001) {
        best = { delta, hits: [{ at: line.at, targets: [line.target] }] };
        continue;
      }
      const sameCorrection = Math.abs(distance - Math.abs(best.delta)) <= 0.001 && delta * best.delta >= 0;
      if (sameCorrection) addAxisHit(best.hits, line.at, line.target);
    }
  }
  return best;
}

function guidesFor(axis: 'x' | 'y', snap: AxisSnap | null): SnapGuide[] {
  if (!snap) return [];
  return snap.hits.map((hit) => ({ axis, at: hit.at, targets: hit.targets }));
}

export function snapTranslation(
  box: FreeformBox,
  dx: number,
  dy: number,
  targets: SnapTargets,
  threshold = FREEFORM_SNAP_THRESHOLD,
): { dx: number; dy: number; guides: SnapGuide[] } {
  const left = box.left + dx;
  const top = box.top + dy;
  const right = left + box.width;
  const bottom = top + box.height;
  const centerX = left + box.width / 2;
  const centerY = top + box.height / 2;

  const bestX = snapAxis([left, centerX, right], targets.x, threshold);
  const bestY = snapAxis([top, centerY, bottom], targets.y, threshold);

  return {
    dx: dx + (bestX?.delta ?? 0),
    dy: dy + (bestY?.delta ?? 0),
    guides: [...guidesFor('x', bestX), ...guidesFor('y', bestY)],
  };
}

/**
 * Shift locks one axis to zero. A snap on that axis would drag the layer
 * off the locked line, so drop it and its guide. A snap of zero (already
 * aligned) stays.
 */
export function respectShiftLock(
  snapped: { dx: number; dy: number; guides: SnapGuide[] },
  locked: { dx: number; dy: number },
  shiftKey: boolean,
): { dx: number; dy: number; guides: SnapGuide[] } {
  if (!shiftKey) return snapped;
  let { dx, dy } = snapped;
  let guides = snapped.guides;
  if (locked.dx === 0 && dx !== 0) {
    dx = 0;
    guides = guides.filter((guide) => guide.axis !== 'x');
  }
  if (locked.dy === 0 && dy !== 0) {
    dy = 0;
    guides = guides.filter((guide) => guide.axis !== 'y');
  }
  return { dx, dy, guides };
}

/**
 * Snap only the edges the handle is moving. The anchored edge stays put,
 * and a correction that would collapse the box is ignored.
 */
export function snapResizedBox(
  box: FreeformBox,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  targets: SnapTargets,
  threshold = FREEFORM_SNAP_THRESHOLD,
): { box: FreeformBox; guides: SnapGuide[] } {
  const resized = resizedBox(box, handle, dx, dy);
  let { left, top, width, height } = resized;
  const guides: SnapGuide[] = [];

  if (handle.includes('e') || handle.includes('w')) {
    const moveStart = handle.includes('w');
    const edge = moveStart ? left : left + width;
    const hit = snapAxis([edge], targets.x, threshold);
    if (hit) {
      if (moveStart) {
        const nextWidth = width - hit.delta;
        if (nextWidth >= MIN_SIZE) {
          left += hit.delta;
          width = nextWidth;
          guides.push(...guidesFor('x', hit));
        }
      } else if (width + hit.delta >= MIN_SIZE) {
        width += hit.delta;
        guides.push(...guidesFor('x', hit));
      }
    }
  }

  if (handle.includes('n') || handle.includes('s')) {
    const moveStart = handle.includes('n');
    const edge = moveStart ? top : top + height;
    const hit = snapAxis([edge], targets.y, threshold);
    if (hit) {
      if (moveStart) {
        const nextHeight = height - hit.delta;
        if (nextHeight >= MIN_SIZE) {
          top += hit.delta;
          height = nextHeight;
          guides.push(...guidesFor('y', hit));
        }
      } else if (height + hit.delta >= MIN_SIZE) {
        height += hit.delta;
        guides.push(...guidesFor('y', hit));
      }
    }
  }

  return {
    box: { ...resized, left, top, width, height },
    guides,
  };
}

/**
 * Move keeps the pins the layer already uses (left, right, or both).
 * Resize locks the painted box to left/top plus a fixed width/height so
 * right/bottom cannot fight the new size.
 */
export function applyFreeformBox(
  layer: Layer,
  box: FreeformBox,
  edit: 'move' | 'resize',
): Partial<Layer> {
  const left = px(box.left);
  const top = px(box.top);
  const width = Math.max(MIN_SIZE, Math.round(finite(box.width)));
  const height = Math.max(MIN_SIZE, Math.round(finite(box.height)));
  const right = box.parentWidth > 0 ? Math.round(box.parentWidth - finite(box.left) - width) : null;
  const bottom = box.parentHeight > 0 ? Math.round(box.parentHeight - finite(box.top) - height) : null;
  const pins = {
    left: isPinned(readEdge(layer, 'left')),
    right: isPinned(readEdge(layer, 'right')),
    top: isPinned(readEdge(layer, 'top')),
    bottom: isPinned(readEdge(layer, 'bottom')),
  };

  const updates: DesignUpdate[] = [];
  const position = readLayerPosition(layer);
  if (position !== 'fixed' && position !== 'absolute') {
    updates.push({ category: 'positioning', property: 'position', value: 'absolute' });
  }

  if (edit === 'resize') {
    updates.push(
      { category: 'positioning', property: 'left', value: left },
      { category: 'positioning', property: 'top', value: top },
      { category: 'sizing', property: 'width', value: px(width) },
      { category: 'sizing', property: 'height', value: px(height) },
    );
    if (pins.right) updates.push({ category: 'positioning', property: 'right', value: null });
    if (pins.bottom) updates.push({ category: 'positioning', property: 'bottom', value: null });
    return applyBreakpointDesign(layer, updates, 'desktop');
  }

  if (pins.left && pins.right && right !== null) {
    updates.push(
      { category: 'positioning', property: 'left', value: left },
      { category: 'positioning', property: 'right', value: px(right) },
    );
  } else if (pins.right && !pins.left && right !== null) {
    updates.push({ category: 'positioning', property: 'right', value: px(right) });
  } else {
    updates.push({ category: 'positioning', property: 'left', value: left });
  }

  if (pins.top && pins.bottom && bottom !== null) {
    updates.push(
      { category: 'positioning', property: 'top', value: top },
      { category: 'positioning', property: 'bottom', value: px(bottom) },
    );
  } else if (pins.bottom && !pins.top && bottom !== null) {
    updates.push({ category: 'positioning', property: 'bottom', value: px(bottom) });
  } else {
    updates.push({ category: 'positioning', property: 'top', value: top });
  }

  return applyBreakpointDesign(layer, updates, 'desktop');
}

/**
 * Arrow-key nudge. A measured box keeps the layer visually where it is.
 * Without a measurement, only existing px pins move, so an unpositioned
 * layer is not jumped to 0,0.
 */
export function nudgeFreeformLayer(
  layer: Layer,
  dx: number,
  dy: number,
  box?: FreeformBox | null,
): Partial<Layer> | null {
  if (box) return applyFreeformBox(layer, movedBox(box, dx, dy), 'move');

  const updates: DesignUpdate[] = [];
  const movedX = dx ? shiftPins(layer, 'left', 'right', dx, updates) : false;
  const movedY = dy ? shiftPins(layer, 'top', 'bottom', dy, updates) : false;
  if (!movedX && !movedY) return null;

  const position = readLayerPosition(layer);
  if (position !== 'fixed' && position !== 'absolute') {
    updates.unshift({ category: 'positioning', property: 'position', value: 'absolute' });
  }
  return applyBreakpointDesign(layer, updates, 'desktop');
}

function shiftPins(
  layer: Layer,
  start: Edge,
  end: Edge,
  delta: number,
  updates: DesignUpdate[],
): boolean {
  if (!delta) return false;
  const startValue = parsePx(readEdge(layer, start));
  const endValue = parsePx(readEdge(layer, end));
  const startPinned = isPinned(readEdge(layer, start));
  const endPinned = isPinned(readEdge(layer, end));

  if (startValue !== null && endValue !== null) {
    updates.push(
      { category: 'positioning', property: start, value: px(startValue + delta) },
      { category: 'positioning', property: end, value: px(endValue - delta) },
    );
    return true;
  }
  if (startValue !== null && (!endPinned || endValue !== null)) {
    updates.push({ category: 'positioning', property: start, value: px(startValue + delta) });
    return true;
  }
  if (endValue !== null && !startPinned) {
    updates.push({ category: 'positioning', property: end, value: px(endValue - delta) });
    return true;
  }
  return false;
}

function readEdge(layer: Layer, edge: Edge): string | undefined {
  const classes = toClassList(layer.classes);
  for (let index = classes.length - 1; index >= 0; index -= 1) {
    const token = classes[index];
    if (/^(max-lg|max-md|lg|md|hover|focus|active|disabled|visited|current):/.test(token)) continue;
    const parsed = lengthFromClass(edge, token);
    if (parsed) return parsed;
  }
  return layer.design?.positioning?.[edge];
}

function lengthFromClass(edge: Edge, token: string): string | undefined {
  if (token === `${edge}-auto`) return 'auto';
  const arbitrary = token.match(new RegExp(`^${edge}-\\[(.+)\\]$`));
  if (arbitrary) return arbitrary[1];
  if (token === `${edge}-0`) return '0px';
  if (token === `${edge}-px`) return '1px';
  if (token.startsWith(`${edge}-`)) return token.slice(edge.length + 1);
  return undefined;
}

function isPinned(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim().toLowerCase();
  return trimmed !== '' && trimmed !== 'auto';
}

function parsePx(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'auto' || trimmed.endsWith('%')) return null;
  const match = trimmed.match(/^-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const unit = trimmed.slice(match[0].length).trim().toLowerCase();
  if (unit && unit !== 'px') return null;
  const amount = Number(match[0]);
  return Number.isFinite(amount) ? amount : null;
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function px(value: number): string {
  const rounded = Math.round(finite(value));
  return `${Object.is(rounded, -0) ? 0 : rounded}px`;
}
