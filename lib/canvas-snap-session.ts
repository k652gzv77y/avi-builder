/**
 * The guides painted during a free-form drag or resize.
 * Geometry stays in canvas-freeform; this only publishes the latest result.
 */

import type { SnapGuide } from '@/lib/canvas-freeform';

let guides: SnapGuide[] = [];
let key = '';
const listeners = new Set<() => void>();

function fingerprint(next: SnapGuide[]): string {
  return next.map((guide) => {
    const at = Math.round(guide.at * 100) / 100;
    const targets = guide.targets
      .map((target) => `${target.role}:${target.name ?? ''}:${target.edge}`)
      .join(',');
    return `${guide.axis}@${at}:${targets}`;
  }).join('|');
}

export function setActiveSnapGuides(next: SnapGuide[]) {
  const nextKey = fingerprint(next);
  if (nextKey === key) return;
  key = nextKey;
  guides = next;
  listeners.forEach((listener) => listener());
}

export function getActiveSnapGuides(): SnapGuide[] {
  return guides;
}

export function subscribeActiveSnapGuides(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
