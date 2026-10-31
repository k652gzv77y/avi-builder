'use client';

/**
 * Instance panel for a code component placed on the canvas.
 * Edits this instance's control values. The template stays on the asset.
 */

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { readCodeComponent, resolveControlValues } from '@/lib/code-components';
import { useComponentsStore } from '@/stores/useComponentsStore';
import type { Layer, PropertyControl } from '@/types';
import SettingsPanel from './SettingsPanel';

interface CodeComponentSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

function ControlField({
  control,
  value,
  onChange,
}: {
  control: PropertyControl;
  value: string;
  onChange: (value: string | number | boolean) => void;
}) {
  if (control.type === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{control.name}</Label>
        <Switch
          size="sm"
          checked={value === 'true'}
          onCheckedChange={(checked) => onChange(checked === true)}
          aria-label={control.name}
        />
      </div>
    );
  }

  if (control.type === 'enum') {
    return (
      <div className="flex flex-col gap-1">
        <Label className="text-xs">{control.name}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger aria-label={control.name}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(control.options || []).map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  const inputType = control.type === 'number' ? 'number' : control.type === 'color' ? 'color' : 'text';

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{control.name}</Label>
      <Input
        type={inputType}
        value={value}
        placeholder={control.placeholder}
        aria-label={control.name}
        onChange={(event) => {
          if (control.type === 'number') {
            onChange(event.target.value === '' ? '' : Number(event.target.value));
            return;
          }
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

export default function CodeComponentSettings({ layer, onLayerUpdate }: CodeComponentSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const components = useComponentsStore((state) => state.components);

  if (!layer || layer.name !== 'codeComponent') return null;

  const componentId = layer.settings?.codeComponent?.componentId;
  const component = components.find((item) => item.id === componentId);
  const definition = component ? readCodeComponent(component) : null;
  const controls = definition?.controls ?? [];
  const resolved = resolveControlValues(controls, layer.settings?.codeComponent?.values);

  const handleChange = (controlId: string, value: string | number | boolean) => {
    onLayerUpdate(layer.id, {
      settings: {
        ...layer.settings,
        codeComponent: {
          ...layer.settings?.codeComponent,
          componentId,
          values: {
            ...layer.settings?.codeComponent?.values,
            [controlId]: value,
          },
        },
      },
    });
  };

  return (
    <SettingsPanel
      title="Property controls"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      {!definition && (
        <p className="text-xs text-muted-foreground">
          This code component is missing from Assets.
        </p>
      )}
      {definition && controls.length === 0 && (
        <p className="text-xs text-muted-foreground">This component has no controls.</p>
      )}
      <div className="flex flex-col gap-2.5">
        {controls.map((control) => (
          <ControlField
            key={control.id}
            control={control}
            value={resolved[control.id] ?? ''}
            onChange={(value) => handleChange(control.id, value)}
          />
        ))}
      </div>
    </SettingsPanel>
  );
}
