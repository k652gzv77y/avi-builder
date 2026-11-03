/**
 * Pure drag math for a Drag event.
 * The runtime paints the translate and switches variants. This file decides
 * where the layer lands and which threshold variant is active.
 */

import type {
  ActionTransition,
  DragAxis,
  DragBounds,
  DragDirection,
  DragPhase,
  DragRelease,
  DragSnapPoint,
  DragTrigger,
  DragVariantRule,
  InteractionAction,
  LayerInteraction,
} from '@/types';

/** Movement below this does not count as a drag, so a tap can still click. */
export const DRAG_SLOP_PX = 4;

/** How long a release velocity is allowed to carry the layer. */
export const DRAG_MOMENTUM_MS = 180;

/** Cap on that carry, so a fast flick cannot leave the page. */
export const DRAG_MOMENTUM_MAX_PX = 240;

/** Default distance for a new drag-to-variant rule. */
export const DEFAULT_DRAG_DISTANCE_PX = 48;

export interface DragPoint {
  x: number;
  y: number;
}

export interface DragLimits {
  minX: number | null;
  maxX: number | null;
  minY: number | null;
  maxY: number | null;
}

export interface DragVariantChoice {
  targetLayerId: string;
  variantId: string;
  release: DragRelease;
  /** Present when the Set Variant action authored a transition. */
  transition?: ActionTransition;
}

const AXES = new Set<DragAxis>(['free', 'x', 'y', 'both']);
const PHASES = new Set<DragPhase>(['move', 'end', 'both']);
const DIRECTIONS = new Set<DragDirection>(['left', 'right', 'up', 'down']);
const RELEASES = new Set<DragRelease>(['stick', 'return']);

export function defaultDragTrigger(): DragTrigger {
  return { axis: 'free', phase: 'end', momentum: false };
}

export function defaultDragVariantRule(): DragVariantRule {
  return { direction: 'right', distance: DEFAULT_DRAG_DISTANCE_PX, release: 'stick' };
}

export function normalizeDragTrigger(drag: DragTrigger | undefined): DragTrigger & { phase: DragPhase } {
  const phase = drag?.phase;
  return {
    axis: drag?.axis ?? 'free',
    phase: phase === 'move' || phase === 'both' ? phase : 'end',
    momentum: drag?.momentum === true,
    ...(drag?.bounds ? { bounds: drag.bounds } : {}),
    ...(drag?.snap && drag.snap.length > 0 ? { snap: drag.snap } : {}),
  };
}

export function withDrag(interaction: LayerInteraction, patch: Partial<DragTrigger>): LayerInteraction {
  return {
    ...interaction,
    drag: { ...defaultDragTrigger(), ...interaction.drag, ...patch },
  };
}

export function sanitizeDragPixels(value: unknown): number | null {
  let numeric: number;
  if (typeof value === 'number') numeric = value;
  else if (typeof value === 'string' && value.trim() !== '') numeric = Number(value);
  else return null;
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalPixels(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  const pixels = sanitizeDragPixels(value);
  if (pixels === null) throw new Error(`${label} is not supported`);
  return pixels;
}

/** Read a stored Drag event. A missing document uses the defaults. */
export function readDragTrigger(value: unknown): DragTrigger {
  if (value === undefined) return defaultDragTrigger();
  if (!isRecord(value)) throw new Error('Drag trigger is not supported');
  if (!AXES.has(value.axis as DragAxis)) throw new Error('Drag axis is not supported');
  if (value.phase !== undefined && !PHASES.has(value.phase as DragPhase)) {
    throw new Error('Drag phase is not supported');
  }
  if (value.momentum !== undefined && typeof value.momentum !== 'boolean') {
    throw new Error('Drag momentum is not supported');
  }
  const drag: DragTrigger = {
    axis: value.axis as DragAxis,
    phase: value.phase === 'move' || value.phase === 'both' ? value.phase : 'end',
    momentum: value.momentum === true,
  };
  if (value.bounds !== undefined) drag.bounds = readDragBounds(value.bounds);
  if (value.snap !== undefined) drag.snap = readSnapPoints(value.snap);
  return drag;
}

function readDragBounds(value: unknown): DragBounds {
  if (!isRecord(value)) throw new Error('Drag bounds are not supported');
  if (value.reference !== 'parent' && value.reference !== 'px') {
    throw new Error('Drag bounds are not supported');
  }
  const bounds: DragBounds = { reference: value.reference };
  const minX = readOptionalPixels(value.minX, 'Drag min X');
  const maxX = readOptionalPixels(value.maxX, 'Drag max X');
  const minY = readOptionalPixels(value.minY, 'Drag min Y');
  const maxY = readOptionalPixels(value.maxY, 'Drag max Y');
  if (minX !== undefined) bounds.minX = minX;
  if (maxX !== undefined) bounds.maxX = maxX;
  if (minY !== undefined) bounds.minY = minY;
  if (maxY !== undefined) bounds.maxY = maxY;
  return bounds;
}

function readSnapPoints(value: unknown): DragSnapPoint[] {
  if (!Array.isArray(value)) throw new Error('Drag snap points are not supported');
  return value.map((point) => {
    if (!isRecord(point)) throw new Error('Drag snap point is not supported');
    const x = sanitizeDragPixels(point.x);
    const y = sanitizeDragPixels(point.y);
    if (x === null || y === null) throw new Error('Drag snap point is not supported');
    return { x, y };
  });
}

/** Read the direction rule stored on a Set Variant action. */
export function readDragVariantRule(value: unknown): DragVariantRule {
  if (!isRecord(value)) throw new Error('Drag variant rule is not supported');
  if (!DIRECTIONS.has(value.direction as DragDirection)) {
    throw new Error('Drag direction is not supported');
  }
  const distance = sanitizeDragPixels(value.distance);
  if (distance === null || distance < 0) throw new Error('Drag distance is not supported');
  if (value.release !== undefined && !RELEASES.has(value.release as DragRelease)) {
    throw new Error('Drag release is not supported');
  }
  return {
    direction: value.direction as DragDirection,
    distance,
    release: value.release === 'return' ? 'return' : 'stick',
  };
}

export function dragPastSlop(delta: DragPoint): boolean {
  return Math.hypot(delta.x, delta.y) >= DRAG_SLOP_PX;
}

/**
 * `free` follows both axes. `x` and `y` lock one axis.
 * `both` waits until the pointer clears the slop, then locks to the larger axis.
 */
export function lockDragAxis(
  axis: DragAxis,
  delta: DragPoint,
  locked: 'x' | 'y' | null,
): { delta: DragPoint; locked: 'x' | 'y' | null } {
  if (axis === 'x') return { delta: { x: delta.x, y: 0 }, locked: 'x' };
  if (axis === 'y') return { delta: { x: 0, y: delta.y }, locked: 'y' };
  if (axis === 'free') return { delta, locked: null };
  if (!dragPastSlop(delta)) return { delta: { x: 0, y: 0 }, locked: null };
  const next = locked ?? (Math.abs(delta.x) >= Math.abs(delta.y) ? 'x' : 'y');
  return {
    delta: next === 'x' ? { x: delta.x, y: 0 } : { x: 0, y: delta.y },
    locked: next,
  };
}

export function clampDragPoint(point: DragPoint, limits: DragLimits): DragPoint {
  return {
    x: clampAxis(point.x, limits.minX, limits.maxX),
    y: clampAxis(point.y, limits.minY, limits.maxY),
  };
}

function clampAxis(value: number, min: number | null, max: number | null): number {
  let next = value;
  let hi = max;
  if (min != null && hi != null && hi < min) hi = null;
  if (min != null) next = Math.max(min, next);
  if (hi != null) next = Math.min(hi, next);
  return next;
}

function tighterLow(explicit: number | null, parent: number | null): number | null {
  if (explicit == null) return parent;
  if (parent == null) return explicit;
  return Math.max(explicit, parent);
}

function tighterHigh(explicit: number | null, parent: number | null): number | null {
  if (explicit == null) return parent;
  if (parent == null) return explicit;
  return Math.min(explicit, parent);
}

/**
 * Pixel limits from the resting position.
 * `parent` also clamps the layer box inside the parent. The tighter side wins.
 * Resting is the layer's layout position inside the parent, before this drag's translate.
 */
export function limitsForBounds(
  bounds: DragBounds | undefined,
  element: { width: number; height: number },
  parent: { width: number; height: number } | null,
  restingInParent: DragPoint,
): DragLimits {
  if (!bounds) return { minX: null, maxX: null, minY: null, maxY: null };
  const explicit: DragLimits = {
    minX: bounds.minX ?? null,
    maxX: bounds.maxX ?? null,
    minY: bounds.minY ?? null,
    maxY: bounds.maxY ?? null,
  };
  if (bounds.reference === 'px' || !parent) return explicit;
  return {
    minX: tighterLow(explicit.minX, -restingInParent.x),
    maxX: tighterHigh(explicit.maxX, parent.width - restingInParent.x - element.width),
    minY: tighterLow(explicit.minY, -restingInParent.y),
    maxY: tighterHigh(explicit.maxY, parent.height - restingInParent.y - element.height),
  };
}

/** Project a release velocity. `velocity` is pixels per millisecond. */
export function momentumCarry(offset: DragPoint, velocity: DragPoint): DragPoint {
  let x = velocity.x * DRAG_MOMENTUM_MS;
  let y = velocity.y * DRAG_MOMENTUM_MS;
  const distance = Math.hypot(x, y);
  if (distance > DRAG_MOMENTUM_MAX_PX) {
    const scale = DRAG_MOMENTUM_MAX_PX / distance;
    x *= scale;
    y *= scale;
  }
  return { x: offset.x + x, y: offset.y + y };
}

/**
 * Nearest snap point. A locked axis keeps the offset on the other axis,
 * so a horizontal drag does not jump vertically to a snap.
 */
export function nearestSnapPoint(
  offset: DragPoint,
  snaps: DragSnapPoint[] | undefined,
  axis: DragAxis,
  locked: 'x' | 'y' | null,
): DragPoint {
  if (!snaps || snaps.length === 0) return offset;
  const lock = axis === 'x' ? 'x' : axis === 'y' ? 'y' : axis === 'both' ? locked : null;
  let best = offset;
  let bestDistance = Infinity;
  for (const snap of snaps) {
    const candidate = {
      x: lock === 'y' ? offset.x : snap.x,
      y: lock === 'x' ? offset.y : snap.y,
    };
    const distance = (candidate.x - offset.x) ** 2 + (candidate.y - offset.y) ** 2;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

export interface DragMoveProjection {
  offset: DragPoint;
  /** How far this gesture has moved the layer, after axis lock and bounds. */
  delta: DragPoint;
  locked: 'x' | 'y' | null;
  active: boolean;
}

/** Where the layer sits while the pointer is down. Under the slop, it stays put. */
export function projectDragMove(
  spec: DragTrigger,
  startOffset: DragPoint,
  rawDelta: DragPoint,
  locked: 'x' | 'y' | null,
  limits: DragLimits,
): DragMoveProjection {
  const drag = normalizeDragTrigger(spec);
  if (!dragPastSlop(rawDelta)) {
    const idleLock = drag.axis === 'x' ? 'x' : drag.axis === 'y' ? 'y' : null;
    return { offset: startOffset, delta: { x: 0, y: 0 }, locked: idleLock, active: false };
  }
  const axis = lockDragAxis(drag.axis, rawDelta, locked);
  const offset = clampDragPoint({
    x: startOffset.x + axis.delta.x,
    y: startOffset.y + axis.delta.y,
  }, limits);
  return {
    offset,
    delta: { x: offset.x - startOffset.x, y: offset.y - startOffset.y },
    locked: axis.locked,
    active: true,
  };
}

/** Landing point after release: momentum, then bounds, then the nearest snap, then bounds again. */
export function settleDragOffset(
  spec: DragTrigger,
  offset: DragPoint,
  velocity: DragPoint,
  locked: 'x' | 'y' | null,
  limits: DragLimits,
): DragPoint {
  const drag = normalizeDragTrigger(spec);
  const lock = drag.axis === 'x' ? 'x' : drag.axis === 'y' ? 'y' : drag.axis === 'both' ? locked : null;
  const filtered = {
    x: lock === 'y' ? 0 : velocity.x,
    y: lock === 'x' ? 0 : velocity.y,
  };
  const carried = drag.momentum ? momentumCarry(offset, filtered) : offset;
  const clamped = clampDragPoint(carried, limits);
  return clampDragPoint(nearestSnapPoint(clamped, drag.snap, drag.axis, locked), limits);
}

export function travelOnAxis(delta: DragPoint, direction: DragDirection): number {
  switch (direction) {
    case 'right': return Math.max(0, delta.x);
    case 'left': return Math.max(0, -delta.x);
    case 'down': return Math.max(0, delta.y);
    case 'up': return Math.max(0, -delta.y);
    default: return 0;
  }
}

/**
 * One winning threshold per target layer.
 * The direction the layer traveled farther wins. Staged thresholds on that
 * direction keep the furthest distance the drag has passed.
 */
export function dragVariantChoices(
  delta: DragPoint,
  actions: InteractionAction[] | undefined,
): DragVariantChoice[] {
  const best = new Map<string, { choice: DragVariantChoice; travel: number; distance: number; index: number }>();
  (actions ?? []).forEach((action, index) => {
    if (action.type !== 'set-variant' || !action.drag || !action.targetLayerId || !action.variantId) return;
    const travel = travelOnAxis(delta, action.drag.direction);
    if (travel < action.drag.distance) return;
    const current = best.get(action.targetLayerId);
    if (
      current
      && (
        travel < current.travel
        || (travel === current.travel && action.drag.distance < current.distance)
        || (travel === current.travel && action.drag.distance === current.distance && index < current.index)
      )
    ) {
      return;
    }
    best.set(action.targetLayerId, {
      choice: {
        targetLayerId: action.targetLayerId,
        variantId: action.variantId,
        release: action.drag.release,
        ...(action.transition ? { transition: action.transition } : {}),
      },
      travel,
      distance: action.drag.distance,
      index,
    });
  });
  return [...best.values()].map(item => item.choice);
}

/**
 * Actions that run because the drag started or ended.
 * A Set Variant with a direction threshold is not in this list; the gesture
 * applies that one from the distance instead.
 */
export function dragPhaseActions(
  interaction: LayerInteraction,
  phase: 'move' | 'end',
): InteractionAction[] {
  const drag = normalizeDragTrigger(interaction.drag);
  const wantsMove = drag.phase === 'move' || drag.phase === 'both';
  const wantsEnd = drag.phase === 'end' || drag.phase === 'both';
  if (phase === 'move' && !wantsMove) return [];
  if (phase === 'end' && !wantsEnd) return [];
  return (interaction.actions ?? []).filter((action) => {
    if (action.type === 'scroll-variant') return false;
    if (action.type === 'set-variant' && action.drag) return false;
    if (action.type === 'set-variant' && phase === 'end' && drag.phase === 'move') return false;
    return true;
  });
}

/** Set Variant actions that follow the drag without a direction threshold. */
export function plainDragVariantTargets(actions: InteractionAction[] | undefined): string[] {
  const ids: string[] = [];
  for (const action of actions ?? []) {
    if (action.type !== 'set-variant' || action.drag || !action.targetLayerId || !action.variantId) continue;
    ids.push(action.targetLayerId);
  }
  return ids;
}
