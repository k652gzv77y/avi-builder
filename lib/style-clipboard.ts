/**
 * Copy and paste visual styles between layers.
 *
 * Paste style transfers fill, border, radius, shadow, opacity, blend,
 * filters, transforms, and transitions. Typography is included only when the
 * target is a text layer. Position, size, and other layout classes stay put.
 * Breakpoint-prefixed classes of every kind are a separate paste so tablet
 * and phone overrides can move without touching the desktop layout.
 *
 * Component instances have no general style slot. Fill and opacity paste as
 * property-control overrides when the master exposes those bindings.
 */

import type { Component, ComponentVariable, DesignProperties, Layer } from '@/types';
import { getComponentVariantLayers } from '@/lib/component-variant-utils';
import {
  applyControlBindings,
  parseBindingId,
  variablesForVariant,
} from '@/lib/component-properties';
import { isRichTextLayer, isTextContentLayer } from '@/lib/layer-utils';
import { buildStyledUpdate } from '@/lib/layer-style-utils';
import { hasResponsivePrefix } from '@/lib/breakpoint-utils';
import { classesToDesign, getAffectedProperties, parseFullClass } from '@/lib/tailwind-class-mapper';
import { EMPTY_OVERRIDES } from '@/lib/variable-utils';

export type StylePasteMode = 'styles' | 'responsive';

export interface CopiedLayerStyle {
  /** Visual classes, including breakpoint and UI-state prefixes. */
  classes: string[];
  /** Desktop visual design. Empty categories are omitted. */
  design: DesignProperties;
  /** Breakpoint-prefixed classes, style and layout, for paste responsive. */
  responsiveClasses: string[];
}

const STYLE_DESIGN_KEYS = ['typography', 'backgrounds', 'borders', 'effects', 'transforms', 'transitions'] as const;

/**
 * Same split the variant replicas use: these properties are layout, so paste
 * style leaves them on the target. Prefixed classes are classified from the
 * utility itself because the shared property lookup ignores the prefix.
 */
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
  'marginX',
  'marginY',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'padding',
  'paddingX',
  'paddingY',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'alignContent',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'zIndex',
]);

const TYPOGRAPHY_PROPERTIES = new Set([
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textWrap',
  'fontVariantNumeric',
  'textTransform',
  'textDecoration',
  'textDecorationColor',
  'textDecorationThickness',
  'underlineOffset',
  'lineClamp',
  'color',
  'placeholderColor',
  'textShadow',
  'verticalAlign',
]);

type StyleDesignKey = (typeof STYLE_DESIGN_KEYS)[number];

function classTokens(classes: Layer['classes'] | undefined): string[] {
  if (Array.isArray(classes)) return classes.filter(Boolean);
  return (classes || '').split(/\s+/).filter(Boolean);
}

function classString(classes: string[]): string {
  return classes.join(' ');
}

function filledCategory(value: object | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const entries = Object.entries(value).filter(([, entry]) => entry != null && entry !== '');
  const meaningful = entries.filter(([key]) => key !== 'isActive');
  if (meaningful.length === 0) return undefined;
  return Object.fromEntries(entries);
}

function sameGroup(left: string, right: string): boolean {
  const a = parseFullClass(left);
  const b = parseFullClass(right);
  return a.breakpoint === b.breakpoint && a.uiState === b.uiState;
}

/**
 * Gradient text is `bg-[linear-gradient(...)]` plus clip and transparent.
 * Those classes paint the glyphs, not a layer fill.
 */
function isTextGradientHelper(className: string, universe: string[]): boolean {
  const { baseClass } = parseFullClass(className);
  const group = universe
    .filter((other) => sameGroup(other, className))
    .map((other) => parseFullClass(other).baseClass);
  const isGradientText = group.includes('bg-clip-text') && group.includes('text-transparent');
  if (!isGradientText) return false;
  if (baseClass === 'bg-clip-text' || baseClass === 'text-transparent') return true;
  return baseClass.startsWith('bg-[') && baseClass.includes('gradient(');
}

function propertiesOf(className: string): string[] {
  const direct = getAffectedProperties(className);
  if (direct.length > 0) return direct;
  const { baseClass } = parseFullClass(className);
  if (baseClass === className) return direct;
  return getAffectedProperties(baseClass);
}

function isVisualStyleClass(className: string): boolean {
  const properties = propertiesOf(className);
  if (properties.length === 0) return false;
  return properties.every((property) => !LAYOUT_PROPERTIES.has(property));
}

function isTypographyClass(className: string, universe: string[]): boolean {
  if (isTextGradientHelper(className, universe)) return true;
  return propertiesOf(className).some((property) => TYPOGRAPHY_PROPERTIES.has(property));
}

function acceptsStyleClass(className: string, universe: string[], includeTypography: boolean): boolean {
  if (!isVisualStyleClass(className)) return false;
  if (!includeTypography && isTypographyClass(className, universe)) return false;
  return true;
}

function isResponsiveClass(className: string): boolean {
  return hasResponsivePrefix(className) && propertiesOf(className).length > 0;
}

function captureDesign(layer: Layer, styleTokens: string[]): DesignProperties {
  const desktop = styleTokens.filter((token) => {
    const parsed = parseFullClass(token);
    return parsed.breakpoint === 'desktop' && parsed.uiState === 'neutral';
  });
  const parsed = classesToDesign(desktop);
  const design: DesignProperties = {};
  for (const key of STYLE_DESIGN_KEYS) {
    const merged = {
      ...filledCategory(parsed?.[key] as object | undefined),
      ...filledCategory(layer.design?.[key] as object | undefined),
    };
    if (Object.keys(merged).length > 0) {
      design[key] = merged as DesignProperties[StyleDesignKey];
    }
  }
  return design;
}

/** Read the visual style off a layer. Layout classes are left behind. */
export function captureLayerStyle(layer: Layer): CopiedLayerStyle {
  const tokens = classTokens(layer.classes);
  const classes = tokens.filter((token) => isVisualStyleClass(token));
  return {
    classes,
    design: captureDesign(layer, classes),
    responsiveClasses: tokens.filter((token) => isResponsiveClass(token)),
  };
}

/**
 * The layer whose styles are actually on screen.
 * An instance's own classes are a shell; the master root (plus fill and
 * opacity overrides) is what the canvas paints.
 */
export function visibleLayerForStyleCopy(layer: Layer, component: Component | undefined): Layer {
  if (!layer.componentId || !component || component.id !== layer.componentId) return layer;
  const root = getComponentVariantLayers(component, layer.componentVariantId)[0];
  if (!root) return layer;
  const variables = variablesForVariant(component.variables, component, layer.componentVariantId);
  return applyControlBindings(root, layer.componentOverrides, variables, { ephemeral: false });
}

function targetAcceptsTypography(layer: Layer): boolean {
  return isTextContentLayer(layer) || isRichTextLayer(layer);
}

function designForPaste(layer: Layer, copied: CopiedLayerStyle, includeTypography: boolean): DesignProperties {
  const design: DesignProperties = { ...layer.design };
  for (const key of STYLE_DESIGN_KEYS) {
    if (key === 'typography' && !includeTypography) continue;
    const value = copied.design[key];
    if (value) design[key] = structuredClone(value);
    else delete design[key];
  }
  return design;
}

/**
 * Keep the source class order. Conflict merging drops the pieces of a text
 * gradient (`bg-[linear-gradient(...)]`, `bg-clip-text`, `text-transparent`)
 * because they share the color property on purpose.
 */
function appendClasses(kept: string[], added: string[]): string[] {
  const seen = new Set(kept);
  const next = [...kept];
  for (const token of added) {
    if (seen.has(token)) continue;
    seen.add(token);
    next.push(token);
  }
  return next;
}

function classesForStylePaste(layer: Layer, copied: CopiedLayerStyle, includeTypography: boolean): string {
  const current = classTokens(layer.classes);
  const kept = current.filter((token) => !acceptsStyleClass(token, current, includeTypography));
  const added = copied.classes.filter((token) => acceptsStyleClass(token, copied.classes, includeTypography));
  return classString(appendClasses(kept, added));
}

function classesForResponsivePaste(layer: Layer, copied: CopiedLayerStyle): string {
  const kept = classTokens(layer.classes).filter((token) => !isResponsiveClass(token));
  return classString(appendClasses(kept, copied.responsiveClasses));
}

function withoutNamedStyleLinks(layer: Layer, includeTypography: boolean): Layer {
  let next = layer;
  if (includeTypography && next.namedTextStyleId) {
    const { namedTextStyleId: _removed, ...rest } = next;
    next = rest;
  }
  if (!next.colorStyleIds) return next;
  const colorStyleIds = { ...next.colorStyleIds };
  delete colorStyleIds.backgroundColor;
  delete colorStyleIds.borderColor;
  if (includeTypography) delete colorStyleIds.color;
  if (Object.keys(colorStyleIds).length === 0) {
    const { colorStyleIds: _removed, ...rest } = next;
    return rest;
  }
  if (JSON.stringify(colorStyleIds) === JSON.stringify(next.colorStyleIds)) return next;
  return { ...next, colorStyleIds };
}

function styleSignature(layer: Layer): string {
  return JSON.stringify({
    classes: classString(classTokens(layer.classes)),
    design: layer.design ?? null,
    styleOverrides: layer.styleOverrides ?? null,
    namedTextStyleId: layer.namedTextStyleId ?? null,
    colorStyleIds: layer.colorStyleIds ?? null,
    componentOverrides: layer.componentOverrides ?? null,
  });
}

function opacityPercent(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith('%')) {
    const amount = Number(trimmed.slice(0, -1));
    if (!Number.isFinite(amount)) return null;
    return Math.max(0, Math.min(100, Math.round(amount)));
  }
  const amount = Number(trimmed);
  if (!Number.isFinite(amount)) return null;
  if (amount >= 0 && amount <= 1 && trimmed.includes('.')) {
    return Math.max(0, Math.min(100, Math.round(amount * 100)));
  }
  return Math.max(0, Math.min(100, Math.round(amount)));
}

function overrideColor(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('gradient(')) return null;
  if (
    trimmed.startsWith('#')
    || trimmed.startsWith('rgb')
    || trimmed.startsWith('hsl')
    || trimmed.startsWith('color:var(')
    || trimmed.startsWith('var(')
  ) {
    return trimmed;
  }
  return null;
}

function readFill(copied: CopiedLayerStyle): string | null {
  return overrideColor(copied.design.backgrounds?.backgroundColor);
}

function readOpacity(copied: CopiedLayerStyle): number | null {
  const fromDesign = opacityPercent(copied.design.effects?.opacity);
  if (fromDesign != null) return fromDesign;
  for (const token of copied.classes) {
    const parsed = parseFullClass(token);
    if (parsed.breakpoint !== 'desktop' || parsed.uiState !== 'neutral') continue;
    const arbitrary = parsed.baseClass.match(/^opacity-\[(.+)\]$/);
    if (arbitrary) return opacityPercent(arbitrary[1]);
    const named = parsed.baseClass.match(/^opacity-(\d+)$/);
    if (named) return opacityPercent(named[1]);
  }
  return null;
}

function writeInstanceOverrides(
  layer: Layer,
  copied: CopiedLayerStyle,
  component: Component,
): Layer | null {
  const root = getComponentVariantLayers(component, layer.componentVariantId)[0];
  const bindings = root?.controlBindings;
  if (!bindings) return null;
  const variables = variablesForVariant(component.variables, component, layer.componentVariantId);
  let overrides = layer.componentOverrides;
  let changed = false;

  const fill = bindings.fill ? boundOverride(bindings.fill, variables, 'color') : undefined;
  const fillValue = readFill(copied);
  if (fill && fillValue) {
    overrides = {
      ...EMPTY_OVERRIDES,
      ...overrides,
      color: {
        ...(overrides?.color ?? {}),
        [fill.id]: { type: 'color', value: fillValue },
      },
    };
    changed = true;
  }

  const opacity = bindings.opacity ? boundOverride(bindings.opacity, variables, 'number') : undefined;
  const opacityValue = readOpacity(copied);
  if (opacity && opacityValue != null) {
    overrides = {
      ...EMPTY_OVERRIDES,
      ...overrides,
      number: {
        ...(overrides?.number ?? {}),
        [opacity.id]: { type: 'number', value: opacityValue },
      },
    };
    changed = true;
  }

  if (!changed || !overrides) return null;
  const next: Layer = { ...layer, componentOverrides: overrides };
  return styleSignature(next) === styleSignature(layer) ? null : next;
}

function boundOverride(
  bindingId: string,
  variables: ComponentVariable[] | undefined,
  type: 'color' | 'number',
): ComponentVariable | undefined {
  const parsed = parseBindingId(bindingId);
  if (parsed.fieldId) return undefined;
  const variable = variables?.find((item) => item.id === parsed.variableId);
  if (!variable || variable.type !== type) return undefined;
  return variable;
}

/**
 * Apply a copied style to one layer.
 * Returns null when the layer cannot accept the paste or nothing changes.
 */
export function layerWithPastedStyle(
  layer: Layer,
  copied: CopiedLayerStyle,
  mode: StylePasteMode,
  component?: Component,
): Layer | null {
  if (layer.componentId) {
    if (mode !== 'styles' || !component || component.id !== layer.componentId) return null;
    return writeInstanceOverrides(layer, copied, component);
  }

  if (mode === 'responsive') {
    if (copied.responsiveClasses.length === 0) return null;
    const classes = classesForResponsivePaste(layer, copied);
    if (classes === classString(classTokens(layer.classes))) return null;
    const next: Layer = {
      ...layer,
      ...buildStyledUpdate(layer, { classes, design: layer.design }),
    };
    return styleSignature(next) === styleSignature(layer) ? null : next;
  }

  const includeTypography = targetAcceptsTypography(layer);
  const classes = classesForStylePaste(layer, copied, includeTypography);
  const design = designForPaste(layer, copied, includeTypography);
  let next: Layer = {
    ...layer,
    ...buildStyledUpdate(layer, { classes, design }),
  };
  next = withoutNamedStyleLinks(next, includeTypography);
  return styleSignature(next) === styleSignature(layer) ? null : next;
}

/** Paste onto every listed layer in one tree copy, so one edit is one undo. */
export function applyCopiedStyleInTree(
  layers: Layer[],
  targetIds: readonly string[],
  copied: CopiedLayerStyle,
  mode: StylePasteMode,
  componentFor: (componentId: string) => Component | undefined,
): Layer[] {
  if (targetIds.length === 0) return layers;
  if (mode === 'responsive' && copied.responsiveClasses.length === 0) return layers;
  const ids = new Set(targetIds);

  const walk = (tree: Layer[]): Layer[] => {
    let changed = false;
    const next = tree.map((layer) => {
      let current = layer;
      if (ids.has(layer.id)) {
        const component = layer.componentId ? componentFor(layer.componentId) : undefined;
        const pasted = layerWithPastedStyle(layer, copied, mode, component);
        if (pasted) {
          current = pasted;
          changed = true;
        }
      }
      if (layer.children?.length) {
        const children = walk(layer.children);
        if (children !== layer.children) {
          current = current === layer ? { ...layer, children } : { ...current, children };
          changed = true;
        }
      }
      return current;
    });
    return changed ? next : tree;
  };

  return walk(layers);
}
