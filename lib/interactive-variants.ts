/**
 * Interactive component states.
 *
 * Hover and Press borrow a variant while the pointer is there, then return
 * to whatever was showing before. A Drag threshold can do the same, or keep
 * the variant when the author marks it sticky. Tap and other lasting actions
 * keep the variant they set. Press wins over Drag, Drag wins over Hover, and
 * Hover wins over the lasting choice.
 */

import type { Component, Layer, LayerInteraction } from '@/types';
import { isRestingVariant } from '@/lib/component-variant-utils';

export interface VariantSession {
  /** Last Tap, key, timer, or other action that stays after the gesture. */
  base: string | null;
  hover: string | null;
  press: string | null;
  /** Variant shown while a drag is past a threshold. Cleared on release. */
  drag: string | null;
}

export type VariantGesture = 'hover' | 'press' | 'drag' | 'sticky';

export function emptyVariantSession(): VariantSession {
  return { base: null, hover: null, press: null, drag: null };
}

/** Press, then drag, then hover, then the lasting variant. Null means the authored variant. */
export function activeVariantId(session: VariantSession): string | null {
  return session.press ?? session.drag ?? session.hover ?? session.base;
}

export function reduceVariantSession(
  session: VariantSession,
  event:
    | { type: 'set'; gesture: VariantGesture; variantId: string }
    | { type: 'end'; gesture: 'hover' | 'press' | 'drag' },
): VariantSession {
  if (event.type === 'end') {
    if (event.gesture === 'hover') {
      if (session.hover == null) return session;
      return { ...session, hover: null };
    }
    if (event.gesture === 'drag') {
      if (session.drag == null) return session;
      return { ...session, drag: null };
    }
    if (session.press == null) return session;
    return { ...session, press: null };
  }
  if (!event.variantId) return session;
  if (event.gesture === 'hover') {
    if (session.hover === event.variantId) return session;
    return { ...session, hover: event.variantId };
  }
  if (event.gesture === 'press') {
    if (session.press === event.variantId) return session;
    return { ...session, press: event.variantId };
  }
  if (event.gesture === 'drag') {
    if (session.drag === event.variantId) return session;
    return { ...session, drag: event.variantId };
  }
  if (session.base === event.variantId) return session;
  return { ...session, base: event.variantId };
}

export function variantGestureForTrigger(trigger: LayerInteraction['trigger']): VariantGesture {
  if (trigger === 'hover') return 'hover';
  if (trigger === 'press') return 'press';
  if (trigger === 'drag') return 'drag';
  return 'sticky';
}

/** The instance itself has a Hover or Press action that sets its own variant. */
export function interactionOwnsGesture(layer: Layer, gesture: 'hover' | 'press'): boolean {
  return (layer.interactions ?? []).some((interaction) => (
    interaction.trigger === gesture
    && (interaction.actions ?? []).some((action) => (
      action.type === 'set-variant' && action.targetLayerId === layer.id && !!action.variantId
    ))
  ));
}

export function collectSetVariantTargets(layers: Layer[]): Map<string, string[]> {
  const found = new Map<string, Set<string>>();
  const walk = (list: Layer[]) => {
    for (const layer of list) {
      for (const interaction of layer.interactions ?? []) {
        for (const action of interaction.actions ?? []) {
          if (action.type !== 'set-variant' || !action.targetLayerId || !action.variantId) continue;
          const bucket = found.get(action.targetLayerId) ?? new Set<string>();
          bucket.add(action.variantId);
          found.set(action.targetLayerId, bucket);
        }
      }
      if (layer.children?.length) walk(layer.children);
    }
  };
  walk(layers);
  const result = new Map<string, string[]>();
  for (const [layerId, variantIds] of found) result.set(layerId, [...variantIds]);
  return result;
}

export function resolvedVariantId(component: Component, variantId?: string): string {
  const variants = component.variants ?? [];
  if (variants.length === 0) return variantId ?? '';
  const match = variantId ? variants.find((variant) => variant.id === variantId) : undefined;
  return (match ?? variants[0]).id;
}

export interface InteractivePanePlan {
  restingVariantId: string;
  hoverVariantId?: string;
  pressedVariantId?: string;
  paneIds: string[];
}

/**
 * Variants a published instance must be able to show.
 * Hover and Pressed are included for a resting instance. An action that
 * already sets this instance's variant owns that gesture, so the automatic
 * switch stays off and the action's target is still rendered.
 */
export function planInteractivePanes(
  component: Component,
  selectedVariantId: string | undefined,
  explicitVariantIds: Iterable<string>,
  ownedGestures: { hover: boolean; press: boolean },
): InteractivePanePlan {
  const variants = component.variants ?? [];
  const restingVariantId = resolvedVariantId(component, selectedVariantId);
  const known = new Set(variants.map((variant) => variant.id));
  const paneIds = new Set<string>();
  let hoverVariantId: string | undefined;
  let pressedVariantId: string | undefined;

  if (isRestingVariant(component, restingVariantId)) {
    const hover = variants.find((variant) => variant.state === 'hover');
    const pressed = variants.find((variant) => variant.state === 'pressed');
    if (hover && hover.id !== restingVariantId && known.has(hover.id)) {
      paneIds.add(hover.id);
      if (!ownedGestures.hover) hoverVariantId = hover.id;
    }
    if (pressed && pressed.id !== restingVariantId && known.has(pressed.id)) {
      paneIds.add(pressed.id);
      if (!ownedGestures.press) pressedVariantId = pressed.id;
    }
  }

  for (const variantId of explicitVariantIds) {
    if (!variantId || variantId === restingVariantId || !known.has(variantId)) continue;
    paneIds.add(variantId);
  }

  return {
    restingVariantId,
    hoverVariantId,
    pressedVariantId,
    paneIds: [...paneIds],
  };
}
