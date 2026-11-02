/**
 * Create a Fixed or Relative overlay and open it from a Tap interaction.
 * Dismiss (Escape, outside click, return focus) lives on the overlay layer
 * and is copied onto every Open Overlay action that targets it.
 */

import { insertSiblingAfter } from '@/lib/cms-framer';
import {
  DEFAULT_OVERLAY_DISMISS,
  OVERLAY_DISMISS_ROWS,
  createOverlayAction,
} from '@/lib/interactions-framer';
import type {
  Layer,
  LayerInteraction,
  LayerOverlay,
  OverlayDismiss,
  OverlayPlacement,
} from '@/types';

export { OVERLAY_DISMISS_ROWS };

export function overlayDismissSummary(dismiss: OverlayDismiss): string {
  const labels = OVERLAY_DISMISS_ROWS.filter(row => dismiss[row.key]).map(row => row.label);
  return labels.length > 0 ? labels.join(', ') : 'Stays open';
}

export function createOverlayLayer(id: string, placement: OverlayPlacement = 'fixed'): Layer {
  const fixed = placement === 'fixed';
  const padding = fixed ? '24px' : '12px';
  return {
    id,
    name: 'div',
    customName: fixed ? 'Fixed overlay' : 'Relative overlay',
    classes: fixed
      ? ['relative', 'flex', 'flex-col', 'gap-[12px]', 'w-[320px]', 'min-h-[180px]', 'bg-white', 'rounded-[12px]', 'p-[24px]']
      : ['relative', 'flex', 'flex-col', 'gap-[8px]', 'w-[240px]', 'bg-white', 'rounded-[8px]', 'p-[12px]'],
    overlay: {
      placement,
      dismiss: { ...DEFAULT_OVERLAY_DISMISS },
    },
    design: {
      positioning: { isActive: true, position: 'relative' },
      layout: {
        isActive: true,
        display: 'Flex',
        flexDirection: 'column',
        gap: fixed ? '12px' : '8px',
      },
      sizing: {
        isActive: true,
        width: fixed ? '320px' : '240px',
        ...(fixed ? { minHeight: '180px' } : {}),
      },
      spacing: {
        isActive: true,
        paddingTop: padding,
        paddingRight: padding,
        paddingBottom: padding,
        paddingLeft: padding,
      },
      backgrounds: { isActive: true, backgroundColor: '#ffffff' },
    },
    children: [],
  };
}

function freshClick(interactionId: string): LayerInteraction {
  return {
    id: interactionId,
    trigger: 'click',
    timeline: {
      breakpoints: ['desktop', 'tablet', 'mobile'],
      repeat: 0,
      yoyo: false,
    },
    tweens: [],
    actions: [],
  };
}

/** Add an Open Overlay action on Tap. An existing Tap event keeps its other actions. */
export function withOpenOverlay(
  layer: Layer,
  overlayId: string,
  overlay: LayerOverlay,
  ids: { interactionId: string; actionId: string },
): Layer {
  const interactions = [...(layer.interactions ?? [])];
  const clickIndex = interactions.findIndex(item => item.trigger === 'click');
  const action = createOverlayAction(ids.actionId, 'open', overlayId, overlay.placement);
  action.dismiss = { ...overlay.dismiss };

  if (clickIndex === -1) {
    const created = freshClick(ids.interactionId);
    created.actions = [action];
    interactions.push(created);
    return { ...layer, interactions };
  }

  const current = interactions[clickIndex];
  const actions = current.actions ?? [];
  const already = actions.some(item => (
    item.type === 'overlay' && item.operation === 'open' && item.targetLayerId === overlayId
  ));
  if (already) return layer;

  interactions[clickIndex] = { ...current, actions: [...actions, action] };
  return { ...layer, interactions };
}

function mapLayer(layers: Layer[], layerId: string, updater: (layer: Layer) => Layer): Layer[] {
  return layers.map(layer => {
    if (layer.id === layerId) return updater(layer);
    if (!layer.children?.length) return layer;
    const children = mapLayer(layer.children, layerId, updater);
    if (children === layer.children) return layer;
    return { ...layer, children };
  });
}

/**
 * Insert the overlay after the trigger and add Tap → Open Overlay.
 * Returns null when the trigger is not in the tree.
 */
export function applyOverlaySetup(
  layers: Layer[],
  triggerId: string,
  overlay: Layer,
  ids: { interactionId: string; actionId: string },
): Layer[] | null {
  if (!overlay.overlay) return null;
  const inserted = insertSiblingAfter(layers, triggerId, overlay);
  if (!inserted) return null;
  return mapLayer(inserted, triggerId, layer => withOpenOverlay(layer, overlay.id, overlay.overlay!, ids));
}

function layerHasOverlay(layers: Layer[], overlayId: string): boolean {
  const walk = (list: Layer[]): boolean => {
    for (const layer of list) {
      if (layer.id === overlayId) return !!layer.overlay;
      if (layer.children?.length && walk(layer.children)) return true;
    }
    return false;
  };
  return walk(layers);
}

/** Write placement and dismiss onto the overlay and every action that opens it. */
export function syncOverlaySettings(
  layers: Layer[],
  overlayId: string,
  overlay: LayerOverlay,
): Layer[] {
  if (!layerHasOverlay(layers, overlayId)) return layers;
  const nextOverlay: LayerOverlay = {
    placement: overlay.placement,
    dismiss: { ...overlay.dismiss },
  };

  const walk = (list: Layer[]): Layer[] => list.map(layer => {
    let next = layer;
    if (layer.id === overlayId && layer.overlay) {
      next = { ...layer, overlay: nextOverlay };
    }
    if (next.interactions?.length) {
      let changed = false;
      const interactions = next.interactions.map(interaction => {
        if (!interaction.actions?.length) return interaction;
        let actionsChanged = false;
        const actions = interaction.actions.map(action => {
          if (action.type !== 'overlay' || action.operation !== 'open' || action.targetLayerId !== overlayId) {
            return action;
          }
          actionsChanged = true;
          return { ...action, placement: nextOverlay.placement, dismiss: { ...nextOverlay.dismiss } };
        });
        if (!actionsChanged) return interaction;
        changed = true;
        return { ...interaction, actions };
      });
      if (changed) next = { ...next, interactions };
    }
    if (layer.children?.length) {
      const children = walk(layer.children);
      if (children !== layer.children) next = next === layer ? { ...layer, children } : { ...next, children };
    }
    return next;
  });

  return walk(layers);
}

/** Replace one interaction, then copy Open Overlay edits onto the overlay layer. */
export function applyInteractionChange(
  layers: Layer[],
  layerId: string,
  interaction: LayerInteraction,
): Layer[] {
  const replaced = mapLayer(layers, layerId, layer => ({
    ...layer,
    interactions: (layer.interactions ?? []).some(item => item.id === interaction.id)
      ? (layer.interactions ?? []).map(item => (item.id === interaction.id ? interaction : item))
      : [...(layer.interactions ?? []), interaction],
  }));

  let next = replaced;
  for (const action of interaction.actions ?? []) {
    if (action.type !== 'overlay' || action.operation !== 'open' || !action.targetLayerId) continue;
    next = syncOverlaySettings(next, action.targetLayerId, {
      placement: action.placement,
      dismiss: action.dismiss,
    });
  }
  return next;
}

/** Hide an overlay on the canvas unless the author is editing that layer. */
export function overlayCanvasHidden(hasOverlay: boolean, editing: boolean, selected: boolean): boolean {
  if (!hasOverlay) return false;
  if (!editing) return true;
  return !selected;
}
