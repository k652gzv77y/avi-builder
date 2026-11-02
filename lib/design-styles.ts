/**
 * Named color styles and text styles.
 *
 * These are layer styles with a reserved group, applied from the Style
 * section and listed in Assets. A layer keeps the style id, so editing the
 * style rewrites every linked instance. Rich-text mark styles (`textStyles`)
 * and combo-class stacks stay separate.
 */

import type { ColorStyleSlot, DesignProperties, Layer, LayerStyle, TypographyDesign } from '@/types';
import { propertyToClass, replaceConflictingClasses } from '@/lib/tailwind-class-mapper';

export const COLOR_STYLE_GROUP = 'color-style';
export const TEXT_STYLE_GROUP = 'text-style';

export const COLOR_STYLE_SLOTS: readonly ColorStyleSlot[] = ['backgroundColor', 'color', 'borderColor'];

const TYPOGRAPHY_KEYS: Array<keyof TypographyDesign> = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textTransform',
  'textDecoration',
  'color',
];

export function isColorStyle(style: { group?: string } | undefined): boolean {
  return style?.group === COLOR_STYLE_GROUP;
}

export function isTextStyle(style: { group?: string } | undefined): boolean {
  return style?.group === TEXT_STYLE_GROUP;
}

export function isNamedPresetStyle(style: { group?: string } | undefined): boolean {
  return isColorStyle(style) || isTextStyle(style);
}

export function classTokens(classes: string | string[] | undefined): string[] {
  if (!classes) return [];
  const value = Array.isArray(classes) ? classes.join(' ') : classes;
  return value.split(/\s+/).filter(Boolean);
}

export function colorStyleValue(style: Pick<LayerStyle, 'design'> | undefined): string {
  return style?.design?.backgrounds?.backgroundColor || '';
}

export function colorStyleDesign(value: string): DesignProperties {
  return {
    backgrounds: {
      isActive: true,
      backgroundColor: value,
    },
  };
}

export function colorStyleClasses(value: string): string {
  if (!value) return '';
  return propertyToClass('backgrounds', 'backgroundColor', value) ?? '';
}

export function textStylePayload(typography: TypographyDesign | undefined): {
  classes: string;
  design: DesignProperties;
} {
  const next: TypographyDesign = { isActive: true };
  let classes: string[] = [];
  if (typography) {
    for (const key of TYPOGRAPHY_KEYS) {
      const value = typography[key];
      if (typeof value !== 'string' || !value) continue;
      Object.assign(next, { [key]: value });
      const cls = propertyToClass('typography', key, value);
      if (cls) classes = replaceConflictingClasses(classes, key, cls);
    }
  }
  return {
    classes: classes.join(' '),
    design: { typography: next },
  };
}

function slotCategory(slot: ColorStyleSlot): keyof NonNullable<Layer['design']> {
  if (slot === 'color') return 'typography';
  if (slot === 'borderColor') return 'borders';
  return 'backgrounds';
}

export function applyNamedTextStyle(layer: Layer, style: LayerStyle): Layer {
  const typography = style.design?.typography;
  let classes = classTokens(layer.classes);
  const nextTypography: TypographyDesign = { ...layer.design?.typography, isActive: true };
  if (typography) {
    for (const key of TYPOGRAPHY_KEYS) {
      const value = typography[key];
      if (typeof value !== 'string' || !value) continue;
      const cls = propertyToClass('typography', key, value);
      classes = replaceConflictingClasses(classes, key, cls);
      Object.assign(nextTypography, { [key]: value });
    }
  }
  return {
    ...layer,
    classes: classes.join(' '),
    design: {
      ...layer.design,
      typography: nextTypography,
    },
    namedTextStyleId: style.id,
  };
}

export function applyNamedColorStyle(layer: Layer, style: LayerStyle, slot: ColorStyleSlot): Layer {
  const value = colorStyleValue(style);
  const category = slotCategory(slot);
  const cls = value ? propertyToClass(category, slot, value) : null;
  const classes = replaceConflictingClasses(classTokens(layer.classes), slot, cls);
  const design: DesignProperties = { ...layer.design };
  if (slot === 'color') {
    design.typography = { ...design.typography, isActive: true, color: value || undefined };
  } else if (slot === 'borderColor') {
    design.borders = { ...design.borders, isActive: true, borderColor: value || undefined };
  } else {
    design.backgrounds = { ...design.backgrounds, isActive: true, backgroundColor: value || undefined };
  }
  const colorStyleIds = { ...layer.colorStyleIds, [slot]: style.id };
  return {
    ...layer,
    classes: classes.join(' '),
    design,
    colorStyleIds,
  };
}

export function clearNamedTextStyle(layer: Layer): Layer {
  if (!layer.namedTextStyleId) return layer;
  const { namedTextStyleId: _removed, ...rest } = layer;
  return rest;
}

export function clearNamedColorStyle(layer: Layer, slot: ColorStyleSlot): Layer {
  if (!layer.colorStyleIds?.[slot]) return layer;
  const colorStyleIds = { ...layer.colorStyleIds };
  delete colorStyleIds[slot];
  return {
    ...layer,
    colorStyleIds: Object.keys(colorStyleIds).length > 0 ? colorStyleIds : undefined,
  };
}

/** Re-apply every named style this layer links, so a style edit reaches instances. */
export function reapplyLinkedNamedStyles(
  layer: Layer,
  stylesById: Map<string, LayerStyle>,
): Layer {
  let next = layer;
  if (layer.namedTextStyleId) {
    const style = stylesById.get(layer.namedTextStyleId);
    if (style && isTextStyle(style)) next = applyNamedTextStyle(next, style);
  }
  if (layer.colorStyleIds) {
    for (const slot of COLOR_STYLE_SLOTS) {
      const styleId = layer.colorStyleIds[slot];
      if (!styleId) continue;
      const style = stylesById.get(styleId);
      if (style && isColorStyle(style)) next = applyNamedColorStyle(next, style, slot);
    }
  }
  return next;
}

export function layerLinksStyle(layer: Layer, styleId: string): boolean {
  if (layer.namedTextStyleId === styleId) return true;
  return Object.values(layer.colorStyleIds ?? {}).includes(styleId);
}

export function unlinkNamedStyle(layer: Layer, styleId: string): Layer {
  let next = layer;
  if (next.namedTextStyleId === styleId) next = clearNamedTextStyle(next);
  const linkedSlots = { ...next.colorStyleIds };
  for (const slot of COLOR_STYLE_SLOTS) {
    if (linkedSlots[slot] === styleId) next = clearNamedColorStyle(next, slot);
  }
  return next;
}
