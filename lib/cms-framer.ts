/**
 * Framer-style CMS helpers for Sprint 3.
 *
 * Collection List and Detail Page already store data in Supabase. These
 * helpers name that model the way the editor presents it, and add Fetch:
 * one collection field, with Loading and Error design variants.
 *
 * Writes stay out of this sprint. Fetch and CMS bindings only read.
 */

import { applyStackVariableToLayer, STACK_VARIABLE_KEYS } from '@/lib/component-bindings';
import type { BindingSourceItem } from '@/lib/component-bindings';
import { formatFieldValue, resolveFieldFromSources } from '@/lib/cms-variables-utils';
import { getFieldIcon, SIMPLE_TEXT_FIELD_TYPES } from '@/lib/collection-field-utils';
import type { FieldGroup } from '@/lib/collection-field-utils';
import { generateId } from '@/lib/utils';
import type {
  CollectionField,
  CollectionFieldType,
  DataBinding,
  DynamicRichTextVariable,
  DynamicTextVariable,
  FetchPreview,
  FetchSpec,
  Layer,
  StackVariableKey,
} from '@/types';

export const FETCH_LOADING_TEXT = 'Loading';
export const FETCH_ERROR_TEXT = 'Unable to load';

export interface FetchRuntime {
  specs: FetchSpec[];
  /** Resolved display string per fetch id. Missing when the read has not finished. */
  values: Record<string, string | undefined>;
  status: Record<string, 'loading' | 'ready' | 'error'>;
}

export interface BindingContext {
  collectionItemData?: Record<string, string>;
  pageItemData?: Record<string, string>;
  runtime?: FetchRuntime;
  /** Editor canvas honors Loading / Error. Published output does not. */
  honorPreview?: boolean;
}

const STACK_MEASUREMENT_KEYS = new Set<StackVariableKey>(['gap', 'padding']);

/** Detail pages use a `:slug` route token. The stored page slug stays `*`. */
export function detailRouteToken(fieldKey: string | undefined): string {
  if (!fieldKey) return ':slug';
  return `:${fieldKey}`;
}

export function encodeCmsBindingId(
  source: string,
  fieldId: string,
  layerId?: string,
): string {
  return `cms:${source}:${layerId ?? ''}:${fieldId}`;
}

export function parseCmsBindingId(id: string): {
  source: 'page' | 'collection' | 'global';
  layerId?: string;
  fieldId: string;
} | null {
  const parts = id.split(':');
  if (parts.length !== 4 || parts[0] !== 'cms') return null;
  const source = parts[1];
  if (source !== 'page' && source !== 'collection' && source !== 'global') return null;
  if (!parts[3]) return null;
  return {
    source,
    layerId: parts[2] || undefined,
    fieldId: parts[3],
  };
}

export function cmsItemsFromGroups(
  groups: FieldGroup[] | undefined,
  allowed: readonly string[] = SIMPLE_TEXT_FIELD_TYPES,
): BindingSourceItem[] {
  if (!groups) return [];
  const items: BindingSourceItem[] = [];
  for (const group of groups) {
    const source = group.source ?? 'collection';
    for (const field of group.fields) {
      if (!allowed.includes(field.type)) continue;
      const prefix = group.detail === 'Page fields'
        ? 'Detail Page'
        : group.label;
      items.push({
        id: encodeCmsBindingId(source, field.id, group.layerId),
        name: prefix ? `${prefix} · ${field.name}` : field.name,
        icon: getFieldIcon(field.type),
      });
    }
  }
  return items;
}

export function fetchItemsFromSpecs(specs: FetchSpec[]): BindingSourceItem[] {
  return specs.map(spec => ({
    id: spec.id,
    name: spec.name,
    icon: 'database',
  }));
}

export function defaultFetchText(spec: Pick<FetchSpec, 'loading_text' | 'error_text'>): {
  loading: string;
  error: string;
} {
  return {
    loading: spec.loading_text?.trim() || FETCH_LOADING_TEXT,
    error: spec.error_text?.trim() || FETCH_ERROR_TEXT,
  };
}

/**
 * Text shown for a Fetch. The editor honors the Loading / Error variant.
 * Published pages show the value, or the error label when the read failed.
 */
export function fetchDisplayText(
  spec: FetchSpec,
  runtime: FetchRuntime | undefined,
  honorPreview: boolean,
): string {
  const copy = defaultFetchText(spec);
  const preview = honorPreview ? (spec.preview ?? 'default') : 'default';
  if (preview === 'loading') return copy.loading;
  if (preview === 'error') return copy.error;
  const status = runtime?.status[spec.id];
  if (status === 'loading') return copy.loading;
  if (status === 'error') return copy.error;
  return runtime?.values[spec.id] ?? '';
}

export function specFromVariable(variable: {
  data?: Record<string, unknown>;
  label?: string;
}): FetchSpec | null {
  const data = variable.data;
  if (!data || typeof data.fetch_id !== 'string' || typeof data.field_id !== 'string') return null;
  const itemSource = data.item_source === 'detail' ? 'detail' : 'first';
  const preview = data.preview;
  return {
    id: data.fetch_id,
    name: typeof variable.label === 'string' ? variable.label : 'Fetch',
    collection_id: typeof data.collection_id === 'string' ? data.collection_id : '',
    field_id: data.field_id,
    field_type: typeof data.field_type === 'string' ? data.field_type : null,
    item_source: itemSource,
    preview: preview === 'loading' || preview === 'error' || preview === 'default' ? preview : 'default',
    loading_text: typeof data.loading_text === 'string' ? data.loading_text : undefined,
    error_text: typeof data.error_text === 'string' ? data.error_text : undefined,
  };
}

function specForFetchVariable(
  variable: { data?: Record<string, unknown>; label?: string },
  runtime: FetchRuntime | undefined,
): FetchSpec | null {
  const embedded = specFromVariable(variable);
  if (!embedded) return null;
  const live = runtime?.specs.find(spec => spec.id === embedded.id);
  return live ?? embedded;
}

function replaceFetchString(
  text: string,
  runtime: FetchRuntime | undefined,
  honorPreview: boolean,
): string {
  if (!text.includes('<ycode-inline-variable>')) return text;
  return text.replace(/<ycode-inline-variable>([\s\S]*?)<\/ycode-inline-variable>/g, (match, raw: string) => {
    try {
      const parsed = JSON.parse(raw.trim()) as { type?: string; data?: Record<string, unknown>; label?: string };
      if (parsed.type !== 'fetch') return match;
      const spec = specForFetchVariable(parsed, runtime);
      if (!spec) return match;
      return fetchDisplayText(spec, runtime, honorPreview);
    } catch {
      return match;
    }
  });
}

function replaceFetchDoc(
  node: unknown,
  runtime: FetchRuntime | undefined,
  honorPreview: boolean,
): unknown {
  if (!node || typeof node !== 'object') return node;
  const record = node as { type?: string; attrs?: { variable?: { type?: string; data?: Record<string, unknown>; label?: string } }; content?: unknown[] };
  if (record.type === 'dynamicVariable' && record.attrs?.variable?.type === 'fetch') {
    const spec = specForFetchVariable(record.attrs.variable, runtime);
    const text = spec ? fetchDisplayText(spec, runtime, honorPreview) : '';
    return { type: 'text', text };
  }
  if (!Array.isArray(record.content)) return node;
  let changed = false;
  const content = record.content.map(child => {
    const next = replaceFetchDoc(child, runtime, honorPreview);
    if (next !== child) changed = true;
    return next;
  });
  if (!changed) return node;
  return { ...record, content };
}

type TextVariable = DynamicTextVariable | DynamicRichTextVariable;

/** Resolve Fetch nodes for display. Returns the same variable when nothing is bound. */
export function presentFetchText<T extends TextVariable | undefined>(
  variable: T,
  runtime: FetchRuntime | undefined,
  honorPreview: boolean,
): T {
  if (!variable) return variable;
  if (variable.type === 'dynamic_text') {
    const content = variable.data.content;
    if (typeof content !== 'string') return variable;
    const next = replaceFetchString(content, runtime, honorPreview);
    if (next === content) return variable;
    return { ...variable, data: { ...variable.data, content: next } };
  }
  if (variable.type === 'dynamic_rich_text') {
    const content = replaceFetchDoc(variable.data.content, runtime, honorPreview);
    if (content === variable.data.content) return variable;
    return { ...variable, data: { ...variable.data, content } };
  }
  return variable;
}

export function fieldBindingDoc(
  field: { id: string; name: string; type: CollectionFieldType | string },
  source: 'page' | 'collection' | 'global',
  layerId?: string,
): DynamicRichTextVariable['data']['content'] {
  return {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{
        type: 'dynamicVariable',
        attrs: {
          label: field.name,
          variable: {
            type: 'field',
            label: field.name,
            data: {
              field_id: field.id,
              field_type: field.type,
              relationships: [],
              source,
              ...(layerId ? { collection_layer_id: layerId } : {}),
              ...(source === 'global' ? { global_id: field.id } : {}),
            },
          },
        },
      }],
    }],
  };
}

export function fetchBindingDoc(spec: FetchSpec): DynamicRichTextVariable['data']['content'] {
  return {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{
        type: 'dynamicVariable',
        attrs: {
          label: spec.name,
          variable: {
            type: 'fetch',
            label: spec.name,
            data: {
              fetch_id: spec.id,
              collection_id: spec.collection_id,
              field_id: spec.field_id,
              field_type: spec.field_type ?? null,
              item_source: spec.item_source,
              preview: spec.preview ?? 'default',
              loading_text: spec.loading_text ?? FETCH_LOADING_TEXT,
              error_text: spec.error_text ?? FETCH_ERROR_TEXT,
            },
          },
        },
      }],
    }],
  };
}

export interface ContentBinding {
  kind: 'cms' | 'fetch';
  id: string;
  name: string;
}

function readVariableNode(node: unknown): ContentBinding | null {
  if (!node || typeof node !== 'object') return null;
  const record = node as { type?: string; attrs?: { label?: string; variable?: { type?: string; label?: string; data?: Record<string, unknown> } } };
  if (record.type !== 'dynamicVariable') return null;
  const variable = record.attrs?.variable;
  if (!variable) return null;
  if (variable.type === 'fetch' && typeof variable.data?.fetch_id === 'string') {
    return {
      kind: 'fetch',
      id: variable.data.fetch_id,
      name: record.attrs?.label || variable.label || 'Fetch',
    };
  }
  if (variable.type === 'field' && typeof variable.data?.field_id === 'string') {
    return {
      kind: 'cms',
      id: variable.data.field_id,
      name: record.attrs?.label || variable.label || 'CMS',
    };
  }
  return null;
}

/** A text layer whose entire content is one CMS field or Fetch. */
export function readContentBinding(variable: TextVariable | undefined): ContentBinding | null {
  if (!variable || variable.type !== 'dynamic_rich_text') return null;
  const doc = variable.data.content as { content?: Array<{ content?: unknown[] }> } | undefined;
  const blocks = doc?.content;
  if (!blocks || blocks.length !== 1) return null;
  const inline = blocks[0]?.content;
  if (!inline || inline.length !== 1) return null;
  return readVariableNode(inline[0]);
}

function measurementLiteral(raw: string): string {
  const match = raw.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? match[0] : raw.trim();
}

export function resolveDataBinding(
  binding: DataBinding,
  context: BindingContext,
): string | undefined {
  if (binding.kind === 'fetch') {
    if (!binding.fetch_id) return undefined;
    const spec = context.runtime?.specs.find(item => item.id === binding.fetch_id);
    if (!spec) return context.runtime?.values[binding.fetch_id];
    return fetchDisplayText(spec, context.runtime, context.honorPreview !== false);
  }
  if (!binding.field_id) return undefined;
  const raw = resolveFieldFromSources(
    binding.field_id,
    binding.source,
    context.collectionItemData,
    context.pageItemData,
    binding.collection_layer_id,
  );
  if (raw == null || raw === '') return undefined;
  return raw;
}

/** Apply CMS / Fetch stack bindings onto one layer. Same layer when nothing is bound. */
export function applyDataBindings(layer: Layer, context: BindingContext): Layer {
  const bindings = layer.dataBindings;
  if (!bindings) return layer;
  let next = layer;
  for (const key of STACK_VARIABLE_KEYS) {
    const binding = bindings[key];
    if (!binding) continue;
    const raw = resolveDataBinding(binding, context);
    if (raw == null || raw === '') continue;
    const value = STACK_MEASUREMENT_KEYS.has(key) ? measurementLiteral(raw) : raw.trim();
    if (!value) continue;
    next = applyStackVariableToLayer(next, key, { value });
  }
  return next;
}

function presentLayerText(layer: Layer, runtime: FetchRuntime | undefined, honorPreview: boolean): Layer {
  const text = layer.variables?.text;
  if (!text) return layer;
  const presented = presentFetchText(text, runtime, honorPreview);
  if (presented === text) return layer;
  return {
    ...layer,
    variables: { ...layer.variables, text: presented },
  };
}

/**
 * Walk a resolved layer tree. Fetch text is substituted and stack bindings
 * pick up the current collection item. Published output ignores the editor
 * Loading / Error preview.
 */
export function applyCmsRuntime(
  layers: Layer[],
  runtime: FetchRuntime,
  pageItemData?: Record<string, string>,
  inheritedItem?: Record<string, string>,
): Layer[] {
  let changed = false;
  const next = layers.map(layer => {
    const itemData = layer._collectionItemValues ?? inheritedItem;
    let child = presentLayerText(layer, runtime, false);
    child = applyDataBindings(child, {
      collectionItemData: itemData,
      pageItemData,
      runtime,
      honorPreview: false,
    });
    if (layer.children?.length) {
      const children = applyCmsRuntime(layer.children, runtime, pageItemData, itemData);
      if (children !== layer.children) child = { ...child, children };
    }
    if (child !== layer) changed = true;
    return child;
  });
  return changed ? next : layers;
}

export function collectFetchSpecs(layers: Layer[], pageSpecs: FetchSpec[] | undefined): FetchSpec[] {
  const byId = new Map<string, FetchSpec>();
  for (const spec of pageSpecs ?? []) byId.set(spec.id, spec);
  const visit = (list: Layer[]) => {
    for (const layer of list) {
      const binding = readContentBinding(layer.variables?.text);
      if (binding?.kind === 'fetch' && !byId.has(binding.id)) {
        const embedded = embeddedSpecFromLayer(layer, binding.id);
        if (embedded) byId.set(embedded.id, embedded);
      }
      if (layer.children?.length) visit(layer.children);
    }
  };
  visit(layers);
  return [...byId.values()];
}

function embeddedSpecFromLayer(layer: Layer, fetchId: string): FetchSpec | null {
  const doc = layer.variables?.text?.type === 'dynamic_rich_text'
    ? layer.variables.text.data.content
    : null;
  const found = findFetchNode(doc, fetchId);
  if (!found) return null;
  return specFromVariable(found);
}

function findFetchNode(node: unknown, fetchId: string): { data?: Record<string, unknown>; label?: string } | null {
  if (!node || typeof node !== 'object') return null;
  const record = node as { type?: string; attrs?: { variable?: { type?: string; data?: Record<string, unknown>; label?: string } }; content?: unknown[] };
  if (record.type === 'dynamicVariable' && record.attrs?.variable?.type === 'fetch' && record.attrs.variable.data?.fetch_id === fetchId) {
    return record.attrs.variable;
  }
  if (!Array.isArray(record.content)) return null;
  for (const child of record.content) {
    const found = findFetchNode(child, fetchId);
    if (found) return found;
  }
  return null;
}

export function findCollectionEmptyState(layers: Layer[], collectionLayerId: string): Layer | null {
  for (const layer of layers) {
    if (layer.settings?.collectionEmptyFor === collectionLayerId) return layer;
    if (layer.children?.length) {
      const found = findCollectionEmptyState(layer.children, collectionLayerId);
      if (found) return found;
    }
  }
  return null;
}

/** Designed empty state for a Collection List. Shown when that list has no items. */
export function buildCollectionEmptyState(collectionLayerId: string): Layer {
  return {
    id: generateId('lyr'),
    name: 'div',
    customName: 'Empty',
    classes: ['flex', 'flex-col', 'items-center', 'justify-center', 'p-8', 'w-full', 'text-center'],
    settings: { collectionEmptyFor: collectionLayerId },
    attributes: { 'data-collection-empty-state': collectionLayerId },
    design: {
      layout: {
        isActive: true,
        display: 'Flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      },
    },
    variables: {
      conditionalVisibility: {
        groups: [{
          id: generateId('grp'),
          conditions: [{
            id: generateId('cnd'),
            source: 'page_collection',
            operator: 'has_no_items',
            collectionLayerId,
            collectionLayerName: 'Collection List',
          }],
        }],
      },
    },
    children: [{
      id: generateId('lyr'),
      name: 'text',
      customName: 'Empty message',
      classes: '',
      variables: {
        text: {
          type: 'dynamic_rich_text',
          data: {
            content: {
              type: 'doc',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'No items' }],
              }],
            },
          },
        },
      },
    }],
  };
}

export function insertSiblingAfter(layers: Layer[], targetId: string, sibling: Layer): Layer[] | null {
  const index = layers.findIndex(layer => layer.id === targetId);
  if (index >= 0) {
    const next = layers.slice();
    next.splice(index + 1, 0, sibling);
    return next;
  }
  let changed = false;
  const next = layers.map(layer => {
    if (!layer.children?.length) return layer;
    const children = insertSiblingAfter(layer.children, targetId, sibling);
    if (!children) return layer;
    changed = true;
    return { ...layer, children };
  });
  return changed ? next : null;
}

export function findFieldInGroups(
  groups: FieldGroup[] | undefined,
  fieldId: string,
): { field: CollectionField; source: 'page' | 'collection' | 'global'; layerId?: string } | null {
  if (!groups) return null;
  for (const group of groups) {
    const field = group.fields.find(item => item.id === fieldId);
    if (!field) continue;
    const source = group.source ?? 'collection';
    return { field, source, layerId: group.layerId };
  }
  return null;
}

export function emptyRichText(): DynamicRichTextVariable {
  return {
    type: 'dynamic_rich_text',
    data: {
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    },
  };
}

export function isFetchPreview(value: string): value is FetchPreview {
  return value === 'default' || value === 'loading' || value === 'error';
}
