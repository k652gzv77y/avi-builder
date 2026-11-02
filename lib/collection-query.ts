/**
 * Collection List query and Detail page navigation.
 *
 * Limit, sort, filter, and pagination already run against Supabase.
 * These helpers name that query the way the inspector shows it, and build
 * the previous / next controls a Detail page uses to move between items.
 */

import { COLLECTION_ITEM_KEYWORDS, createPageLinkSettings } from '@/lib/link-utils';
import { generateId } from '@/lib/utils';
import type { CollectionVariable, Layer } from '@/types';

export type PaginationChoice = 'off' | 'pages' | 'load_more';
export type DetailDirection = 'previous' | 'next';

export interface DetailSortable {
  id: string;
  manualOrder: number;
  values: Record<string, string | null | undefined>;
}

export function paginationChoice(
  variable: Pick<CollectionVariable, 'pagination'> | null | undefined,
): PaginationChoice {
  if (!variable?.pagination?.enabled) return 'off';
  return variable.pagination.mode === 'load_more' ? 'load_more' : 'pages';
}

export function collectionFilterCount(
  variable: Pick<CollectionVariable, 'filters'> | null | undefined,
): number {
  return (variable?.filters?.groups ?? []).reduce(
    (sum, group) => sum + (group.conditions?.length ?? 0),
    0,
  );
}

export function filterLabel(count: number): string {
  if (count <= 0) return 'No filter';
  if (count === 1) return '1 filter';
  return `${count} filters`;
}

export function sortLabel(
  sortBy?: string,
  sortOrder?: 'asc' | 'desc',
  fieldName?: string,
): string {
  if (!sortBy || sortBy === 'none') return 'None';
  if (sortBy === 'manual') return 'Manual';
  if (sortBy === 'random') return 'Random';
  const name = fieldName?.trim() || 'Field';
  return sortOrder === 'desc' ? `${name} descending` : `${name} ascending`;
}

export function paginationLabel(choice: PaginationChoice, itemsPerPage?: number): string {
  if (choice === 'off') return 'Off';
  const count = itemsPerPage && itemsPerPage > 0 ? itemsPerPage : 10;
  return choice === 'load_more' ? `Load more, ${count}` : `Pages, ${count}`;
}

export interface CollectionQuerySummaryInput {
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  sortFieldName?: string;
  filterCount: number;
  pagination: PaginationChoice;
  itemsPerPage?: number;
  hasEmpty: boolean;
}

/** One line the Collection List inspector shows above Limit, Sort, Filter, Pagination, and Empty. */
export function collectionQuerySummary(input: CollectionQuerySummaryInput): string {
  const limit = input.limit && input.limit > 0 ? `Limit ${input.limit}` : 'No limit';
  const sort = `Sort ${sortLabel(input.sortBy, input.sortOrder, input.sortFieldName)}`;
  const pagination = `Pagination ${paginationLabel(input.pagination, input.itemsPerPage)}`;
  const empty = input.hasEmpty ? 'Empty designed' : 'No empty state';
  return `${limit} · ${sort} · ${filterLabel(input.filterCount)} · ${pagination} · ${empty}`;
}

export function orderDetailItems<T extends DetailSortable>(
  items: T[],
  sortBy?: string,
  sortOrder?: 'asc' | 'desc',
): T[] {
  const direction = sortOrder === 'desc' ? -1 : 1;
  const fieldId = sortBy && sortBy !== 'manual' ? sortBy : null;
  return [...items].sort((a, b) => {
    if (!fieldId) {
      const delta = a.manualOrder - b.manualOrder;
      if (delta !== 0) return delta * direction;
      return a.id.localeCompare(b.id);
    }
    const av = a.values[fieldId] ?? '';
    const bv = b.values[fieldId] ?? '';
    const left = String(av);
    const right = String(bv);
    const an = Number(left);
    const bn = Number(right);
    if (left !== '' && right !== '' && Number.isFinite(an) && Number.isFinite(bn)) {
      const delta = an - bn;
      if (delta !== 0) return delta * direction;
    } else {
      const delta = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
      if (delta !== 0) return delta * direction;
    }
    const fallback = a.manualOrder - b.manualOrder;
    return fallback !== 0 ? fallback : a.id.localeCompare(b.id);
  });
}

export function adjacentDetailItem<T extends { id: string }>(
  items: T[],
  currentId: string | null,
  direction: DetailDirection,
): T | null {
  if (items.length === 0) return null;
  const index = currentId ? items.findIndex(item => item.id === currentId) : -1;
  if (index < 0) return direction === 'next' ? items[0] : null;
  const nextIndex = direction === 'next' ? index + 1 : index - 1;
  if (nextIndex < 0 || nextIndex >= items.length) return null;
  return items[nextIndex];
}

/** Replace the last `:token` in a detail route with the preview item's slug. */
export function detailPreviewRoute(pattern: string, slug: string | null | undefined): string {
  const route = pattern.trim() || '/:slug';
  const value = slug?.trim();
  if (!value) return route.startsWith('/') ? route : `/${route}`;
  if (!route.includes(':')) return route;
  return route.replace(/:[^/]+$/, value.replace(/^\/+/, ''));
}

export function detailItemSlug(
  values: Record<string, string | null | undefined> | undefined,
  slugFieldId: string | undefined,
): string | null {
  if (!slugFieldId || !values) return null;
  const value = values[slugFieldId];
  if (value == null || String(value).trim() === '') return null;
  return String(value).trim();
}

function navigationKeyword(direction: DetailDirection): string {
  return direction === 'next'
    ? COLLECTION_ITEM_KEYWORDS.NEXT_ITEM
    : COLLECTION_ITEM_KEYWORDS.PREVIOUS_ITEM;
}

/** A text link that resolves to the neighbouring Detail page item. */
export function buildDetailNavigation(pageId: string, direction: DetailDirection): Layer {
  const label = direction === 'next' ? 'Next' : 'Previous';
  return {
    id: generateId('lyr'),
    name: 'text',
    customName: label,
    classes: 'inline-flex items-center px-3 py-1.5',
    attributes: { 'data-detail-nav': direction },
    variables: {
      link: createPageLinkSettings(pageId, navigationKeyword(direction)),
      text: {
        type: 'dynamic_text',
        data: { content: label },
      },
    },
  };
}

export function findDetailNavigation(layers: Layer[], direction: DetailDirection): Layer | null {
  const keyword = navigationKeyword(direction);
  for (const layer of layers) {
    const itemId = layer.variables?.link?.page?.collection_item_id;
    if (itemId === keyword || layer.attributes?.['data-detail-nav'] === direction) return layer;
    if (layer.children?.length) {
      const found = findDetailNavigation(layer.children, direction);
      if (found) return found;
    }
  }
  return null;
}

/** Append a detail control inside the page body, or at the root when there is no body. */
export function placeDetailNavigation(layers: Layer[], control: Layer): Layer[] {
  const bodyIndex = layers.findIndex(layer => layer.id === 'body' || layer.name === 'body');
  if (bodyIndex < 0) return [...layers, control];
  const body = layers[bodyIndex];
  const next = layers.slice();
  next[bodyIndex] = { ...body, children: [...(body.children ?? []), control] };
  return next;
}
