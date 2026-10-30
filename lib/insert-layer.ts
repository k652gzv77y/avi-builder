/**
 * Insert a layer into a tree at a click or canvas-drop position.
 *
 * Shared by the Assets panel, the element library, and canvas drop so a
 * component instance lands in the same place no matter which surface started
 * the insert.
 */

import type { Layer } from '@/types';
import { canHaveChildren, findLayerWithParent } from '@/lib/layer-utils';

export type InsertPosition = 'above' | 'below' | 'inside';

export interface InsertPlacement {
  targetLayerId: string;
  position: InsertPosition;
}

export interface InsertLayerResult {
  layers: Layer[];
  parentToExpand: string | null;
}

function replaceLayer(layers: Layer[], layerId: string, updater: (layer: Layer) => Layer): Layer[] {
  let changed = false;

  const next = layers.map((layer) => {
    if (layer.id === layerId) {
      changed = true;
      return updater(layer);
    }

    if (layer.children && layer.children.length > 0) {
      const children = replaceLayer(layer.children, layerId, updater);
      if (children !== layer.children) {
        changed = true;
        return { ...layer, children };
      }
    }

    return layer;
  });

  return changed ? next : layers;
}

function insertBeside(siblings: Layer[], siblingId: string, position: 'above' | 'below', layer: Layer): Layer[] | null {
  const index = siblings.findIndex((sibling) => sibling.id === siblingId);
  if (index === -1) return null;

  const at = position === 'above' ? index : index + 1;
  const next = siblings.slice();
  next.splice(at, 0, layer);
  return next;
}

/**
 * Where a click-to-insert should land relative to the selected layer.
 * Containers receive the layer as a child. Leaves receive it as the next sibling.
 */
export function resolveClickInsertTarget(layers: Layer[], targetLayerId: string): InsertPlacement {
  const found = findLayerWithParent(layers, targetLayerId);
  if (found && canHaveChildren(found.layer)) {
    return { targetLayerId, position: 'inside' };
  }

  return { targetLayerId, position: 'below' };
}

/**
 * Insert `layer` relative to a target. A missing target appends at the root,
 * which matches adding into an empty page or an unknown selection.
 */
export function insertLayerIntoTree(
  layers: Layer[],
  layer: Layer,
  placement: InsertPlacement,
): InsertLayerResult {
  const found = findLayerWithParent(layers, placement.targetLayerId);
  if (!found) {
    return { layers: [...layers, layer], parentToExpand: null };
  }

  let position = placement.position;
  if (position === 'inside' && !canHaveChildren(found.layer)) {
    position = 'below';
  }

  if (position === 'inside') {
    return {
      layers: replaceLayer(layers, found.layer.id, (node) => ({
        ...node,
        children: [...(node.children || []), layer],
      })),
      parentToExpand: found.layer.id,
    };
  }

  if (!found.parent) {
    const next = insertBeside(layers, found.layer.id, position, layer);
    return {
      layers: next ?? [...layers, layer],
      parentToExpand: null,
    };
  }

  const parentId = found.parent.id;
  const next = replaceLayer(layers, parentId, (parent) => {
    const children = insertBeside(parent.children || [], found.layer.id, position, layer);
    return { ...parent, children: children ?? [...(parent.children || []), layer] };
  });

  return { layers: next, parentToExpand: parentId };
}
