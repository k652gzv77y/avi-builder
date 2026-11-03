/**
 * Plays a MotionSpec on elements.
 * Variant changes crossfade a snapshot of the previous tree. Overlays fade
 * the layer itself. Direct children can wait an extra stagger after the root.
 * The design canvas does not call this; selection still owns that pointer.
 */

import type { MotionSpec } from '@/lib/action-transition';

interface MotionHandle {
  cancel: () => void;
  onfinish: (() => void) | null;
  oncancel: (() => void) | null;
}

function prefersReducedMotion(view: Window | null | undefined): boolean {
  if (!view || typeof view.matchMedia !== 'function') return false;
  return view.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === 1 && typeof (node as HTMLElement).animate === 'function';
}

/**
 * Fade `element` from `from` to `to`. The Web Animations fill is released
 * when the motion ends so authored opacity classes take over again.
 * Returns a cancel function. Calls `onDone` only when the motion finishes.
 */
export function playMotion(
  element: HTMLElement,
  from: number,
  to: number,
  spec: MotionSpec,
  onDone?: () => void,
): () => void {
  if (typeof element.animate !== 'function' || spec.durationMs <= 0 || from === to) {
    onDone?.();
    return () => {};
  }

  const frames: Keyframe[] = spec.keyframes
    ? spec.keyframes.map(frame => ({
      opacity: from + (to - from) * frame.value,
      offset: frame.offset,
    }))
    : [
      { opacity: from, offset: 0 },
      { opacity: to, offset: 1 },
    ];

  let animation: MotionHandle;
  try {
    animation = element.animate(frames, {
      duration: spec.durationMs,
      delay: spec.delayMs,
      easing: spec.keyframes ? 'linear' : spec.easing,
      fill: 'both',
    }) as unknown as MotionHandle;
  } catch {
    onDone?.();
    return () => {};
  }

  let settled = false;
  const release = () => {
    try {
      animation.cancel();
    } catch {
      // The element may already be gone.
    }
  };
  const finish = () => {
    if (settled) return;
    settled = true;
    onDone?.();
    release();
  };
  animation.onfinish = finish;
  animation.oncancel = () => {
    settled = true;
  };
  return () => {
    if (settled) return;
    settled = true;
    animation.onfinish = null;
    animation.oncancel = null;
    release();
  };
}

function stripLayerIds(root: HTMLElement): void {
  root.removeAttribute('data-layer-id');
  root.querySelectorAll('[data-layer-id]').forEach(node => {
    node.removeAttribute('data-layer-id');
  });
}

/** Detached copy of the tree that is on screen, measured so the ghost can sit on it. */
export function captureVariantSnapshot(element: HTMLElement): HTMLElement | null {
  if (typeof element.cloneNode !== 'function') return null;
  const clone = element.cloneNode(true) as HTMLElement;
  stripLayerIds(clone);
  const rect = element.getBoundingClientRect();
  clone.dataset.transitionWidth = String(rect.width);
  clone.dataset.transitionHeight = String(rect.height);
  return clone;
}

function placeGhost(ghost: HTMLElement, live: HTMLElement): boolean {
  const width = Number(ghost.dataset.transitionWidth);
  const height = Number(ghost.dataset.transitionHeight);
  if (!(width > 0) || !(height > 0)) return false;
  const rect = live.getBoundingClientRect();
  const body = live.ownerDocument.body;
  if (!body) return false;
  ghost.setAttribute('data-transition-outgoing', 'true');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute('inert', '');
  ghost.style.position = 'fixed';
  ghost.style.top = `${rect.top}px`;
  ghost.style.left = `${rect.left}px`;
  ghost.style.width = `${width}px`;
  ghost.style.height = `${height}px`;
  ghost.style.margin = '0';
  ghost.style.transform = 'none';
  ghost.style.translate = 'none';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '30';
  ghost.style.overflow = 'hidden';
  body.appendChild(ghost);
  return true;
}

function staggerChildren(element: HTMLElement, spec: MotionSpec, stops: Array<() => void>): void {
  if (spec.staggerMs <= 0) return;
  Array.from(element.children).forEach((child, index) => {
    if (!isElement(child)) return;
    const delayed: MotionSpec = {
      ...spec,
      delayMs: spec.delayMs + (index + 1) * spec.staggerMs,
      staggerMs: 0,
    };
    stops.push(playMotion(child, 0, 1, delayed));
  });
}

/**
 * Crossfade `live` in over a snapshot of the tree it replaced.
 * Direct children of the incoming tree wait `stagger` after the root.
 */
export function playVariantCrossfade(
  live: HTMLElement,
  previous: HTMLElement,
  spec: MotionSpec,
): () => void {
  const view = live.ownerDocument.defaultView;
  if (prefersReducedMotion(view)) return () => {};

  const stops: Array<() => void> = [];
  const ghostPlaced = placeGhost(previous, live);
  if (ghostPlaced) {
    const remove = () => {
      previous.remove();
    };
    stops.push(playMotion(previous, 1, 0, spec, remove));
  } else {
    previous.remove();
  }
  stops.push(playMotion(live, 0, 1, spec));
  staggerChildren(live, spec, stops);
  return () => {
    stops.forEach(stop => stop());
    previous.remove();
  };
}

/** Fade an overlay (and its backdrop) in, staggering the overlay's direct children. */
export function playOverlayEnter(
  overlay: HTMLElement,
  backdrop: HTMLElement | null,
  spec: MotionSpec,
): () => void {
  const view = overlay.ownerDocument.defaultView;
  if (prefersReducedMotion(view)) return () => {};
  const stops: Array<() => void> = [];
  stops.push(playMotion(overlay, 0, 1, spec));
  if (backdrop && typeof backdrop.animate === 'function') {
    stops.push(playMotion(backdrop, 0, 1, spec));
  }
  staggerChildren(overlay, spec, stops);
  return () => {
    stops.forEach(stop => stop());
  };
}

/** Fade an overlay out, then run `onDone` so the caller can remove it. */
export function playOverlayExit(
  overlay: HTMLElement,
  backdrop: HTMLElement | null,
  spec: MotionSpec,
  fromOverlay: number,
  fromBackdrop: number,
  onDone: () => void,
): () => void {
  const view = overlay.ownerDocument.defaultView;
  if (prefersReducedMotion(view)) {
    onDone();
    return () => {};
  }
  let pending = 1;
  const stops: Array<() => void> = [];
  const done = () => {
    pending -= 1;
    if (pending > 0) return;
    onDone();
  };
  stops.push(playMotion(overlay, fromOverlay, 0, spec, done));
  if (backdrop && typeof backdrop.animate === 'function') {
    pending += 1;
    stops.push(playMotion(backdrop, fromBackdrop, 0, spec, done));
  }
  return () => {
    stops.forEach(stop => stop());
  };
}

export function currentOpacity(element: HTMLElement): number {
  const view = element.ownerDocument?.defaultView;
  if (!view || typeof view.getComputedStyle !== 'function') return 1;
  const raw = view.getComputedStyle(element).opacity;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}
