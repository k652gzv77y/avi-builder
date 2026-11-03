/**
 * Create an overlay layer and open it from a Tap interaction.
 * Kind, anchor, and dismiss live on the overlay layer and are copied onto
 * every Open Overlay action that targets it.
 */

import { insertSiblingAfter } from '@/lib/cms-framer';
import {
  OVERLAY_DISMISS_ROWS,
  createOverlayAction,
} from '@/lib/interactions-framer';
import {
  defaultDismissForKind,
  overlayKindLabel,
  placementForKind,
  resolveOverlayKind,
} from '@/lib/overlay-position';
import { getTiptapTextContent } from '@/lib/text-format-utils';
import type {
  Layer,
  LayerInteraction,
  LayerOverlay,
  OverlayDismiss,
  OverlayKind,
  OverlayPlacement,
} from '@/types';

export { OVERLAY_DISMISS_ROWS };

export function overlayDismissSummary(dismiss: OverlayDismiss): string {
  const labels = OVERLAY_DISMISS_ROWS.filter(row => dismiss[row.key]).map(row => row.label);
  return labels.length > 0 ? labels.join(', ') : 'Stays open';
}

function readOverlayRequest(
  value: OverlayPlacement | OverlayKind,
): { placement: OverlayPlacement; kind: OverlayKind } {
  if (value === 'fixed') return { placement: 'fixed', kind: 'modal' };
  if (value === 'relative') return { placement: 'relative', kind: 'popover' };
  return { placement: placementForKind(value), kind: value };
}

const MENU_ITEM_LABELS = ['Edit', 'Duplicate', 'Delete'] as const;

/** One row in a menu. Child layers of a menu overlay are the items. */
export function createMenuItemLayer(id: string, label: string): Layer {
  return {
    id,
    name: 'button',
    customName: label,
    classes: [
      'flex',
      'w-[100%]',
      'items-center',
      'justify-start',
      'rounded-[6px]',
      'bg-transparent',
      'px-[10px]',
      'py-[8px]',
      'text-left',
      'text-[13px]',
      'text-[#171717]',
      'hover:bg-[#f4f4f5]',
    ],
    attributes: { type: 'button', role: 'menuitem' },
    design: {
      layout: {
        isActive: true,
        display: 'Flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
      },
      sizing: { isActive: true, width: '100%' },
      spacing: {
        isActive: true,
        paddingTop: '8px',
        paddingRight: '10px',
        paddingBottom: '8px',
        paddingLeft: '10px',
      },
      typography: { isActive: true, fontSize: '13px', color: '#171717' },
      backgrounds: { isActive: true, backgroundColor: 'transparent' },
    },
    children: [{
      id: `${id}-label`,
      name: 'text',
      customName: 'Label',
      classes: [],
      settings: { tag: 'span' },
      restrictions: { editText: true },
      variables: {
        text: {
          type: 'dynamic_rich_text',
          data: { content: getTiptapTextContent(label) },
        },
      },
    }],
  };
}

export function createOverlayLayer(
  id: string,
  placementOrKind: OverlayPlacement | OverlayKind = 'modal',
): Layer {
  const { placement, kind } = readOverlayRequest(placementOrKind);
  const width = kind === 'tooltip' ? '180px' : kind === 'sheet' ? '100%' : kind === 'menu' ? '220px' : kind === 'modal' ? '320px' : '240px';
  const padding = kind === 'tooltip' ? '8px' : kind === 'menu' ? '4px' : kind === 'modal' || kind === 'sheet' ? '24px' : '12px';
  const gap = kind === 'tooltip' ? '4px' : kind === 'menu' ? '2px' : '12px';
  const minHeight = kind === 'modal' ? '180px' : kind === 'sheet' ? '160px' : undefined;
  const maxHeight = kind === 'sheet' ? '85vh' : kind === 'menu' ? '70vh' : undefined;
  const anchored = placement === 'relative';
  const radius = kind === 'sheet'
    ? ['rounded-tl-[16px]', 'rounded-tr-[16px]', 'rounded-bl-[0px]', 'rounded-br-[0px]']
    : [kind === 'tooltip' ? 'rounded-[6px]' : kind === 'menu' ? 'rounded-[10px]' : 'rounded-[12px]'];
  return {
    id,
    name: 'div',
    customName: overlayKindLabel(kind),
    classes: [
      'relative',
      'flex',
      'flex-col',
      `gap-[${gap}]`,
      `w-[${width}]`,
      ...(minHeight ? [`min-h-[${minHeight}]`] : []),
      ...(maxHeight ? [`max-h-[${maxHeight}]`] : []),
      ...(kind === 'sheet' || kind === 'menu' ? ['overflow-y-auto'] : []),
      ...(kind === 'sheet' ? ['shadow-[0_-12px_40px_rgba(15,15,15,0.16)]'] : []),
      ...(kind === 'menu' ? ['shadow-[0_12px_32px_rgba(15,15,15,0.16)]'] : []),
      'bg-white',
      ...radius,
      `p-[${padding}]`,
    ],
    // Child layers are the menu items. The open path marks a direct child
    // that has no role as a menuitem.
    ...(kind === 'menu' ? { attributes: { 'data-overlay-slot': 'items' } } : {}),
    overlay: {
      placement,
      kind,
      dismiss: defaultDismissForKind(kind),
      ...(anchored ? { anchor: 'bottom' as const } : {}),
    },
    design: {
      positioning: { isActive: true, position: 'relative' },
      layout: {
        isActive: true,
        display: 'Flex',
        flexDirection: 'column',
        gap,
      },
      sizing: {
        isActive: true,
        width,
        ...(minHeight ? { minHeight } : {}),
        ...(maxHeight ? { maxHeight } : {}),
        ...(kind === 'sheet' || kind === 'menu' ? { overflow: 'y-auto' as const } : {}),
      },
      spacing: {
        isActive: true,
        paddingTop: padding,
        paddingRight: padding,
        paddingBottom: padding,
        paddingLeft: padding,
      },
      ...(kind === 'sheet' ? {
        borders: {
          isActive: true,
          borderRadiusMode: 'individual' as const,
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          borderBottomLeftRadius: '0px',
          borderBottomRightRadius: '0px',
        },
      } : {}),
      backgrounds: { isActive: true, backgroundColor: '#ffffff' },
    },
    children: kind === 'menu'
      ? MENU_ITEM_LABELS.map((label, index) => createMenuItemLayer(`${id}-item-${index + 1}`, label))
      : [],
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
  const action = createOverlayAction(ids.actionId, 'open', overlayId, overlay.placement, overlay.kind);
  action.dismiss = { ...overlay.dismiss };
  if (overlay.anchor) action.anchor = overlay.anchor;
  if (overlay.anchorLayerId) action.anchorLayerId = overlay.anchorLayerId;

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
  const kind = resolveOverlayKind(overlay);
  const placement = placementForKind(kind);
  const anchored = placement === 'relative';
  const nextOverlay: LayerOverlay = {
    placement,
    kind,
    dismiss: { ...overlay.dismiss },
    ...(anchored ? { anchor: overlay.anchor ?? 'bottom' } : {}),
    ...(anchored && overlay.anchorLayerId ? { anchorLayerId: overlay.anchorLayerId } : {}),
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
          const next: typeof action = {
            ...action,
            placement: nextOverlay.placement,
            kind: nextOverlay.kind,
            dismiss: { ...nextOverlay.dismiss },
          };
          if (nextOverlay.anchor) next.anchor = nextOverlay.anchor;
          else delete next.anchor;
          if (nextOverlay.anchorLayerId) next.anchorLayerId = nextOverlay.anchorLayerId;
          else delete next.anchorLayerId;
          return next;
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
      kind: action.kind,
      anchor: action.anchor,
      anchorLayerId: action.anchorLayerId,
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
