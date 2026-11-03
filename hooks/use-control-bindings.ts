'use client';

/**
 * Binds Visible, Fill, and Opacity to component property controls while
 * editing a component. Content bindings for enum and number live on the
 * text inspector, which already owns that row.
 */

import { useCallback } from 'react';
import {
  applyControlBindings,
  controlsForBinding,
  CONTROL_BINDING_LABELS,
} from '@/lib/component-properties';
import { defaultBindingSources, type BindingSource } from '@/lib/component-bindings';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import type { ComponentVariableValue, ControlBindingKey, Layer } from '@/types';

interface UseControlBindingsArgs {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export function useControlBindings({ layer, onLayerUpdate }: UseControlBindingsArgs) {
  const editingComponentId = useEditorStore((state) => state.editingComponentId);
  const component = useComponentsStore((state) => (
    editingComponentId
      ? state.components.find((item) => item.id === editingComponentId)
      : undefined
  ));
  const addPropertyVariable = useComponentsStore((state) => state.addPropertyVariable);
  const updateTextVariable = useComponentsStore((state) => state.updateTextVariable);

  const linkVariable = useCallback((key: ControlBindingKey, variableId: string) => {
    if (!layer) return;
    const variables = editingComponentId
      ? (useComponentsStore.getState().getComponentById(editingComponentId)?.variables ?? [])
      : [];
    const nextBindings = { ...(layer.controlBindings ?? {}), [key]: variableId };
    const applied = applyControlBindings(
      { ...layer, controlBindings: { [key]: variableId } },
      undefined,
      variables,
      { ephemeral: false },
    );
    const updates: Partial<Layer> = { controlBindings: nextBindings };
    if (key === 'visible') updates.settings = applied.settings;
    if (key === 'fill' || key === 'opacity') {
      updates.design = applied.design;
      updates.classes = applied.classes;
    }
    if (key === 'text') updates.variables = applied.variables;
    onLayerUpdate(layer.id, updates);
    const variable = variables.find((item) => item.id === variableId);
    if (!variable?.default_value || !editingComponentId) return;
    void updateTextVariable(editingComponentId, variableId, { default_value: variable.default_value });
  }, [editingComponentId, layer, onLayerUpdate, updateTextVariable]);

  const unlinkVariable = useCallback((key: ControlBindingKey) => {
    if (!layer) return;
    const next = { ...(layer.controlBindings ?? {}) };
    delete next[key];
    onLayerUpdate(layer.id, {
      controlBindings: Object.keys(next).length > 0 ? next : undefined,
    });
  }, [layer, onLayerUpdate]);

  const createVariable = useCallback(async (key: ControlBindingKey) => {
    if (!layer || !editingComponentId) return;
    if (key === 'visible') {
      const variableId = await addPropertyVariable(editingComponentId, {
        name: 'Visible',
        type: 'boolean',
        default_value: { type: 'boolean', value: layer.settings?.hidden !== true },
      });
      if (variableId) linkVariable('visible', variableId);
      return;
    }
    if (key === 'fill') {
      const variableId = await addPropertyVariable(editingComponentId, {
        name: 'Fill',
        type: 'color',
        default_value: { type: 'color', value: layer.design?.backgrounds?.backgroundColor || '#000000' },
      });
      if (variableId) linkVariable('fill', variableId);
      return;
    }
    if (key !== 'opacity') return;
    const parsed = Number(layer.design?.effects?.opacity ?? '100');
    const variableId = await addPropertyVariable(editingComponentId, {
      name: 'Opacity',
      type: 'number',
      default_value: { type: 'number', value: Number.isFinite(parsed) ? parsed : 100 },
      min: 0,
      max: 100,
      step: 1,
    });
    if (variableId) linkVariable('opacity', variableId);
  }, [addPropertyVariable, editingComponentId, layer, linkVariable]);

  const syncValue = useCallback((key: ControlBindingKey, value: ComponentVariableValue) => {
    if (!layer || !editingComponentId) return;
    const variableId = layer.controlBindings?.[key];
    if (!variableId) return;
    void updateTextVariable(editingComponentId, variableId, { default_value: value });
  }, [editingComponentId, layer, updateTextVariable]);

  const bindingFor = useCallback((key: ControlBindingKey): {
    label: string;
    linkedId?: string;
    linkedName?: string;
    sources: BindingSource[];
    onUnlink?: () => void;
  } | null => {
    if (!layer) return null;
    const variables = controlsForBinding(key, component?.variables ?? []);
    const linkedId = layer.controlBindings?.[key];
    const linked = variables.find((item) => item.id === linkedId);
    const canUseVariables = !!editingComponentId;
    return {
      label: CONTROL_BINDING_LABELS[key],
      linkedId,
      linkedName: linked?.name,
      onUnlink: () => unlinkVariable(key),
      sources: defaultBindingSources({
        enabled: canUseVariables,
        items: canUseVariables ? variables.map((item) => ({ id: item.id, name: item.name })) : [],
        onCreate: canUseVariables ? () => { void createVariable(key); } : undefined,
        onSelect: canUseVariables ? (variableId) => linkVariable(key, variableId) : undefined,
      }),
    };
  }, [component?.variables, createVariable, editingComponentId, layer, linkVariable, unlinkVariable]);

  return { bindingFor, syncValue };
}
