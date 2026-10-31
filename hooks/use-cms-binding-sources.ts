'use client';

/**
 * CMS and Fetch entries for the Sprint 2 bindings menu.
 * CMS lists fields from the nearest Collection List and, on a Detail Page,
 * from that page's item. Fetch lists the page's single-value fetches.
 */

import { useMemo } from 'react';
import { cmsItemsFromGroups, fetchItemsFromSpecs } from '@/lib/cms-framer';
import { buildFieldGroupsForLayer } from '@/lib/collection-field-utils';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useFetchCreatorStore } from '@/stores/useFetchCreatorStore';
import { useGlobalsStore } from '@/stores/useGlobalsStore';
import { usePagesStore } from '@/stores/usePagesStore';
import type { BindingSourceItem } from '@/lib/component-bindings';
import type { Layer } from '@/types';

export function useCmsBindingSources(layerId: string | null): {
  cmsItems: BindingSourceItem[];
  fetchItems: BindingSourceItem[];
  openFetchCreator: (onCreated: (fetchId: string) => void) => void;
} {
  const editingComponentId = useEditorStore(state => state.editingComponentId);
  const editingComponentVariantId = useEditorStore(state => state.editingComponentVariantId);
  const currentPageId = useEditorStore(state => state.currentPageId);
  const componentDrafts = useComponentsStore(state => state.componentDrafts);
  const draftLayers = usePagesStore(state => (
    currentPageId ? state.draftsByPageId[currentPageId]?.layers : undefined
  ));
  const page = usePagesStore(state => state.pages.find(item => item.id === currentPageId));
  const fields = useCollectionsStore(state => state.fields);
  const collections = useCollectionsStore(state => state.collections);
  const globals = useGlobalsStore(state => state.globals);
  const requestCreator = useFetchCreatorStore(state => state.request);

  const layers = useMemo((): Layer[] => {
    if (editingComponentId) {
      const drafts = componentDrafts[editingComponentId];
      if (!drafts) return [];
      if (editingComponentVariantId && drafts[editingComponentVariantId]) {
        return drafts[editingComponentVariantId];
      }
      return Object.values(drafts)[0] ?? [];
    }
    return draftLayers ?? [];
  }, [componentDrafts, draftLayers, editingComponentId, editingComponentVariantId]);

  const cmsItems = useMemo(() => {
    if (!layerId || layers.length === 0) return [];
    const groups = buildFieldGroupsForLayer(
      layerId,
      layers,
      editingComponentId ? null : page,
      fields,
      collections,
      globals,
    );
    return cmsItemsFromGroups(groups);
  }, [collections, editingComponentId, fields, globals, layerId, layers, page]);

  const fetchItems = useMemo(
    () => fetchItemsFromSpecs(page?.settings?.fetches ?? []),
    [page?.settings?.fetches],
  );

  return {
    cmsItems,
    fetchItems,
    openFetchCreator: requestCreator,
  };
}
