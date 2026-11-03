/**
 * Align and distribute free-form layers, and marquee hit-testing.
 * Stack children are filtered out by the caller; this math only moves boxes.
 */

import type { Layer } from '@/types';
import { findLayerById } from '@/lib/layer-utils';
import { applyFreeformBox, type FreeformBox } from '@/lib/canvas-freeform';

export interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface AlignBox extends SelectionRect {
  id: string;
}

export type AlignEdge = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

export interface MeasuredFreeformBox extends FreeformBox {
  id: string;
}

export function normalizeRect(x1: number, y1: number, x2: number, y2: number): SelectionRect {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

export function rectsIntersect(a: SelectionRect, b: SelectionRect): boolean {
  return a.left < b.left + b.width
    && a.left + a.width > b.left
    && a.top < b.top + b.height
    && a.top + a.height > b.top;
}

/** Prefer the outermost hit so a marquee over a frame does not also grab its children. */
export function outermostIntersectingIds(
  items: Array<{ id: string; parentId: string | null; box: SelectionRect }>,
  marquee: SelectionRect,
): string[] {
  const hits = items.filter((item) => item.id !== 'body' && rectsIntersect(item.box, marquee));
  const hitIds = new Set(hits.map((item) => item.id));
  const byId = new Map(items.map((item) => [item.id, item]));
  return hits.filter((item) => {
    let parentId = item.parentId;
    while (parentId) {
      if (hitIds.has(parentId)) return false;
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return true;
  }).map((item) => item.id);
}

export function alignBoxes(boxes: AlignBox[], edge: AlignEdge): AlignBox[] {
  if (boxes.length === 0) return [];
  const minLeft = Math.min(...boxes.map((box) => box.left));
  const minTop = Math.min(...boxes.map((box) => box.top));
  const maxRight = Math.max(...boxes.map((box) => box.left + box.width));
  const maxBottom = Math.max(...boxes.map((box) => box.top + box.height));
  const centerX = minLeft + (maxRight - minLeft) / 2;
  const centerY = minTop + (maxBottom - minTop) / 2;

  return boxes.map((box) => {
    if (edge === 'left') return { ...box, left: minLeft };
    if (edge === 'center') return { ...box, left: centerX - box.width / 2 };
    if (edge === 'right') return { ...box, left: maxRight - box.width };
    if (edge === 'top') return { ...box, top: minTop };
    if (edge === 'middle') return { ...box, top: centerY - box.height / 2 };
    return { ...box, top: maxBottom - box.height };
  });
}

/**
 * Equal gaps between items. The first and last stay put.
 * Two items have no interior gap to distribute.
 */
export function distributeBoxes(boxes: AlignBox[], axis: DistributeAxis): AlignBox[] {
  if (boxes.length < 3) return boxes.map((box) => ({ ...box }));
  const horizontal = axis === 'horizontal';
  const sorted = [...boxes].sort((a, b) => (horizontal ? a.left - b.left : a.top - b.top));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = horizontal
    ? (last.left + last.width) - first.left
    : (last.top + last.height) - first.top;
  const totalSize = sorted.reduce((sum, box) => sum + (horizontal ? box.width : box.height), 0);
  const gap = (span - totalSize) / (sorted.length - 1);
  let cursor = horizontal ? first.left : first.top;
  const placed = new Map<string, AlignBox>();
  for (const box of sorted) {
    placed.set(box.id, horizontal ? { ...box, left: cursor } : { ...box, top: cursor });
    cursor += (horizontal ? box.width : box.height) + gap;
  }
  return boxes.map((box) => placed.get(box.id) ?? box);
}

export function alignLayerTree(
  layers: Layer[],
  measured: MeasuredFreeformBox[],
  action: { type: 'align'; edge: AlignEdge } | { type: 'distribute'; axis: DistributeAxis },
): Layer[] {
  if (measured.length < 2) return layers;
  if (action.type === 'distribute' && measured.length < 3) return layers;

  const moved = action.type === 'align'
    ? alignBoxes(measured, action.edge)
    : distributeBoxes(measured, action.axis);
  const nextById = new Map(moved.map((box) => [box.id, box]));
  const partials = new Map<string, Partial<Layer>>();

  for (const box of measured) {
    const next = nextById.get(box.id);
    const layer = findLayerById(layers, box.id);
    if (!next || !layer) continue;
    if (next.left === box.left && next.top === box.top) continue;
    partials.set(box.id, applyFreeformBox(layer, { ...box, left: next.left, top: next.top }, 'move'));
  }

  if (partials.size === 0) return layers;
  return applyPartials(layers, partials);
}

function applyPartials(layers: Layer[], partials: Map<string, Partial<Layer>>): Layer[] {
  return layers.map((layer) => {
    const partial = partials.get(layer.id);
    const children = layer.children?.length ? applyPartials(layer.children, partials) : layer.children;
    if (!partial && children === layer.children) return layer;
    return {
      ...layer,
      ...partial,
      ...(children !== layer.children ? { children } : {}),
    };
  });
}
