/**
 * Component property bindings.
 *
 * A stack property (Direction, Gap, Padding, Distribute, Align) can be turned
 * into a Variable from the + control. Many layers share one variable. Instances
 * override the value per breakpoint, using the Sprint 1 desktop-first cascade.
 *
 * Collection List, Detail, and Fetch reuse this source list. Pass items to
 * enable them. Without items they stay disabled.
 */

import type {
  Breakpoint,
  ComponentVariable,
  Layer,
  StackVariableKey,
  StackVariableValue,
} from '@/types';
import { applyBreakpointDesign, type DesignUpdate } from '@/lib/layout-model';

export const STACK_VARIABLE_KEYS: StackVariableKey[] = [
  'direction',
  'gap',
  'padding',
  'distribute',
  'align',
];

export const STACK_VARIABLE_LABELS: Record<StackVariableKey, string> = {
  direction: 'Direction',
  gap: 'Gap',
  padding: 'Padding',
  distribute: 'Distribute',
  align: 'Align',
};

export function isStackVariableValue(value: unknown): value is StackVariableValue {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (typeof record.value !== 'string') return false;
  if ('type' in record || 'variant_id' in record || 'src' in record) return false;
  return true;
}

export function stackValuesEqual(a: StackVariableValue, b: StackVariableValue): boolean {
  if (a.value !== b.value) return false;
  const aTablet = a.breakpoints?.tablet;
  const bTablet = b.breakpoints?.tablet;
  const aMobile = a.breakpoints?.mobile;
  const bMobile = b.breakpoints?.mobile;
  return aTablet === bTablet && aMobile === bMobile;
}

/** Desktop base, then tablet, then phone. `isOverride` is true only for a value set on this breakpoint. */
export function readStackBreakpoint(
  current: StackVariableValue | undefined,
  breakpoint: Breakpoint,
): { value: string; isOverride: boolean } {
  const desktop = current?.value ?? '';
  if (!current || breakpoint === 'desktop') return { value: desktop, isOverride: false };
  const own = current.breakpoints?.[breakpoint];
  if (own !== undefined) return { value: own, isOverride: true };
  if (breakpoint === 'mobile' && current.breakpoints?.tablet !== undefined) {
    return { value: current.breakpoints.tablet, isOverride: false };
  }
  return { value: desktop, isOverride: false };
}

export function writeStackBreakpoint(
  current: StackVariableValue,
  breakpoint: Breakpoint,
  raw: string,
): StackVariableValue {
  const cleaned = raw.trim();
  if (breakpoint === 'desktop') {
    return { ...current, value: cleaned };
  }
  const breakpoints = { ...(current.breakpoints ?? {}) };
  if (!cleaned) {
    delete breakpoints[breakpoint];
  } else {
    breakpoints[breakpoint] = cleaned;
  }
  return {
    ...current,
    breakpoints: Object.keys(breakpoints).length > 0 ? breakpoints : undefined,
  };
}

export function masterStackValue(layer: Layer, key: StackVariableKey): string {
  switch (key) {
    case 'direction':
      return layer.design?.layout?.flexDirection || 'row';
    case 'gap':
      return layer.design?.layout?.gap || '';
    case 'align':
      return layer.design?.layout?.alignItems || 'start';
    case 'distribute':
      return layer.design?.layout?.justifyContent || 'start';
    case 'padding':
      return layer.design?.spacing?.paddingTop || '';
    default:
      return '';
  }
}

export function stackDesignUpdates(key: StackVariableKey, raw: string): DesignUpdate[] {
  const value = raw.trim() ? raw.trim() : null;
  if (key === 'direction') return [{ category: 'layout', property: 'flexDirection', value }];
  if (key === 'gap') return [{ category: 'layout', property: 'gap', value }];
  if (key === 'distribute') return [{ category: 'layout', property: 'justifyContent', value }];
  if (key === 'align') return [{ category: 'layout', property: 'alignItems', value }];
  return (['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const).map((property) => ({
    category: 'spacing' as const,
    property,
    value,
  }));
}

/** Write a stack variable onto a layer for desktop plus any tablet/phone overrides. */
export function applyStackVariableToLayer(
  layer: Layer,
  key: StackVariableKey,
  stackValue: StackVariableValue,
): Layer {
  let next: Layer = {
    ...layer,
    ...applyBreakpointDesign(layer, stackDesignUpdates(key, stackValue.value ?? ''), 'desktop'),
  };
  if (stackValue.breakpoints?.tablet !== undefined) {
    next = {
      ...next,
      ...applyBreakpointDesign(next, stackDesignUpdates(key, stackValue.breakpoints.tablet), 'tablet'),
    };
  }
  if (stackValue.breakpoints?.mobile !== undefined) {
    next = {
      ...next,
      ...applyBreakpointDesign(next, stackDesignUpdates(key, stackValue.breakpoints.mobile), 'mobile'),
    };
  }
  return next;
}

export function resolveStackVariableValue(
  variableId: string,
  overrides: Layer['componentOverrides'] | undefined,
  variables: ComponentVariable[] | undefined,
): StackVariableValue | undefined {
  const override = overrides?.stack?.[variableId];
  if (isStackVariableValue(override)) return override;
  const variable = variables?.find(item => item.id === variableId);
  if (isStackVariableValue(variable?.default_value)) return variable.default_value;
  return undefined;
}

/** Apply every stack binding on one layer. Returns the same layer when nothing is bound. */
export function applyStackBindings(
  layer: Layer,
  overrides: Layer['componentOverrides'] | undefined,
  variables: ComponentVariable[] | undefined,
): Layer {
  const bindings = layer.stackBindings;
  if (!bindings) return layer;
  let next = layer;
  for (const key of STACK_VARIABLE_KEYS) {
    const variableId = bindings[key];
    if (!variableId) continue;
    const value = resolveStackVariableValue(variableId, overrides, variables);
    if (!value) continue;
    next = applyStackVariableToLayer(next, key, value);
  }
  return next;
}

export function applyStackBindingsToTree(
  layers: Layer[],
  overrides: Layer['componentOverrides'] | undefined,
  variables: ComponentVariable[] | undefined,
): Layer[] {
  return layers.map(layer => {
    const next = applyStackBindings(layer, overrides, variables);
    if (!layer.children?.length) return next;
    return {
      ...next,
      children: applyStackBindingsToTree(layer.children, overrides, variables),
    };
  });
}

/**
 * Push one variable's value onto every layer in the tree that binds that property.
 * Returns the original array when nothing matched.
 */
export function applyStackValueToBoundLayers(
  layers: Layer[],
  variableId: string,
  key: StackVariableKey,
  stackValue: StackVariableValue,
): Layer[] {
  let changed = false;
  const next = layers.map(layer => {
    let child = layer;
    if (layer.stackBindings?.[key] === variableId) {
      child = applyStackVariableToLayer(layer, key, stackValue);
      changed = true;
    }
    if (layer.children?.length) {
      const children = applyStackValueToBoundLayers(layer.children, variableId, key, stackValue);
      if (children !== layer.children) {
        child = { ...child, children };
        changed = true;
      }
    }
    return child;
  });
  return changed ? next : layers;
}

export function uniqueName(existing: string[], base: string): string {
  const names = new Set(existing);
  if (!names.has(base)) return base;
  let index = 2;
  while (names.has(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}

export interface BindingSourceItem {
  id: string;
  name: string;
  icon?: string;
}

/**
 * One section in the + bindings menu. `cms` and `fetch` stay disabled until
 * a caller passes items and onSelect. Variables keep their Sprint 2 names.
 */
export interface BindingSource {
  id: string;
  kind: 'variable' | 'cms' | 'fetch';
  label: string;
  enabled: boolean;
  unavailableReason?: string;
  items?: BindingSourceItem[];
  onCreate?: () => void;
  onSelect?: (id: string) => void;
}

function cmsSourceOf(id: string): 'page' | 'collection' | 'global' | null {
  const parts = id.split(':');
  if (parts.length !== 4 || parts[0] !== 'cms') return null;
  if (parts[1] === 'page' || parts[1] === 'collection' || parts[1] === 'global') return parts[1];
  return null;
}

function splitCmsItems(items: BindingSourceItem[]) {
  const collection: BindingSourceItem[] = [];
  const detail: BindingSourceItem[] = [];
  const globals: BindingSourceItem[] = [];
  for (const item of items) {
    const source = cmsSourceOf(item.id);
    if (source === 'page') detail.push(item);
    else if (source === 'global') globals.push(item);
    else collection.push(item);
  }
  return { collection, detail, globals };
}

export function defaultBindingSources(
  variable: {
    items?: BindingSourceItem[];
    onCreate?: () => void;
    onSelect?: (id: string) => void;
    /** When false, Variables stay in the menu but cannot be chosen. */
    enabled?: boolean;
  },
  extras?: {
    cms?: { items?: BindingSourceItem[]; onSelect?: (id: string) => void };
    fetch?: { items?: BindingSourceItem[]; onSelect?: (id: string) => void; onCreate?: () => void };
  },
): BindingSource[] {
  const cmsItems = extras?.cms?.items ?? [];
  const fetchItems = extras?.fetch?.items ?? [];
  const fetchEnabled = fetchItems.length > 0 || !!extras?.fetch?.onCreate;
  const split = splitCmsItems(cmsItems);
  const cmsSelect = extras?.cms?.onSelect;

  const cmsSource = (
    id: string,
    label: string,
    items: BindingSourceItem[],
    unavailableReason: string,
  ): BindingSource => {
    const enabled = items.length > 0 && !!cmsSelect;
    return {
      id,
      kind: 'cms',
      label,
      enabled,
      items: enabled ? items : undefined,
      onSelect: enabled ? cmsSelect : undefined,
      unavailableReason: enabled ? undefined : unavailableReason,
    };
  };

  const sources: BindingSource[] = [
    {
      id: 'variables',
      kind: 'variable',
      label: 'Variables',
      enabled: variable.enabled !== false,
      unavailableReason: variable.enabled === false
        ? 'Variables are available while editing a component.'
        : undefined,
      items: variable.items,
      onCreate: variable.onCreate,
      onSelect: variable.onSelect,
    },
    cmsSource(
      'collection-list',
      'Collection List',
      split.collection,
      'Place this layer inside a Collection List to bind its fields.',
    ),
    cmsSource(
      'detail',
      'Detail',
      split.detail,
      'Open a Detail Page to bind its fields.',
    ),
  ];

  if (split.globals.length > 0) {
    sources.push(cmsSource(
      'globals',
      'Globals',
      split.globals,
      'Globals are not available.',
    ));
  }

  sources.push({
    id: 'fetch',
    kind: 'fetch',
    label: 'Fetch',
    enabled: fetchEnabled,
    items: fetchItems,
    onSelect: extras?.fetch?.onSelect,
    onCreate: extras?.fetch?.onCreate,
    unavailableReason: 'Fetch a single collection value, with Loading and Error variants.',
  });

  return sources;
}
