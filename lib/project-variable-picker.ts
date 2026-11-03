/**
 * Project variable picker.
 *
 * Color tokens (`color:var(--id)`) and site variables (globals) share one
 * list. Number bindings keep the design value as a literal fallback and
 * resolve the variable when a page renders, the same way CMS fields do.
 * Formulas are not evaluated here.
 */

import { applyBreakpointDesign, type DesignUpdate } from '@/lib/layout-model';
import { parseVariablePath, type VariableCollectionId } from '@/lib/variable-collections';
import type {
  DesignColorVariable,
  FieldVariable,
  GlobalVariableType,
  Layer,
  StyleBindingKey,
  StyleVariableBinding,
} from '@/types';

export type PickerProperty = 'fill' | 'color' | 'opacity' | 'text' | 'width' | 'height';

export interface ProjectVariableOption {
  id: string;
  kind: 'color' | 'global';
  sourceId: string;
  name: string;
  leaf: string;
  folder: string | null;
  type: string;
  value: string | null;
}

export interface ProjectVariableGroup {
  id: string;
  label: string;
  items: ProjectVariableOption[];
}

export interface VariableCatalogInput {
  colorVariables?: Array<{ id: string; name: string; value: string }>;
  globals?: Array<{ id: string; name: string; type: string; value: string | null }>;
}

const TYPE_LABELS: Record<string, string> = {
  color: 'Color',
  text: 'Text',
  rich_text: 'Rich text',
  number: 'Number',
  date: 'Date',
  link: 'Link',
  image: 'Image',
};

const COLOR_TOKEN = /^color:var\(--([^)]+)\)$/;
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SIZE_WITH_UNIT = /^-?\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh|svh|dvh)$/;

export function variableTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function compatibleTypes(property: PickerProperty, allowRichText = false): string[] {
  if (property === 'fill' || property === 'color') return ['color-token', 'color'];
  if (property === 'text') {
    return allowRichText
      ? ['text', 'rich_text', 'number', 'date']
      : ['text', 'number', 'date'];
  }
  return ['number'];
}

export function optionMatchesProperty(
  option: ProjectVariableOption,
  property: PickerProperty,
  allowRichText = false,
): boolean {
  const types = compatibleTypes(property, allowRichText);
  if (option.kind === 'color') return types.includes('color-token');
  return types.includes(option.type);
}

export function projectVariableOption(
  kind: 'color' | 'global',
  sourceId: string,
  name: string,
  type: string,
  value: string | null,
): ProjectVariableOption {
  const path = parseVariablePath(name);
  return {
    id: `${kind}:${sourceId}`,
    kind,
    sourceId,
    name,
    leaf: path.leaf || name,
    folder: path.folder,
    type,
    value,
  };
}

export function buildProjectVariableOptions(
  input: VariableCatalogInput,
  property: PickerProperty,
  allowRichText = false,
): ProjectVariableOption[] {
  const types = new Set(compatibleTypes(property, allowRichText));
  const options: ProjectVariableOption[] = [];
  if (types.has('color-token')) {
    for (const color of input.colorVariables ?? []) {
      options.push(projectVariableOption('color', color.id, color.name, 'color', color.value));
    }
  }
  for (const global of input.globals ?? []) {
    if (!types.has(global.type)) continue;
    options.push(projectVariableOption('global', global.id, global.name, global.type, global.value));
  }
  return options.sort((a, b) => a.leaf.localeCompare(b.leaf) || a.name.localeCompare(b.name));
}

export function filterProjectVariables(
  options: ProjectVariableOption[],
  query: string,
): ProjectVariableOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(item => (
    item.name.toLowerCase().includes(q)
    || item.leaf.toLowerCase().includes(q)
    || (item.folder?.toLowerCase().includes(q) ?? false)
    || variableTypeLabel(item.type).toLowerCase().includes(q)
  ));
}

function byLeaf(a: ProjectVariableOption, b: ProjectVariableOption): number {
  return a.leaf.localeCompare(b.leaf) || a.name.localeCompare(b.name);
}

/** Folders win when any variable has one. Otherwise group by type. */
export function groupProjectVariables(
  options: ProjectVariableOption[],
  query = '',
): ProjectVariableGroup[] {
  const filtered = filterProjectVariables(options, query);
  const hasFolder = filtered.some(item => item.folder);
  if (!hasFolder) {
    const byType = new Map<string, ProjectVariableOption[]>();
    for (const item of filtered) {
      const list = byType.get(item.type) ?? [];
      list.push(item);
      byType.set(item.type, list);
    }
    return [...byType.entries()]
      .map(([type, items]) => ({
        id: `type:${type}`,
        label: variableTypeLabel(type),
        items: [...items].sort(byLeaf),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  const byFolder = new Map<string, ProjectVariableOption[]>();
  for (const item of filtered) {
    const key = item.folder ?? '';
    const list = byFolder.get(key) ?? [];
    list.push(item);
    byFolder.set(key, list);
  }
  return [...byFolder.entries()]
    .map(([folder, items]) => ({
      id: folder ? `folder:${folder}` : 'ungrouped',
      label: folder || 'No folder',
      items: [...items].sort(byLeaf),
    }))
    .sort((a, b) => {
      if (a.id === 'ungrouped') return -1;
      if (b.id === 'ungrouped') return 1;
      return a.label.localeCompare(b.label);
    });
}

export function colorTokenValue(id: string): string {
  return `color:var(--${id})`;
}

export function readColorTokenId(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(COLOR_TOKEN);
  return match ? match[1] : null;
}

export function literalColorSeed(value: string | null | undefined): string {
  if (value && HEX_COLOR.test(value)) return value;
  return '#808080';
}

export function colorDesignKey(property: 'fill' | 'color'): 'backgroundColor' | 'color' {
  return property === 'fill' ? 'backgroundColor' : 'color';
}

export function readGlobalColorId(binding: DesignColorVariable | undefined): string | null {
  const field = binding?.mode === 'solid' ? binding.field : undefined;
  if (!field || field.data?.source !== 'global') return null;
  return field.data.global_id || field.data.field_id || null;
}

export function globalColorField(globalId: string): FieldVariable {
  return {
    type: 'field',
    data: {
      field_id: globalId,
      field_type: 'color',
      relationships: [],
      source: 'global',
      global_id: globalId,
    },
  };
}

export function designColorVariablesPatch(
  layer: Layer,
  property: 'backgroundColor' | 'color',
  field: FieldVariable | undefined,
): Pick<Layer, 'variables'> {
  const design: NonNullable<NonNullable<Layer['variables']>['design']> = {
    ...(layer.variables?.design ?? {}),
  };
  if (field) {
    const current = design[property];
    design[property] = {
      ...(current ?? { type: 'color', mode: 'solid' }),
      type: 'color',
      mode: 'solid',
      field,
    };
  } else {
    delete design[property];
  }
  return {
    variables: {
      ...layer.variables,
      design: Object.keys(design).length > 0 ? design : undefined,
    },
  };
}

export function boundProjectVariableId(
  property: PickerProperty,
  layer: Layer | null | undefined,
  designValue?: string | null,
): string | null {
  if (property === 'fill' || property === 'color') {
    const tokenId = readColorTokenId(designValue);
    if (tokenId) return `color:${tokenId}`;
    const globalId = readGlobalColorId(layer?.variables?.design?.[colorDesignKey(property)]);
    return globalId ? `global:${globalId}` : null;
  }
  if (property === 'opacity' || property === 'width' || property === 'height') {
    const globalId = layer?.variables?.style?.[property]?.globalId;
    return globalId ? `global:${globalId}` : null;
  }
  return null;
}

export function styleBindingPatch(
  layer: Layer,
  key: StyleBindingKey,
  binding: StyleVariableBinding | undefined,
): Pick<Layer, 'variables'> {
  const style = { ...(layer.variables?.style ?? {}) };
  if (binding) style[key] = binding;
  else delete style[key];
  return {
    variables: {
      ...layer.variables,
      style: Object.keys(style).length > 0 ? style : undefined,
    },
  };
}

export function collectionIdForProperty(property: PickerProperty): VariableCollectionId {
  return property === 'fill' || property === 'color' ? 'colors' : 'site';
}

export function createTypeForProperty(
  property: PickerProperty,
  allowRichText = false,
): GlobalVariableType {
  if (property === 'fill' || property === 'color') return 'color';
  if (property === 'opacity' || property === 'width' || property === 'height') return 'number';
  return allowRichText ? 'rich_text' : 'text';
}

export function lockTypeForProperty(property: PickerProperty): boolean {
  return property === 'opacity' || property === 'width' || property === 'height';
}

export function mergeVariableFolders(stored: string[] | undefined, names: string[]): string[] {
  const found = names
    .map(name => parseVariablePath(name).folder)
    .filter((folder): folder is string => !!folder);
  return [...new Set([...(stored ?? []), ...found].map(folder => folder.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

/** 0–100. A decimal at or below 1 is treated as a fraction (`0.5` → `50`). */
export function opacityFromVariable(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const cleaned = raw.trim().replace(/%$/, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  const percent = value <= 1 && cleaned.includes('.') ? Math.round(value * 100) : Math.round(value);
  return String(Math.min(100, Math.max(0, percent)));
}

/** Plain numbers become pixels in the class mapper. Units already present are kept. */
export function sizeFromVariable(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (!cleaned) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(cleaned) || SIZE_WITH_UNIT.test(cleaned)) return cleaned;
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  return match ? match[0] : null;
}

function styleUpdates(
  layer: Layer,
  values: Record<string, string>,
): DesignUpdate[] {
  const style = layer.variables?.style;
  if (!style) return [];
  const updates: DesignUpdate[] = [];
  if (style.opacity?.globalId) {
    const next = opacityFromVariable(values[style.opacity.globalId]);
    if (next) updates.push({ category: 'effects', property: 'opacity', value: next });
  }
  if (style.width?.globalId) {
    const next = sizeFromVariable(values[style.width.globalId]);
    if (next) updates.push({ category: 'sizing', property: 'width', value: next });
  }
  if (style.height?.globalId) {
    const next = sizeFromVariable(values[style.height.globalId]);
    if (next) updates.push({ category: 'sizing', property: 'height', value: next });
  }
  return updates;
}

/** Apply number-variable bindings onto a copy of the layer. */
export function applyStyleBindings(
  layer: Layer,
  values: Record<string, string> | undefined,
): Layer {
  if (!values || !layer.variables?.style) return layer;
  const updates = styleUpdates(layer, values);
  if (updates.length === 0) return layer;
  return { ...layer, ...applyBreakpointDesign(layer, updates, 'desktop') };
}

export function applyStyleBindingsToTree(
  layers: Layer[],
  values: Record<string, string> | undefined,
): Layer[] {
  if (!values) return layers;
  let changed = false;
  const next = layers.map(layer => {
    let child = applyStyleBindings(layer, values);
    if (layer.children?.length) {
      const children = applyStyleBindingsToTree(layer.children, values);
      if (children !== layer.children) {
        child = child === layer ? { ...layer, children } : { ...child, children };
        changed = true;
      }
    }
    if (child !== layer) changed = true;
    return child;
  });
  return changed ? next : layers;
}
