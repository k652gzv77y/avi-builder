/**
 * Component variant utilities.
 *
 * Kept in a small, dependency-free module so it can be imported from both
 * `lib/layer-utils.ts` and `lib/component-utils.ts` without creating a
 * circular import.
 */

import type {
  Component,
  ComponentVariant,
  ComponentVariantState,
  DesignProperties,
  Layer,
  VariantStyleOverride,
} from '@/types';
import { getAffectedProperties } from '@/lib/tailwind-class-mapper';
import { mergeClassStack, splitVariant } from '@/lib/layer-style-resolve';

/** Preset variants for UI states. Responsive layout stays on breakpoints. */
export const COMPONENT_STATE_PRESETS: ReadonlyArray<{
  state: Exclude<ComponentVariantState, 'default'>;
  name: string;
}> = [
  { state: 'open', name: 'Open' },
  { state: 'closed', name: 'Closed' },
  { state: 'hover', name: 'Hover' },
  { state: 'pressed', name: 'Pressed' },
];

export function variantHasState(
  variants: ComponentVariant[] | undefined,
  state: ComponentVariantState,
): boolean {
  return (variants ?? []).some(variant => variant.state === state);
}

/**
 * While the pointer is over a resting instance, preview the hover or pressed
 * variant when one exists. An explicitly chosen state (open, closed, hover,
 * pressed) stays put so the instance control wins.
 */
export function resolvePointerVariantId(
  component: Component | undefined,
  selectedVariantId: string | undefined,
  pointer: 'hover' | 'pressed' | null,
): string | undefined {
  if (!component || !pointer) return selectedVariantId;
  const variants = component.variants ?? [];
  const selected = (selectedVariantId && variants.find(variant => variant.id === selectedVariantId))
    || variants[0];
  // Explicit states and extra custom variants stay selected. Hover and
  // pressed only stand in for the resting variant.
  if (selected?.state && selected.state !== 'default') return selectedVariantId;
  if (selected && !selected.state && variants[0]?.id !== selected.id) return selectedVariantId;
  const match = variants.find(variant => variant.state === pointer);
  return match?.id ?? selectedVariantId;
}

/**
 * Resolve the layer tree for a specific variant of a component.
 *
 * Falls back to the first variant when `variantId` is undefined or points at a
 * variant that no longer exists (e.g. it was deleted while instances were still
 * referencing it). Falls back to the legacy `component.layers` field for
 * components persisted before the variants migration.
 */
export function getComponentVariantLayers(
  component: Component,
  variantId?: string,
): Layer[] {
  const variants = component.variants;
  if (variants && variants.length > 0) {
    const match = variantId ? variants.find(v => v.id === variantId) : undefined;
    const variant = match ?? variants[0];
    if (isReplicaVariant(variant)) {
      return applyReplicaOverrides(replicaSourceLayers(component, variant), variant.overrides);
    }
    return variant.layers ?? [];
  }
  return component.layers ?? [];
}

const LAYOUT_PROPERTIES = new Set([
  'display',
  'flexDirection',
  'flexWrap',
  'justifyContent',
  'alignItems',
  'alignSelf',
  'gap',
  'columnGap',
  'rowGap',
  'gridTemplateColumns',
  'gridTemplateRows',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'overflow',
  'aspectRatio',
  'objectFit',
  'objectPosition',
  'gridColumnSpan',
  'gridRowSpan',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'zIndex',
]);

const STYLE_DESIGN_KEYS = ['typography', 'backgrounds', 'borders', 'effects', 'transforms', 'transitions'] as const;
const LAYOUT_DESIGN_KEYS = ['layout', 'spacing', 'sizing', 'positioning'] as const;

type StyleDesignKey = typeof STYLE_DESIGN_KEYS[number];
type LayoutDesignKey = typeof LAYOUT_DESIGN_KEYS[number];

function classTokens(classes: string | string[] | undefined): string[] {
  if (!classes) return [];
  const value = Array.isArray(classes) ? classes.join(' ') : classes;
  return value.split(/\s+/).filter(Boolean);
}

function tokenKey(tokens: string[]): string {
  return [...tokens].sort().join(' ');
}

/** A class is a style token when every property it sets is visual, not layout. */
export function isStyleClass(className: string): boolean {
  const properties = getAffectedProperties(className);
  if (properties.length === 0) return false;
  return properties.every(property => !LAYOUT_PROPERTIES.has(property));
}

export function partitionClasses(classes: string | string[] | undefined): {
  style: string[];
  layout: string[];
} {
  const style: string[] = [];
  const layout: string[] = [];
  for (const token of classTokens(classes)) {
    if (isStyleClass(token)) style.push(token);
    else layout.push(token);
  }
  return { style, layout };
}

function pickDesign(
  design: DesignProperties | undefined,
  keys: readonly StyleDesignKey[] | readonly LayoutDesignKey[],
): DesignProperties | undefined {
  if (!design) return undefined;
  const next: DesignProperties = {};
  let kept = false;
  for (const key of keys) {
    const value = design[key as keyof DesignProperties];
    if (value) {
      (next as Record<string, unknown>)[key] = value;
      kept = true;
    }
  }
  return kept ? next : undefined;
}

function designKey(design: DesignProperties | undefined): string {
  return JSON.stringify(design ?? null);
}

/**
 * Hover and Pressed created as replicas. Legacy variants that cloned a full
 * tree keep their own layers and are not treated as replicas.
 */
export function isReplicaVariant(variant: ComponentVariant | undefined): boolean {
  return !!variant?.replicaOf;
}

export function isGestureVariant(variant: ComponentVariant | undefined): boolean {
  return variant?.state === 'hover' || variant?.state === 'pressed';
}

export function replicaSourceLayers(component: Component, variant: ComponentVariant): Layer[] {
  const variants = component.variants ?? [];
  const source = variant.replicaOf
    ? variants.find(item => item.id === variant.replicaOf)
    : variants[0];
  if (source && !isReplicaVariant(source)) return source.layers ?? [];
  const fallback = variants.find(item => !isReplicaVariant(item));
  return fallback?.layers ?? component.layers ?? [];
}

export function layerIdsShare(left: Layer[], right: Layer[]): boolean {
  const ids = new Set<string>();
  const collect = (layers: Layer[]) => {
    for (const layer of layers) {
      ids.add(layer.id);
      if (layer.children?.length) collect(layer.children);
    }
  };
  collect(left);
  const overlaps = (layers: Layer[]): boolean => {
    for (const layer of layers) {
      if (ids.has(layer.id)) return true;
      if (layer.children?.length && overlaps(layer.children)) return true;
    }
    return false;
  };
  return overlaps(right);
}

function diffStyle(primary: Layer, edited: Layer): VariantStyleOverride | null {
  const primaryStyle = partitionClasses(primary.classes).style;
  const editedStyle = partitionClasses(edited.classes).style;
  const primaryDesign = pickDesign(primary.design, STYLE_DESIGN_KEYS);
  const editedDesign = pickDesign(edited.design, STYLE_DESIGN_KEYS);
  const classesDiffer = tokenKey(primaryStyle) !== tokenKey(editedStyle);
  const designDiffer = designKey(primaryDesign) !== designKey(editedDesign);
  if (!classesDiffer && !designDiffer) return null;
  return {
    classes: editedStyle.join(' '),
    design: editedDesign,
  };
}

function withLayoutFromEdited(edited: Layer, styleSource: Layer | undefined): Layer {
  const layout = partitionClasses(edited.classes).layout;
  const style = partitionClasses(styleSource?.classes).style;
  const { children: _children, ...rest } = edited;
  return {
    ...rest,
    classes: mergeClassStack([...layout, ...style]).join(' '),
    design: {
      ...pickDesign(edited.design, LAYOUT_DESIGN_KEYS),
      ...pickDesign(styleSource?.design, STYLE_DESIGN_KEYS),
    },
  };
}

/**
 * Split a replica edit into primary layout (shared across breakpoints and
 * gestures) and per-layer style overrides.
 */
export function reconcileReplicaEdit(
  primaryLayers: Layer[],
  editedLayers: Layer[],
): { primary: Layer[]; overrides: Record<string, VariantStyleOverride> } {
  const byId = new Map<string, Layer>();
  const index = (layers: Layer[]) => {
    for (const layer of layers) {
      byId.set(layer.id, layer);
      if (layer.children?.length) index(layer.children);
    }
  };
  index(primaryLayers);

  const overrides: Record<string, VariantStyleOverride> = {};
  const layoutUnchanged = (base: Layer, edited: Layer): boolean => {
    const sameTokens = tokenKey(partitionClasses(base.classes).layout)
      === tokenKey(partitionClasses(edited.classes).layout);
    const sameDesign = designKey(pickDesign(base.design, LAYOUT_DESIGN_KEYS))
      === designKey(pickDesign(edited.design, LAYOUT_DESIGN_KEYS));
    return sameTokens && sameDesign;
  };
  const walk = (edited: Layer): Layer => {
    const base = byId.get(edited.id);
    const primaryLayer = base && layoutUnchanged(base, edited)
      ? { ...base, children: undefined }
      : withLayoutFromEdited(edited, base);
    primaryLayer.children = edited.children?.map(walk);
    const override = diffStyle(primaryLayer, edited);
    if (override) overrides[edited.id] = override;
    return primaryLayer;
  };

  return {
    primary: editedLayers.map(walk),
    overrides,
  };
}

export function applyReplicaOverrides(
  layers: Layer[],
  overrides: Record<string, VariantStyleOverride> | undefined,
): Layer[] {
  if (!overrides || Object.keys(overrides).length === 0) {
    return layers.map(layer => ({
      ...layer,
      children: layer.children ? applyReplicaOverrides(layer.children, overrides) : layer.children,
    }));
  }

  const walk = (layer: Layer): Layer => {
    const override = overrides[layer.id];
    const layout = partitionClasses(layer.classes).layout;
    const style = override
      ? classTokens(override.classes)
      : partitionClasses(layer.classes).style;
    return {
      ...layer,
      classes: mergeClassStack([...layout, ...style]).join(' '),
      design: override?.design
        ? { ...layer.design, ...override.design }
        : layer.design,
      children: layer.children?.map(walk),
    };
  };

  return layers.map(walk);
}

export function countReplicaOverrides(
  overrides: Record<string, VariantStyleOverride> | undefined,
): number {
  if (!overrides) return 0;
  return Object.keys(overrides).length;
}

export function withoutReplicaOverride(
  overrides: Record<string, VariantStyleOverride> | undefined,
  layerId?: string,
): Record<string, VariantStyleOverride> {
  if (!overrides) return {};
  if (!layerId) return {};
  if (!overrides[layerId]) return overrides;
  const next = { ...overrides };
  delete next[layerId];
  return next;
}

/** Prefix style classes so a published page can switch without a script. */
export function prefixGestureClasses(classes: string | undefined, gesture: 'hover' | 'pressed'): string {
  const state = gesture === 'pressed' ? 'active' : 'hover';
  return classTokens(classes).map(token => {
    const { prefix, base } = splitVariant(token);
    if (/(^|:)(hover|active|focus):/.test(prefix)) return token;
    return `${prefix}${state}:${base}`;
  }).join(' ');
}

export function isRestingVariant(component: Component, variantId?: string): boolean {
  const variants = component.variants ?? [];
  if (variants.length === 0) return true;
  const match = variantId ? variants.find(variant => variant.id === variantId) : undefined;
  const variant = match ?? variants[0];
  if (!variant) return true;
  if (variant.replicaOf) return false;
  if (variant.state && variant.state !== 'default') return false;
  return variant.id === variants[0].id;
}

export function bakeGestureClasses(layers: Layer[], component: Component): Layer[] {
  const variants = component.variants ?? [];
  const hover = variants.find(variant => variant.state === 'hover' && isReplicaVariant(variant));
  const pressed = variants.find(variant => variant.state === 'pressed' && isReplicaVariant(variant));
  if (!hover?.overrides && !pressed?.overrides) return layers;

  const walk = (layer: Layer): Layer => {
    const extra = [
      hover?.overrides?.[layer.id]?.classes
        ? prefixGestureClasses(hover.overrides[layer.id].classes, 'hover')
        : '',
      pressed?.overrides?.[layer.id]?.classes
        ? prefixGestureClasses(pressed.overrides[layer.id].classes, 'pressed')
        : '',
    ].filter(Boolean);
    const classes = extra.length
      ? `${classTokens(layer.classes).join(' ')} ${extra.join(' ')}`.trim()
      : layer.classes;
    return {
      ...layer,
      classes,
      children: layer.children?.map(walk),
    };
  };

  return layers.map(walk);
}

/**
 * Layers for a published or preview tree. Resting instances keep the primary
 * layout and add hover/active classes from replica overrides.
 */
export function prepareVariantLayersForPublish(
  component: Component,
  variantId?: string,
): Layer[] {
  const layers = getComponentVariantLayers(component, variantId);
  if (!isRestingVariant(component, variantId)) return layers;
  return bakeGestureClasses(layers, component);
}

/** Class candidates the stylesheet must include for gesture replicas. */
export function collectGestureCandidateClasses(component: Component): string[] {
  const classes: string[] = [];
  for (const variant of component.variants ?? []) {
    if (!isReplicaVariant(variant) || !variant.overrides) continue;
    const gesture = variant.state === 'pressed' || variant.state === 'hover' ? variant.state : null;
    for (const override of Object.values(variant.overrides)) {
      if (!override.classes) continue;
      classes.push(override.classes);
      if (gesture) classes.push(prefixGestureClasses(override.classes, gesture));
    }
  }
  return classes.filter(Boolean);
}

/**
 * Option for a variant-variable selector. `componentName` is included so
 * selectors can disambiguate the same variant name across different target
 * components when a generic Variant variable is linked from instances of more
 * than one nested component.
 */
export interface VariantVariableOption {
  variant_id: string;
  variant_name: string;
  component_id: string;
  component_name: string;
}

/**
 * Collect every (target component, variant) pair reachable through any layer
 * inside `parentComponent` whose `componentVariantVariableId` points at
 * `variableId`. Used by both the variables dialog (to pick a default variant)
 * and the override panel (to choose an override) to populate Selects.
 *
 * Walks every variant tree of the parent component, not just the primary one,
 * so a variant variable that is only linked from layers inside e.g. "Variant 2"
 * still surfaces options.
 */
export function collectVariantVariableOptions(
  parentComponent: Component | undefined,
  allComponents: Component[],
  variableId: string,
): VariantVariableOption[] {
  if (!parentComponent || !variableId) return [];

  const seenPairs = new Set<string>();
  const options: VariantVariableOption[] = [];

  const walk = (layers: Layer[]) => {
    for (const layer of layers) {
      if (
        layer.componentVariantVariableId === variableId
        && layer.componentId
      ) {
        const target = allComponents.find(c => c.id === layer.componentId);
        if (target?.variants && target.variants.length > 0) {
          for (const v of target.variants) {
            const key = `${target.id}::${v.id}`;
            if (seenPairs.has(key)) continue;
            seenPairs.add(key);
            options.push({
              variant_id: v.id,
              variant_name: v.name,
              component_id: target.id,
              component_name: target.name,
            });
          }
        }
      }
      if (layer.children?.length) walk(layer.children);
    }
  };

  const variantsToWalk = parentComponent.variants && parentComponent.variants.length > 0
    ? parentComponent.variants
    : [{ id: 'legacy', name: 'Default', layers: parentComponent.layers ?? [] }];

  for (const v of variantsToWalk) {
    if (Array.isArray(v.layers)) walk(v.layers);
  }

  return options;
}
