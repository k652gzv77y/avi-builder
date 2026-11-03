'use client';

/**
 * Inspector control for a number, boolean, enum, or color component property.
 * Used for the component default and for an instance override.
 */

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { clampNumber, isBooleanPropertyValue, isColorPropertyValue, isEnumPropertyValue, isNumberPropertyValue } from '@/lib/component-properties';
import { removeSpaces } from '@/lib/utils';
import type { ComponentVariable, ComponentVariableValue } from '@/types';
import ColorPicker from './ColorPicker';

interface PropertyControlInputProps {
  variable: ComponentVariable;
  value: ComponentVariableValue | undefined;
  onChange: (value: ComponentVariableValue) => void;
}

export default function PropertyControlInput({ variable, value, onChange }: PropertyControlInputProps) {
  if (variable.type === 'boolean') {
    const checked = isBooleanPropertyValue(value) ? value.value : true;
    return (
      <Switch
        checked={checked}
        aria-label={variable.name}
        onCheckedChange={(next) => onChange({ type: 'boolean', value: next })}
      />
    );
  }

  if (variable.type === 'number') {
    const current = isNumberPropertyValue(value) ? value.value : 0;
    return (
      <Input
        type="number"
        value={Number.isFinite(current) ? String(current) : ''}
        min={variable.min}
        max={variable.max}
        step={variable.step ?? 1}
        aria-label={variable.name}
        onChange={(event) => {
          if (event.target.value.trim() === '') return;
          const parsed = Number(event.target.value);
          if (!Number.isFinite(parsed)) return;
          onChange({ type: 'number', value: clampNumber(parsed, variable) });
        }}
      />
    );
  }

  if (variable.type === 'enum') {
    const options = variable.options ?? [];
    const current = isEnumPropertyValue(value) ? value.value : options[0]?.id ?? '';
    if (options.length === 0) {
      return <p className="text-xs text-muted-foreground py-2">Add options on the component.</p>;
    }
    return (
      <Select
        value={current}
        onValueChange={(next) => onChange({ type: 'enum', value: next })}
      >
        <SelectTrigger className="w-full" aria-label={variable.name}>
          <SelectValue placeholder="Option" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label || 'Untitled'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (variable.type === 'color') {
    const current = isColorPropertyValue(value) ? value.value : '#000000';
    return (
      <ColorPicker
        value={current}
        solidOnly
        onChange={(next) => {
          const sanitized = removeSpaces(next);
          if (!sanitized || sanitized.includes('gradient(')) return;
          onChange({ type: 'color', value: sanitized });
        }}
      />
    );
  }

  return null;
}
