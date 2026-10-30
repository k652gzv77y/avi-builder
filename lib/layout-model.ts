/**
 * Framer-style layout model for the editor.
 *
 * Frames position children absolutely. Stacks are the same container with
 * flex layout, and children participate in flow (relative). Sizing modes are
 * Fill, Fit, Fixed, Relative, and Viewport. Desktop is the primary breakpoint;
 * tablet and phone store class overrides only.
 */

import type { Breakpoint, DesignProperties, Layer, UIState } from '@/types';
import { getBreakpointPrefix } from '@/lib/breakpoint-utils';
import { buildStyledUpdate } from '@/lib/layer-style-utils';
import {
  getInheritedValue,
  propertyToClass,
  setBreakpointClass,
} from '@/lib/tailwind-class-mapper';

export type SizingAxis = 'width' | 'height';
export type SizingMode = 'fill' | 'fit' | 'fixed' | 'relative' | 'viewport';
export type LayoutMode = 'frame' | 'stack' | 'grid' | 'hidden';

export const SIZING_MODES: SizingMode[] = ['fill', 'fit', 'fixed', 'relative', 'viewport'];

export const SIZING_MODE_LABELS: Record<SizingMode, string> = {
  fill: 'Fill',
  fit: 'Fit',
  fixed: 'Fixed',
  relative: 'Relative',
  viewport: 'Viewport',
};

const VIEWPORT_UNIT = /(svh|dvh|lvh|svw|dvw|vw|vh)$/i;

export interface DesignUpdate {
  category: keyof DesignProperties;
  property: string;
  value: string | null;
}

export function toClassList(classes: Layer['classes'] | undefined): string[] {
  if (Array.isArray(classes)) return classes.filter(Boolean);
  return (classes || '').split(' ').filter(Boolean);
}

export function isCascadeBase(breakpoint: Breakpoint, uiState: UIState = 'neutral'): boolean {
  return breakpoint === 'desktop' && uiState === 'neutral';
}

export function isBreakpointOverride(source: Breakpoint | null, active: Breakpoint): boolean {
  return active !== 'desktop' && source === active;
}

export function editorBreakpointLabel(breakpoint: Breakpoint): string {
  if (breakpoint === 'mobile') return 'Phone';
  if (breakpoint === 'tablet') return 'Tablet';
  return 'Desktop';
}

/**
 * Drop every class that belongs to a smaller breakpoint so the layer falls
 * back to the desktop cascade. Desktop itself is the base and is left intact.
 */
export function stripBreakpointOverrides(classes: string[], breakpoint: Breakpoint): string[] {
  const prefix = getBreakpointPrefix(breakpoint);
  if (!prefix) return classes;
  return classes.filter((cls) => !cls.startsWith(prefix));
}

export function resolveSizingMode(value: string | undefined | null): SizingMode {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return 'fixed';
  if (raw === '100%' || raw === 'full' || raw === '1/1') return 'fill';
  if (raw === 'fit' || raw === 'fit-content' || raw === 'auto' || raw === 'min' || raw === 'max') return 'fit';
  if (raw === 'screen' || VIEWPORT_UNIT.test(raw)) return 'viewport';
  if (raw.endsWith('%') || /^\d+\/[1-9]\d*$/.test(raw)) return 'relative';
  return 'fixed';
}

/** Number (or fraction) shown in the inspector for the active sizing mode. */
export function sizingFieldValue(value: string | undefined | null): string {
  const raw = (value || '').trim();
  const mode = resolveSizingMode(raw);
  if (mode === 'fill' || mode === 'fit') return '';
  if (mode === 'viewport') {
    if (raw.toLowerCase() === 'screen') return '100';
    return raw.replace(VIEWPORT_UNIT, '');
  }
  if (mode === 'relative') {
    if (raw.endsWith('%')) return raw.slice(0, -1);
    return raw;
  }
  if (raw.toLowerCase().endsWith('px')) return raw.slice(0, -2);
  return raw;
}

export function sizingUnitLabel(mode: SizingMode, axis: SizingAxis): string | null {
  if (mode === 'fixed') return 'px';
  if (mode === 'relative') return '%';
  if (mode === 'viewport') return axis === 'height' ? 'svh' : 'vw';
  return null;
}

/** Value to store when the user picks a sizing mode. Empty input gets a default. */
export function sizingValueForMode(
  mode: SizingMode,
  axis: SizingAxis,
  previous?: string | null,
): string {
  if (mode === 'fill') return '100%';
  if (mode === 'fit') return 'fit';
  if (mode === 'relative') return '50%';
  if (mode === 'viewport') return axis === 'height' ? '100svh' : '100vw';
  const prev = (previous || '').trim();
  if (prev && resolveSizingMode(prev) === 'fixed') return prev;
  return '100';
}

/** Value to store while typing in Fixed, Relative, or Viewport. */
export function sizingValueFromInput(
  mode: SizingMode,
  input: string,
  axis: SizingAxis,
): string | null {
  const cleaned = input.replace(/\s+/g, '');
  if (mode === 'fill') return '100%';
  if (mode === 'fit') return 'fit';
  if (!cleaned) return null;
  if (mode === 'relative') {
    if (cleaned.includes('/')) return cleaned.replace(/%/g, '');
    return `${cleaned.replace(/%/g, '')}%`;
  }
  if (mode === 'viewport') {
    const amount = cleaned.replace(VIEWPORT_UNIT, '').replace(/%/g, '');
    if (!amount) return null;
    return axis === 'height' ? `${amount}svh` : `${amount}vw`;
  }
  return cleaned;
}

export function layoutModeFromDisplay(display: string | undefined | null): LayoutMode {
  const value = (display || '').toLowerCase();
  if (value === 'hidden' || value === 'none') return 'hidden';
  if (value === 'grid' || value === 'inline-grid') return 'grid';
  if (value === 'flex' || value === 'inline-flex') return 'stack';
  return 'frame';
}

export function readInheritedClass(
  layer: Layer,
  property: string,
  breakpoint: Breakpoint = 'desktop',
): string | undefined {
  const classes = toClassList(layer.classes);
  if (classes.length > 0) {
    const inherited = getInheritedValue(classes, property, breakpoint, 'neutral');
    if (inherited.value) return inherited.value;
    return undefined;
  }
  return undefined;
}

export function readLayerPosition(layer: Layer, breakpoint: Breakpoint = 'desktop'): string | undefined {
  const fromClass = readInheritedClass(layer, 'position', breakpoint);
  if (fromClass) return fromClass;
  return layer.design?.positioning?.position;
}

/**
 * How a container lays out direct children.
 * `flow` is an unstyled block (including the page body) that should keep
 * document flow until the user explicitly switches it to a frame.
 */
export function containerLayoutKind(
  layer: Layer,
  breakpoint: Breakpoint = 'desktop',
): LayoutMode | 'flow' {
  if (layer.name === 'body') return 'flow';
  const displayClass = readInheritedClass(layer, 'display', breakpoint);
  const display = displayClass || layer.design?.layout?.display;
  const mode = layoutModeFromDisplay(display);
  if (mode !== 'frame') return mode;
  const position = readLayerPosition(layer, breakpoint);
  if (position === 'relative' || position === 'absolute') return 'frame';
  return 'flow';
}

export function shouldRemapChildPosition(
  position: string | undefined,
  target: 'absolute' | 'relative',
): boolean {
  if (position === 'fixed' || position === 'sticky') return false;
  return position !== target;
}

function mergeDesignValues(design: DesignProperties, updates: DesignUpdate[]): DesignProperties {
  const next: DesignProperties = { ...design };
  for (const update of updates) {
    const categoryData: Record<string, unknown> = { ...(next[update.category] as Record<string, unknown> | undefined) };
    if (!update.value) {
      delete categoryData[update.property];
    } else {
      categoryData[update.property] = update.value;
      categoryData.isActive = true;
    }
    next[update.category] = categoryData as DesignProperties[typeof update.category];
  }
  return next;
}

/**
 * Apply design edits. Desktop + neutral writes the base design object.
 * Smaller breakpoints and UI states only add or remove prefixed classes,
 * so the cascade keeps the primary value.
 */
export function applyBreakpointDesign(
  layer: Layer,
  updates: DesignUpdate[],
  breakpoint: Breakpoint,
  uiState: UIState = 'neutral',
): Partial<Layer> {
  const writeBase = isCascadeBase(breakpoint, uiState);
  const nextDesign = writeBase
    ? mergeDesignValues(layer.design || {}, updates)
    : (layer.design || {});

  let classes = toClassList(layer.classes);
  for (const update of updates) {
    const newClass = update.value
      ? propertyToClass(update.category, update.property, update.value)
      : null;
    classes = setBreakpointClass(classes, update.property, newClass, breakpoint, uiState);
  }

  return buildStyledUpdate(layer, {
    design: nextDesign,
    classes: classes.join(' '),
  });
}

export function placeChildInParent(child: Layer, parent: Layer): Layer {
  const kind = containerLayoutKind(parent);
  const position = readLayerPosition(child);
  if (position === 'fixed' || position === 'sticky') return child;

  if (kind === 'frame') {
    if (position === 'absolute') return child;
    const partial = applyBreakpointDesign(
      child,
      [{ category: 'positioning', property: 'position', value: 'absolute' }],
      'desktop',
    );
    return { ...child, ...partial };
  }

  if ((kind === 'stack' || kind === 'grid') && position === 'absolute') {
    const partial = applyBreakpointDesign(
      child,
      [{ category: 'positioning', property: 'position', value: 'relative' }],
      'desktop',
    );
    return { ...child, ...partial };
  }

  return child;
}
