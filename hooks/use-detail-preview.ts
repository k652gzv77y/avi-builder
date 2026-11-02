'use client';

/**
 * The item a Detail page is previewing, in the same order previous / next
 * links use. The canvas arrows and the inspector share this list.
 */

import { useEffect, useMemo } from 'react';
import {
  adjacentDetailItem,
  detailItemSlug,
  detailPreviewRoute,
  orderDetailItems,
} from '@/lib/collection-query';
import { detailRouteToken } from '@/lib/cms-framer';
import { buildSlugPath } from '@/lib/page-utils';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';

export interface DetailPreviewItem {
  id: string;
  label: string;
  slug: string | null;
}

export function useDetailPreview() {
  const currentPageId = useEditorStore(state => state.currentPageId);
  const editingComponentId = useEditorStore(state => state.editingComponentId);
  const currentId = useEditorStore(state => state.currentPageCollectionItemId);
  const setCurrentId = useEditorStore(state => state.setCurrentPageCollectionItemId);
  const page = usePagesStore(state => state.pages.find(item => item.id === currentPageId) ?? null);
  const folders = usePagesStore(state => state.folders);
  const itemsByCollection = useCollectionsStore(state => state.items);
  const fieldsByCollection = useCollectionsStore(state => state.fields);

  const collectionId = !editingComponentId && page?.is_dynamic
    ? page.settings?.cms?.collection_id ?? null
    : null;
  const slugFieldId = page?.settings?.cms?.slug_field_id;
  const sortBy = page?.settings?.cms?.next_previous?.sort_by;
  const sortOrder = page?.settings?.cms?.next_previous?.sort_order;

  const items = useMemo(() => {
    if (!collectionId) return [];
    const fields = fieldsByCollection[collectionId] || [];
    const nameField = fields.find(field => field.key === 'name');
    const raw = itemsByCollection[collectionId] || [];
    const ordered = orderDetailItems(
      raw.map(item => ({
        id: item.id,
        manualOrder: item.manual_order ?? 0,
        values: item.values || {},
      })),
      sortBy,
      sortOrder,
    );
    return ordered.map((item): DetailPreviewItem => {
      const name = nameField ? item.values[nameField.id] : undefined;
      const label = name != null && String(name).trim() !== ''
        ? String(name)
        : `Item ${item.id.slice(0, 8)}`;
      return {
        id: item.id,
        label,
        slug: detailItemSlug(item.values, slugFieldId),
      };
    });
  }, [collectionId, fieldsByCollection, itemsByCollection, slugFieldId, sortBy, sortOrder]);

  const firstId = items[0]?.id ?? null;

  useEffect(() => {
    if (!collectionId || currentId || !firstId) return;
    setCurrentId(firstId);
  }, [collectionId, currentId, firstId, setCurrentId]);

  const current = items.find(item => item.id === currentId) ?? null;
  const previous = adjacentDetailItem(items, currentId, 'previous');
  const next = adjacentDetailItem(items, currentId, 'next');

  const pattern = useMemo(() => {
    if (!page || !collectionId) return '/:slug';
    const fields = fieldsByCollection[collectionId] || [];
    const slugField = fields.find(field => field.id === slugFieldId);
    return buildSlugPath(page, folders, 'page', detailRouteToken(slugField?.key ?? undefined));
  }, [collectionId, fieldsByCollection, folders, page, slugFieldId]);

  return {
    isDetail: !!collectionId,
    collectionId,
    route: detailPreviewRoute(pattern, current?.slug),
    currentId,
    currentLabel: current?.label ?? '',
    canGoPrevious: !!previous,
    canGoNext: !!next,
    goPrevious: () => {
      if (previous) setCurrentId(previous.id);
    },
    goNext: () => {
      if (next) setCurrentId(next.id);
    },
    setCurrentId,
  };
}
