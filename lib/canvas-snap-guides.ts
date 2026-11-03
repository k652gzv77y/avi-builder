/**
 * Labels for the guides a drag or resize is currently snapped to.
 * Built from SnapGuide, which snapTranslation and snapResizedBox already return.
 */

import type { SnapGuide, SnapGuideTarget } from '@/lib/canvas-freeform';

const EDGE_LABEL: Record<SnapGuideTarget['edge'], string> = {
  left: 'left',
  right: 'right',
  top: 'top',
  bottom: 'bottom',
  center: 'center',
};

export interface ActiveGuideEntry {
  id: string;
  axis: 'x' | 'y';
  at: number;
  label: string;
}

export function guideTargetLabel(target: SnapGuideTarget): string {
  const edge = EDGE_LABEL[target.edge];
  const name = target.name?.trim();
  if (target.role === 'parent' && !name) return `Parent ${edge}`;
  if (name) return `${name} ${edge}`;
  return target.role === 'parent' ? `Parent ${edge}` : `Sibling ${edge}`;
}

/** One row per target. Vertical lines first, then top to bottom. */
export function activeGuideEntries(guides: SnapGuide[]): ActiveGuideEntry[] {
  const ordered = [...guides].sort((a, b) => {
    if (a.axis !== b.axis) return a.axis === 'x' ? -1 : 1;
    return a.at - b.at;
  });
  const entries: ActiveGuideEntry[] = [];
  ordered.forEach((guide, guideIndex) => {
    guide.targets.forEach((target, targetIndex) => {
      entries.push({
        id: `${guide.axis}:${guideIndex}:${target.role}:${target.name ?? ''}:${target.edge}:${targetIndex}`,
        axis: guide.axis,
        at: guide.at,
        label: guideTargetLabel(target),
      });
    });
  });
  return entries;
}
