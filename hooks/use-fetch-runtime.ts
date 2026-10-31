'use client';

/**
 * Loads Fetch values for the canvas. Detail Page fetches read the item
 * already on the page. First-item fetches read one row from Supabase.
 */

import { useEffect, useMemo } from 'react';
import { collectionsApi } from '@/lib/api';
import { formatFieldValue } from '@/lib/cms-variables-utils';
import { collectFetchSpecs } from '@/lib/cms-framer';
import type { FetchRuntime } from '@/lib/cms-framer';
import type { CollectionItemWithValues, FetchSpec, Layer } from '@/types';
import { useEditorStore } from '@/stores/useEditorStore';
import { useFetchRuntimeStore } from '@/stores/useFetchRuntimeStore';
import { usePagesStore } from '@/stores/usePagesStore';

async function loadFirstItems(specs: FetchSpec[]): Promise<Record<string, { ok: boolean; item: CollectionItemWithValues | null }>> {
  const collectionIds = [...new Set(
    specs.filter(spec => spec.item_source === 'first' && spec.collection_id).map(spec => spec.collection_id),
  )];
  const entries = await Promise.all(collectionIds.map(async (collectionId) => {
    try {
      const response = await collectionsApi.getItems(collectionId, { limit: 1 });
      if (response.error) return [collectionId, { ok: false, item: null }] as const;
      return [collectionId, { ok: true, item: response.data?.items?.[0] ?? null }] as const;
    } catch {
      return [collectionId, { ok: false, item: null }] as const;
    }
  }));
  return Object.fromEntries(entries);
}

export function useFetchRuntime(
  layers: Layer[] | undefined,
  pageItemData: Record<string, string> | null | undefined,
) {
  const currentPageId = useEditorStore(state => state.currentPageId);
  const fetches = usePagesStore(state => (
    state.pages.find(page => page.id === currentPageId)?.settings?.fetches
  ));
  const setRuntime = useFetchRuntimeStore(state => state.setRuntime);

  const pageItemKey = pageItemData ? JSON.stringify(pageItemData) : '';
  const specKey = useMemo(() => {
    const specs = collectFetchSpecs(layers ?? [], fetches);
    return specs.map(spec => (
      `${spec.id}:${spec.collection_id}:${spec.field_id}:${spec.item_source}:${spec.preview ?? ''}:${spec.loading_text ?? ''}:${spec.error_text ?? ''}`
    )).join('|');
  }, [fetches, layers]);

  useEffect(() => {
    let cancelled = false;
    const specs = collectFetchSpecs(layers ?? [], fetches);

    const publish = (runtime: FetchRuntime) => {
      if (!cancelled) setRuntime(runtime);
    };

    if (specs.length === 0) {
      publish({ specs: [], values: {}, status: {} });
      return () => {
        cancelled = true;
      };
    }

    const previous = useFetchRuntimeStore.getState();
    publish({
      specs,
      values: previous.values,
      status: Object.fromEntries(specs.map(spec => [
        spec.id,
        previous.status[spec.id] ?? 'loading',
      ])),
    });

    void (async () => {
      let firstItems: Record<string, { ok: boolean; item: CollectionItemWithValues | null }> = {};
      try {
        firstItems = await loadFirstItems(specs);
      } catch {
        firstItems = {};
      }
      if (cancelled) return;
      const values: Record<string, string | undefined> = {};
      const status: FetchRuntime['status'] = {};
      for (const spec of specs) {
        if (spec.item_source === 'detail') {
          const raw = pageItemData?.[spec.field_id];
          values[spec.id] = raw != null ? formatFieldValue(raw, spec.field_type) : '';
          status[spec.id] = 'ready';
          continue;
        }
        const loaded = firstItems[spec.collection_id];
        if (!loaded?.ok) {
          status[spec.id] = 'error';
          continue;
        }
        const raw = loaded.item?.values?.[spec.field_id];
        values[spec.id] = raw != null ? formatFieldValue(raw, spec.field_type) : '';
        status[spec.id] = 'ready';
      }
      publish({ specs, values, status });
    })();

    return () => {
      cancelled = true;
    };
    // specKey already covers layer and fetch identity. Reloading on every new
    // layers array would refetch while the canvas re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageItemData, pageItemKey, setRuntime, specKey]);
}
