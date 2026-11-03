/**
 * Spacing and alignment for children of a stack or grid.
 *
 * Free-form layers stay on the absolute align/distribute path. In-flow
 * children edit the container: the cross axis is align-self on the
 * selection, and the main axis is justify-content on the parent.
 */

import type { Breakpoint, Layer, UIState } from '@/types';
import { isFreeformDraggable } from '@/lib/canvas-freeform';
import { findLayerById, findLayerWithParent, updateLayerProps } from '@/lib/layer-utils';
import {
  applyBreakpointDesign,
  containerLayoutKind,
  readInheritedClass,
} from '@/lib/layout-model';

export type StackAxis = 'row' | 'column';
export type SpacingContainerKind = 'stack' | 'grid';
export type StackCrossAlign = 'start' | 'center' | 'end' | 'stretch';
export type StackMainAlign = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
export type PaddingMode = 'all' | 'individual';

export interface StackSelection {
  parentId: string;
  childIds: string[];
  axis: StackAxis;
  kind: SpacingContainerKind;
}

export type StackSelectionAction =
  | { type: 'cross'; value: StackCrossAlign }
  | { type: 'main'; value: StackMainAlign };

const PADDING_SIDES = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const;

export type PaddingSideProperty = typeof PADDING_SIDES[number];

export interface PaddingEdit {
  property: PaddingSideProperty | 'paddingMode';
  value: string | null;
}

export function spacingContainerKind(layer: Layer | null | undefined): SpacingContainerKind | null {
  if (!layer) return null;
  const kind = containerLayoutKind(layer);
  return kind === 'stack' || kind === 'grid' ? kind : null;
}

/** Accepts stored design values (`column`) and Tailwind classes (`flex-col`). */
export function stackAxisFromDirection(flexDirection: string | undefined | null): StackAxis {
  const value = (flexDirection || '').toLowerCase();
  if (
    value === 'column'
    || value === 'column-reverse'
    || value === 'flex-col'
    || value === 'flex-col-reverse'
    || value === 'col'
    || value === 'col-reverse'
  ) {
    return 'column';
  }
  return 'row';
}

function readFlexDirection(layer: Layer): string | undefined {
  return readInheritedClass(layer, 'flexDirection') || layer.design?.layout?.flexDirection;
}

/**
 * Two or more in-flow children of the same stack or grid.
 * Absolute siblings and children of different parents are left out.
 */
export function resolveStackSelection(layers: Layer[], selectedIds: string[]): StackSelection | null {
  const groups = new Map<string, StackSelection>();

  for (const id of selectedIds) {
    const found = findLayerWithParent(layers, id);
    if (!found?.parent) continue;
    if (isFreeformDraggable(found.layer, found.parent)) continue;
    const kind = spacingContainerKind(found.parent);
    if (!kind) continue;

    const existing = groups.get(found.parent.id);
    if (existing) {
      if (!existing.childIds.includes(id)) existing.childIds.push(id);
      continue;
    }

    groups.set(found.parent.id, {
      parentId: found.parent.id,
      childIds: [id],
      axis: stackAxisFromDirection(readFlexDirection(found.parent)),
      kind,
    });
  }

  if (groups.size !== 1) return null;
  const selection = [...groups.values()][0];
  if (selection.childIds.length < 2) return null;
  return selection;
}

function classString(classes: Layer['classes'] | undefined): string {
  return Array.isArray(classes) ? classes.join(' ') : (classes || '');
}

function classesChanged(layer: Layer, partial: Partial<Layer>): boolean {
  return classString(layer.classes) !== classString(partial.classes);
}

export function applyStackSelectionAlignment(
  layers: Layer[],
  selection: StackSelection,
  action: StackSelectionAction,
  breakpoint: Breakpoint = 'desktop',
  uiState: UIState = 'neutral',
): Layer[] {
  if (action.type === 'main') {
    const parent = findLayerById(layers, selection.parentId);
    if (!parent) return layers;
    const partial = applyBreakpointDesign(
      parent,
      [{ category: 'layout', property: 'justifyContent', value: action.value }],
      breakpoint,
      uiState,
    );
    if (!classesChanged(parent, partial)) return layers;
    return updateLayerProps(layers, selection.parentId, partial);
  }

  let next = layers;
  let didChange = false;
  for (const id of selection.childIds) {
    const layer = findLayerById(next, id);
    if (!layer) continue;
    const partial = applyBreakpointDesign(
      layer,
      [{ category: 'layout', property: 'alignSelf', value: action.value }],
      breakpoint,
      uiState,
    );
    if (!classesChanged(layer, partial)) continue;
    next = updateLayerProps(next, id, partial);
    didChange = true;
  }
  return didChange ? next : layers;
}

export function resolvePaddingMode(
  stored: string | undefined | null,
  sides: string[],
): PaddingMode {
  if (stored === 'all' || stored === 'individual') return stored;
  const present = sides.filter((side) => side !== '');
  if (present.length <= 1) return 'all';
  return present.every((side) => side === present[0]) ? 'all' : 'individual';
}

/** Empty string when the four sides are not the same, including a missing side. */
export function uniformPaddingValue(sides: string[]): string {
  if (sides.length === 0) return '';
  return sides.every((side) => side === sides[0]) ? sides[0] : '';
}

export function paddingEditPlan(
  nextMode: PaddingMode,
  sides: Record<PaddingSideProperty, string>,
): PaddingEdit[] {
  if (nextMode === 'individual') {
    const present = PADDING_SIDES.map((key) => sides[key]).filter((side) => side !== '');
    const fill = present[0] || null;
    return [
      ...PADDING_SIDES.map((property) => ({
        property,
        value: sides[property] || fill,
      })),
      { property: 'paddingMode', value: 'individual' },
    ];
  }

  const counts = new Map<string, number>();
  for (const key of PADDING_SIDES) {
    const value = sides[key];
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  let uniform: string | null = null;
  let best = 0;
  for (const [value, count] of counts) {
    if (count > best) {
      uniform = value;
      best = count;
    }
  }

  return [
    ...PADDING_SIDES.map((property) => ({ property, value: uniform })),
    { property: 'paddingMode', value: 'all' },
  ];
}
