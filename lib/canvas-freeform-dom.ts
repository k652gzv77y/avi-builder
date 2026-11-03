/**
 * DOM half of free-form canvas editing.
 *
 * Measurements stay in the iframe's CSS pixels. Callers divide screen deltas
 * by `getIframeScale` before passing them to the pure geometry helpers, which
 * keeps zoom and Safari's transformed iframe in the same space as offsetLeft.
 *
 * Alignment guides are `position: fixed` on the iframe document element.
 * A line inside the positioned parent is clipped by overflow and removed
 * the next time React reconciles that parent.
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

function usesViewportSpace(el: HTMLElement): boolean {
  const view = el.ownerDocument.defaultView;
  const position = view?.getComputedStyle(el).position;
  return position === 'fixed' || !el.offsetParent;
}

function paddingOrigin(space: HTMLElement): { x: number; y: number } {
  const rect = space.getBoundingClientRect();
  const style = space.ownerDocument.defaultView?.getComputedStyle(space);
  const borderLeft = Number.parseFloat(style?.borderLeftWidth || '0') || 0;
  const borderTop = Number.parseFloat(style?.borderTopWidth || '0') || 0;
  return { x: rect.left + borderLeft, y: rect.top + borderTop };
}

type SnapBox = Pick<FreeformBox, 'left' | 'top' | 'width' | 'height'>;

/**
 * `offsetLeft` only matches between elements that share an offsetParent.
 * Relative siblings of an absolute layer do not, so fall back to the
 * visual rect translated into the dragged layer's snap space.
 */
function measureInSnapSpace(candidate: HTMLElement, dragged: HTMLElement): SnapBox | null {
  if (usesViewportSpace(dragged)) {
    const rect = candidate.getBoundingClientRect();
    if (rect.width < 1 && rect.height < 1) return null;
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }

  const space = dragged.offsetParent as HTMLElement;
  if (candidate.offsetParent === space) {
    if (candidate.offsetWidth < 1 && candidate.offsetHeight < 1) return null;
    return {
      left: candidate.offsetLeft,
      top: candidate.offsetTop,
      width: candidate.offsetWidth,
      height: candidate.offsetHeight,
    };
  }

  const origin = paddingOrigin(space);
  const rect = candidate.getBoundingClientRect();
  if (rect.width < 1 && rect.height < 1) return null;
  return {
    left: rect.left - origin.x,
    top: rect.top - origin.y,
    width: rect.width,
    height: rect.height,
  };
}

function layerParentElement(el: HTMLElement): HTMLElement | null {
  const parent = el.parentElement?.closest('[data-layer-id]');
  if (!parent || parent === el) return null;
  return parent as HTMLElement;
}

function directLayerSiblings(el: HTMLElement): HTMLElement[] {
  const parentLayer = layerParentElement(el);
  const root: ParentNode = parentLayer ?? el.ownerDocument.body;
  const siblings: HTMLElement[] = [];
  root.querySelectorAll('[data-layer-id]').forEach((node) => {
    const candidate = node as HTMLElement;
    if (candidate === el || candidate.contains(el) || el.contains(candidate)) return;
    const owner = candidate.parentElement?.closest('[data-layer-id]') ?? null;
    if (owner !== parentLayer) return;
    siblings.push(candidate);
  });
  return siblings;
}

export function siblingSnapTargets(el: HTMLElement): SnapTargets {
  const box = readFreeformBox(el);
  const space = usesViewportSpace(el) ? null : (el.offsetParent as HTMLElement | null);
  const samples: SnapBox[] = [];
  for (const sibling of directLayerSiblings(el)) {
    const measured = measureInSnapSpace(sibling, el);
    if (measured) samples.push(measured);
  }

  // The containing block's edges are added by collectSnapLines. When the
  // layer parent is a different box (a static stack inside a positioned
  // ancestor, or a fixed layer's card), snap to that box too.
  const parentLayer = layerParentElement(el);
  if (
    parentLayer
    && parentLayer !== space
    && parentLayer.getAttribute('data-layer-id') !== 'body'
  ) {
    const measured = measureInSnapSpace(parentLayer, el);
    if (measured) samples.push(measured);
  }

  return collectSnapLines(samples, box.parentWidth, box.parentHeight);
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
  clearSnapGuides(el);
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

const GUIDE_COLOR = '#ff2bd6';

function guideStyle(el: HTMLElement, guide: SnapGuide): string {
  const root = el.ownerDocument.documentElement;
  if (usesViewportSpace(el)) {
    return guide.axis === 'x'
      ? `position:fixed;left:${guide.at}px;top:0;width:1px;height:${root.clientHeight}px;background:${GUIDE_COLOR};pointer-events:none;`
      : `position:fixed;top:${guide.at}px;left:0;height:1px;width:${root.clientWidth}px;background:${GUIDE_COLOR};pointer-events:none;`;
  }

  const space = el.offsetParent as HTMLElement;
  const origin = paddingOrigin(space);
  if (guide.axis === 'x') {
    return `position:fixed;left:${origin.x + guide.at}px;top:${origin.y}px;width:1px;height:${space.clientHeight}px;background:${GUIDE_COLOR};pointer-events:none;`;
  }
  return `position:fixed;top:${origin.y + guide.at}px;left:${origin.x}px;height:1px;width:${space.clientWidth}px;background:${GUIDE_COLOR};pointer-events:none;`;
}

export function paintSnapGuides(el: HTMLElement, guides: SnapGuide[]) {
  const doc = el.ownerDocument;
  if (guides.length === 0) {
    clearSnapGuides(el);
    return;
  }
  let host = doc.documentElement.querySelector(`:scope > [${GUIDE_ATTR}]`) as HTMLElement | null;
  if (!host) {
    host = doc.createElement('div');
    host.setAttribute(GUIDE_ATTR, 'true');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646;overflow:visible;';
    doc.documentElement.appendChild(host);
  }
  const lines = guides.map((guide) => {
    const line = doc.createElement('div');
    line.style.cssText = guideStyle(el, guide);
    return line;
  });
  host.replaceChildren(...lines);
}

export function clearSnapGuides(el: HTMLElement | null) {
  const doc = el?.ownerDocument;
  if (doc) {
    doc.documentElement.querySelector(`:scope > [${GUIDE_ATTR}]`)?.remove();
  }
  if (!el) return;
  const parent = (el.offsetParent as HTMLElement | null) ?? el.ownerDocument.body;
  parent?.querySelector?.(`:scope > [${GUIDE_ATTR}]`)?.remove();
}

function toCss(value: string): string {
  return /^-?\d+(\.\d+)?$/.test(value) ? `${value}px` : value;
}
