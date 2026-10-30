/**
 * Insert a component instance into the open page or component draft.
 *
 * Click-to-insert (no placement) nests into the selected container, or the
 * body when nothing is selected. Canvas drop passes an explicit placement.
 */

import { toast } from 'sonner';
import { buildComponentInstanceLayer, checkCircularReference } from '@/lib/component-utils';
import { findLayerWithParent } from '@/lib/layer-utils';
import {
  insertLayerIntoTree,
  resolveClickInsertTarget,
  type InsertPlacement,
} from '@/lib/insert-layer';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useLocalisationStore } from '@/stores/useLocalisationStore';
import { usePagesStore } from '@/stores/usePagesStore';
import type { Layer } from '@/types';

interface LayerAddBroadcaster {
  broadcastLayerAdd: (
    pageId: string,
    parentLayerId: string | null,
    layerName: string,
    newLayer: Layer,
  ) => void;
}

export interface InsertComponentOptions {
  /** Canvas drop target. Omit to insert relative to the current selection. */
  placement?: InsertPlacement;
  liveLayerUpdates?: LayerAddBroadcaster | null;
}

function resolveVariantId(
  componentId: string,
  preferredVariantId: string | null,
): string | null {
  const drafts = useComponentsStore.getState().componentDrafts[componentId];
  if (!drafts) return preferredVariantId;
  if (preferredVariantId && drafts[preferredVariantId]) return preferredVariantId;
  return Object.keys(drafts)[0] || null;
}

function isNonDefaultLocale(): boolean {
  const { selectedLocaleId, locales } = useLocalisationStore.getState();
  if (!selectedLocaleId) return false;
  const locale = locales.find((item) => item.id === selectedLocaleId);
  return !!locale && !locale.is_default;
}

/**
 * Insert `componentId` onto the canvas the user is editing.
 * Returns true when a layer was added.
 */
export function insertComponentOnCanvas(
  componentId: string,
  options: InsertComponentOptions = {},
): boolean {
  if (isNonDefaultLocale()) return false;

  const componentsState = useComponentsStore.getState();
  const component = componentsState.components.find((item) => item.id === componentId);
  if (!component) return false;

  const editor = useEditorStore.getState();
  const variantId = editor.editingComponentId
    ? resolveVariantId(editor.editingComponentId, editor.editingComponentVariantId)
    : null;
  const editingComponent = !!(editor.editingComponentId && variantId);

  const instance = buildComponentInstanceLayer(component);

  if (editingComponent && editor.editingComponentId) {
    const circularError = checkCircularReference(
      editor.editingComponentId,
      instance,
      componentsState.components,
    );
    if (circularError) {
      toast.error('Infinite component loop detected', { description: circularError });
      return false;
    }
  }

  const layers = editingComponent && editor.editingComponentId && variantId
    ? componentsState.componentDrafts[editor.editingComponentId]?.[variantId] || []
    : null;

  let workingLayers: Layer[];
  if (layers !== null) {
    workingLayers = layers;
  } else {
    if (!editor.currentPageId) {
      toast.error('Select a page first');
      return false;
    }

    const draft = usePagesStore.getState().draftsByPageId[editor.currentPageId];
    if (!draft) return false;
    workingLayers = draft.layers;
  }

  const placement = options.placement ?? defaultPlacement(
    workingLayers,
    editor.selectedLayerId,
    editingComponent,
  );
  if (!placement) return false;

  const inserted = insertLayerIntoTree(workingLayers, instance, placement);

  if (editingComponent && editor.editingComponentId && variantId) {
    componentsState.updateComponentDraft(editor.editingComponentId, variantId, inserted.layers);
  } else if (editor.currentPageId) {
    usePagesStore.getState().setDraftLayers(editor.currentPageId, inserted.layers);

    if (options.liveLayerUpdates) {
      const found = findLayerWithParent(inserted.layers, instance.id);
      options.liveLayerUpdates.broadcastLayerAdd(
        editor.currentPageId,
        found?.parent?.id || null,
        `component:${component.id}`,
        instance,
      );
    }
  }

  editor.setSelectedLayerId(instance.id);

  if (inserted.parentToExpand && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('expandLayer', {
      detail: { layerId: inserted.parentToExpand },
    }));
  }

  return true;
}

function defaultPlacement(
  layers: Layer[],
  selectedLayerId: string | null,
  editingComponent: boolean,
): InsertPlacement | null {
  const selected = selectedLayerId && findLayerWithParent(layers, selectedLayerId)
    ? selectedLayerId
    : null;

  if (selected) return resolveClickInsertTarget(layers, selected);

  if (editingComponent) {
    const rootId = layers[0]?.id;
    if (!rootId) {
      // Empty variant: append the instance as the first layer.
      return { targetLayerId: '__root__', position: 'inside' };
    }
    return resolveClickInsertTarget(layers, rootId);
  }

  return resolveClickInsertTarget(layers, 'body');
}
