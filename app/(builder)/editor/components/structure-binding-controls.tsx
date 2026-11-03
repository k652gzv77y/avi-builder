'use client';

/**
 * Links a frame to a slot or an array repeater while editing a component.
 * Slot children are the fallback. Repeater children are the item template.
 */

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { defaultArrayValue, emptySlotValue } from '@/lib/component-properties';
import { canHaveChildren } from '@/lib/layer-utils';
import { generateId } from '@/lib/utils';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import type { Layer, StructuredField } from '@/types';

const NONE = '__none__';

interface StructureBindingControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

function titleField(): StructuredField {
  return { id: generateId('fld'), name: 'Title', type: 'text' };
}

export default function StructureBindingControls({ layer, onLayerUpdate }: StructureBindingControlsProps) {
  const editingComponentId = useEditorStore((state) => state.editingComponentId);
  const variables = useComponentsStore((state) => (
    editingComponentId
      ? state.components.find((item) => item.id === editingComponentId)?.variables ?? []
      : []
  ));
  const addPropertyVariable = useComponentsStore((state) => state.addPropertyVariable);

  if (!layer || !editingComponentId || !canHaveChildren(layer)) return null;

  const slots = variables.filter((variable) => variable.type === 'slot');
  const arrays = variables.filter((variable) => variable.type === 'array');

  const linkSlot = async (value: string) => {
    if (value === NONE) {
      onLayerUpdate(layer.id, { slotVariableId: undefined });
      return;
    }
    if (value === '__create__') {
      const variableId = await addPropertyVariable(editingComponentId, {
        name: 'Slot',
        type: 'slot',
        default_value: emptySlotValue(),
      });
      if (variableId) onLayerUpdate(layer.id, { slotVariableId: variableId });
      return;
    }
    onLayerUpdate(layer.id, { slotVariableId: value });
  };

  const linkRepeat = async (value: string) => {
    if (value === NONE) {
      onLayerUpdate(layer.id, { repeatVariableId: undefined });
      return;
    }
    if (value === '__create__') {
      const fields = [titleField()];
      const variableId = await addPropertyVariable(editingComponentId, {
        name: 'List',
        type: 'array',
        fields,
        default_value: defaultArrayValue(fields),
      });
      if (variableId) onLayerUpdate(layer.id, { repeatVariableId: variableId });
      return;
    }
    onLayerUpdate(layer.id, { repeatVariableId: value });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 items-center">
        <Label variant="muted">Slot</Label>
        <div className="col-span-2">
          <Select
            value={layer.slotVariableId ?? NONE}
            onValueChange={(next) => { void linkSlot(next); }}
          >
            <SelectTrigger
              className="w-full"
              aria-label="Slot"
            >
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {slots.map((variable) => (
                <SelectItem
                  key={variable.id}
                  value={variable.id}
                >
                  {variable.name}
                </SelectItem>
              ))}
              <SelectItem value="__create__">New slot</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 items-center">
        <Label variant="muted">Repeat</Label>
        <div className="col-span-2">
          <Select
            value={layer.repeatVariableId ?? NONE}
            onValueChange={(next) => { void linkRepeat(next); }}
          >
            <SelectTrigger
              className="w-full"
              aria-label="Repeat"
            >
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {arrays.map((variable) => (
                <SelectItem
                  key={variable.id}
                  value={variable.id}
                >
                  {variable.name}
                </SelectItem>
              ))}
              <SelectItem value="__create__">New list</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {(layer.slotVariableId || layer.repeatVariableId) && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {layer.slotVariableId && 'Layers inside this frame are the slot fallback.'}
          {layer.slotVariableId && layer.repeatVariableId && ' '}
          {layer.repeatVariableId && 'Children repeat once per list item. Bind their content to the list fields.'}
        </p>
      )}
    </div>
  );
}
