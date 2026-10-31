'use client';

/**
 * Turns stack properties into component variables while editing a component.
 * The + control creates or links a variable. Edits update the variable default
 * and every layer bound to it, including per-breakpoint values.
 */

import { useCallback } from 'react';
import {
  applyStackValueToBoundLayers,
  defaultBindingSources,
  isStackVariableValue,
  masterStackValue,
  STACK_VARIABLE_LABELS,
  writeStackBreakpoint,
  type BindingSource,
} from '@/lib/component-bindings';
import { parseCmsBindingId } from '@/lib/cms-framer';
import { useCmsBindingSources } from '@/hooks/use-cms-binding-sources';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';
import type { DataBinding, Layer, StackVariableKey, StackVariableValue } from '@/types';

interface UseStackBindingsArgs {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export function useStackBindings({ layer, onLayerUpdate }: UseStackBindingsArgs) {
  const editingComponentId = useEditorStore(state => state.editingComponentId);
  const activeBreakpoint = useEditorStore(state => state.activeBreakpoint);
  const activeUIState = useEditorStore(state => state.activeUIState);
  const component = useComponentsStore(state => (
    editingComponentId
      ? state.components.find(item => item.id === editingComponentId)
      : undefined
  ));
  const addStackVariable = useComponentsStore(state => state.addStackVariable);
  const updateTextVariable = useComponentsStore(state => state.updateTextVariable);
  const currentPageId = useEditorStore(state => state.currentPageId);
  const { cmsItems, fetchItems, openFetchCreator } = useCmsBindingSources(layer?.id ?? null);
  const fetches = usePagesStore(state => (
    state.pages.find(item => item.id === currentPageId)?.settings?.fetches ?? []
  ));

  const syncValue = useCallback((key: StackVariableKey, raw: string) => {
    if (!layer || !editingComponentId || activeUIState !== 'neutral') return;
    const variableId = layer.stackBindings?.[key];
    if (!variableId) return;
    const variable = component?.variables?.find(item => item.id === variableId);
    const current = isStackVariableValue(variable?.default_value)
      ? variable.default_value
      : { value: masterStackValue(layer, key) };
    const next = writeStackBreakpoint(current, activeBreakpoint, raw);
    void updateTextVariable(editingComponentId, variableId, { default_value: next });

    const { componentDrafts, updateComponentDraft } = useComponentsStore.getState();
    const drafts = componentDrafts[editingComponentId];
    if (!drafts) return;
    for (const [variantId, layers] of Object.entries(drafts)) {
      const nextLayers = applyStackValueToBoundLayers(layers, variableId, key, next);
      if (nextLayers !== layers) updateComponentDraft(editingComponentId, variantId, nextLayers);
    }
  }, [activeBreakpoint, activeUIState, component?.variables, editingComponentId, layer, updateTextVariable]);

  const linkVariable = useCallback((key: StackVariableKey, variableId: string) => {
    if (!layer) return;
    const nextData = { ...(layer.dataBindings ?? {}) };
    delete nextData[key];
    onLayerUpdate(layer.id, {
      stackBindings: { ...(layer.stackBindings ?? {}), [key]: variableId },
      dataBindings: Object.keys(nextData).length > 0 ? nextData : undefined,
    });
    const variable = component?.variables?.find(item => item.id === variableId);
    if (!isStackVariableValue(variable?.default_value) || !editingComponentId) return;
    const { componentDrafts, updateComponentDraft } = useComponentsStore.getState();
    const drafts = componentDrafts[editingComponentId];
    if (!drafts) return;
    for (const [variantId, layers] of Object.entries(drafts)) {
      const nextLayers = applyStackValueToBoundLayers(layers, variableId, key, variable.default_value);
      if (nextLayers !== layers) updateComponentDraft(editingComponentId, variantId, nextLayers);
    }
  }, [component?.variables, editingComponentId, layer, onLayerUpdate]);

  const createVariable = useCallback(async (key: StackVariableKey, visibleValue: string) => {
    if (!layer || !editingComponentId) return;
    const desktop = masterStackValue(layer, key);
    let initial: StackVariableValue = { value: desktop || visibleValue };
    if (activeBreakpoint !== 'desktop' && visibleValue && visibleValue !== desktop) {
      initial = writeStackBreakpoint(initial, activeBreakpoint, visibleValue);
    }
    const variableId = await addStackVariable(
      editingComponentId,
      STACK_VARIABLE_LABELS[key],
      key,
      initial,
    );
    if (!variableId) return;
    const nextData = { ...(layer.dataBindings ?? {}) };
    delete nextData[key];
    onLayerUpdate(layer.id, {
      stackBindings: { ...(layer.stackBindings ?? {}), [key]: variableId },
      dataBindings: Object.keys(nextData).length > 0 ? nextData : undefined,
    });
  }, [activeBreakpoint, addStackVariable, editingComponentId, layer, onLayerUpdate]);

  const unlinkVariable = useCallback((key: StackVariableKey) => {
    if (!layer) return;
    const nextStack = { ...(layer.stackBindings ?? {}) };
    const nextData = { ...(layer.dataBindings ?? {}) };
    delete nextStack[key];
    delete nextData[key];
    onLayerUpdate(layer.id, {
      stackBindings: Object.keys(nextStack).length > 0 ? nextStack : undefined,
      dataBindings: Object.keys(nextData).length > 0 ? nextData : undefined,
    });
  }, [layer, onLayerUpdate]);

  const bindData = useCallback((key: StackVariableKey, binding: DataBinding) => {
    if (!layer) return;
    const nextStack = { ...(layer.stackBindings ?? {}) };
    delete nextStack[key];
    onLayerUpdate(layer.id, {
      stackBindings: Object.keys(nextStack).length > 0 ? nextStack : undefined,
      dataBindings: { ...(layer.dataBindings ?? {}), [key]: binding },
    });
  }, [layer, onLayerUpdate]);

  const bindingFor = useCallback((key: StackVariableKey): {
    label: string;
    linkedId?: string;
    linkedName?: string;
    sources: BindingSource[];
    onUnlink?: () => void;
  } | null => {
    if (!editingComponentId || !layer) return null;
    const linkedId = layer.stackBindings?.[key];
    const dataBinding = layer.dataBindings?.[key];
    const variables = (component?.variables ?? []).filter(item => (
      item.type === 'stack' && item.stack_key === key
    ));
    const linked = variables.find(item => item.id === linkedId);
    const linkedFetch = fetches.find(item => item.id === dataBinding?.fetch_id);
    const linkedCms = cmsItems.find(item => dataBinding?.field_id && item.id.endsWith(`:${dataBinding.field_id}`));
    const dataLinkedId = dataBinding?.kind === 'fetch'
      ? dataBinding.fetch_id
      : linkedCms?.id;
    return {
      label: STACK_VARIABLE_LABELS[key],
      linkedId: linkedId ?? dataLinkedId,
      linkedName: linked?.name ?? linkedFetch?.name ?? linkedCms?.name,
      onUnlink: () => unlinkVariable(key),
      sources: defaultBindingSources({
        items: variables.map(item => ({ id: item.id, name: item.name })),
        onCreate: () => {
          void createVariable(key, masterStackValue(layer, key));
        },
        onSelect: (variableId) => linkVariable(key, variableId),
      }, {
        cms: {
          items: cmsItems,
          onSelect: (encodedId) => {
            const parsed = parseCmsBindingId(encodedId);
            if (!parsed) return;
            bindData(key, {
              kind: 'cms',
              field_id: parsed.fieldId,
              source: parsed.source,
              collection_layer_id: parsed.layerId,
            });
          },
        },
        fetch: {
          items: fetchItems,
          onCreate: () => openFetchCreator((fetchId) => {
            bindData(key, { kind: 'fetch', fetch_id: fetchId });
          }),
          onSelect: (fetchId) => bindData(key, { kind: 'fetch', fetch_id: fetchId }),
        },
      }),
    };
  }, [bindData, cmsItems, component?.variables, createVariable, editingComponentId, fetchItems, fetches, layer, linkVariable, openFetchCreator, unlinkVariable]);

  return { bindingFor, syncValue };
}
