/**
 * DOM half of free-form canvas editing.
 *
 * Measurements stay in the iframe's CSS pixels. Callers divide screen deltas
 * by `getIframeScale` before passing them to the pure geometry helpers, which
 * keeps zoom and Safari's transformed iframe in the same space as offsetLeft.
 */

import type { Layer } from '@/types';
import {
  collectSnapLines,
  type FreeformBox,
  type SnapGuide,
  type SnapTargets,
} from '@/lib/canvas-freeform';

const PREVIEW_PROPS = ['transform', 'left', 'top', 'right', 'bottom', 'width', 'height', 'position'] as const;
const GUIDE_ATTR = 'data-canvas-snap-guides';
const releaseTokens = new WeakMap<HTMLElement, number>();

export function readFreeformBox(el: HTMLElement): FreeformBox {
  const view = el.ownerDocument.defaultView;
  const position = view?.getComputedStyle(el).position;
  const parent = el.offsetParent as HTMLElement | null;
  if (position === 'fixed' || !parent) {
    const rect = el.getBoundingClientRect();
    const root = el.ownerDocument.documentElement;
    return {
      left: rect.left,
      top: rect.top,
      width: el.offsetWidth || rect.width,
      height: el.offsetHeight || rect.height,
      parentWidth: root.clientWidth,
      parentHeight: root.clientHeight,
    };
  }

  return {
    left: el.offsetLeft,
    top: el.offsetTop,
    width: el.offsetWidth,
    height: el.offsetHeight,
    parentWidth: parent.clientWidth,
    parentHeight: parent.clientHeight,
  };
}

export function measureCanvasLayer(layerId: string): FreeformBox | null {
  if (typeof document === 'undefined') return null;
  const iframe = document.querySelector('iframe[title="Canvas Editor"]') as HTMLIFrameElement | null;
  const doc = iframe?.contentDocument;
  if (!doc) return null;
  const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(layerId)
    : layerId.replace(/"/g, '\\"');
  const el = doc.querySelector(`[data-layer-id="${escaped}"]`) as HTMLElement | null;
  if (!el) return null;
  return readFreeformBox(el);
}

export function siblingSnapTargets(el: HTMLElement): SnapTargets {
  const box = readFreeformBox(el);
  const parent = (el.offsetParent as HTMLElement | null) ?? el.ownerDocument.body;
  const siblings: Array<Pick<FreeformBox, 'left' | 'top' | 'width' | 'height'>> = [];
  const nodes = parent.querySelectorAll('[data-layer-id]');
  nodes.forEach((node) => {
    const candidate = node as HTMLElement;
    if (candidate === el || el.contains(candidate) || candidate.contains(el)) return;
    if (candidate.offsetParent !== el.offsetParent) return;
    const measured = readFreeformBox(candidate);
    siblings.push(measured);
  });
  return collectSnapLines(siblings, box.parentWidth, box.parentHeight);
}

export function translateFreeform(el: HTMLElement, dx: number, dy: number) {
  el.dataset.freeformGesture = '1';
  el.style.transform = `translate(${dx}px, ${dy}px)`;
}

export function previewFreeformBox(el: HTMLElement, box: FreeformBox, position: 'absolute' | 'fixed') {
  el.dataset.freeformGesture = '1';
  el.style.position = position;
  el.style.left = `${box.left}px`;
  el.style.top = `${box.top}px`;
  el.style.width = `${box.width}px`;
  el.style.height = `${box.height}px`;
  el.style.right = 'auto';
  el.style.bottom = 'auto';
  el.style.transform = '';
}

export function holdFreeformCommit(el: HTMLElement, updates: Partial<Layer>) {
  const pos = updates.design?.positioning;
  const sizing = updates.design?.sizing;
  el.dataset.freeformGesture = '1';
  if (pos?.position) el.style.position = pos.position;
  if (pos?.left) el.style.left = toCss(pos.left);
  if (pos?.right) el.style.right = toCss(pos.right);
  if (pos?.top) el.style.top = toCss(pos.top);
  if (pos?.bottom) el.style.bottom = toCss(pos.bottom);
  if (pos?.left && !pos.right) el.style.right = 'auto';
  if (pos?.right && !pos.left) el.style.left = 'auto';
  if (pos?.top && !pos.bottom) el.style.bottom = 'auto';
  if (pos?.bottom && !pos.top) el.style.top = 'auto';
  if (sizing?.width) el.style.width = toCss(sizing.width);
  if (sizing?.height) el.style.height = toCss(sizing.height);
  el.style.transform = '';
}

export function releaseFreeformPreview(el: HTMLElement) {
  delete el.dataset.freeformGesture;
  for (const prop of PREVIEW_PROPS) {
    el.style[prop] = '';
  }
}

export function cancelFreeformPreview(el: HTMLElement) {
  releaseTokens.set(el, (releaseTokens.get(el) ?? 0) + 1);
  clearSnapGuides(el);
  releaseFreeformPreview(el);
}

/** Drop the inline preview after React has painted the committed classes. */
export function scheduleFreeformRelease(el: HTMLElement) {
  delete el.dataset.freeformGesture;
  const token = (releaseTokens.get(el) ?? 0) + 1;
  releaseTokens.set(el, token);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (releaseTokens.get(el) !== token) return;
      if (el.dataset.freeformGesture) return;
      releaseFreeformPreview(el);
    });
  });
}

export function paintSnapGuides(el: HTMLElement, guides: SnapGuide[]) {
  if (guides.length === 0) {
    clearSnapGuides(el);
    return;
  }
  const parent = (el.offsetParent as HTMLElement | null) ?? el.ownerDocument.body;
  let host = parent.querySelector(`:scope > [${GUIDE_ATTR}]`) as HTMLElement | null;
  if (!host) {
    host = el.ownerDocument.createElement('div');
    host.setAttribute(GUIDE_ATTR, 'true');
    host.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2147483646;';
    parent.appendChild(host);
  }
  const lines = guides.map((guide) => {
    const line = el.ownerDocument.createElement('div');
    line.style.cssText = guide.axis === 'x'
      ? `position:absolute;top:0;bottom:0;width:1px;background:#ff2bd6;left:${guide.at}px;pointer-events:none;`
      : `position:absolute;left:0;right:0;height:1px;background:#ff2bd6;top:${guide.at}px;pointer-events:none;`;
    return line;
  });
  host.replaceChildren(...lines);
}

export function clearSnapGuides(el: HTMLElement | null) {
  if (!el) return;
  const parent = (el.offsetParent as HTMLElement | null) ?? el.ownerDocument.body;
  parent.querySelector(`:scope > [${GUIDE_ATTR}]`)?.remove();
}

function toCss(value: string): string {
  return /^-?\d+(\.\d+)?$/.test(value) ? `${value}px` : value;
}
