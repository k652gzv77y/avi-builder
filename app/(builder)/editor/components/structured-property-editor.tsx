'use client';

/**
 * Editor for an array or object component property.
 * The component dialog edits the field list and the default.
 * An instance edits values only, and reset lives on the parent row.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import {
  defaultEnumOptions,
  defaultScalarValue,
  isArrayPropertyValue,
  isObjectPropertyValue,
  isScalarPropertyValue,
  reconcileStructuredValue,
} from '@/lib/component-properties';
import { generateId } from '@/lib/utils';
import type {
  ComponentVariable,
  ComponentVariableValue,
  ScalarPropertyValue,
  StructuredField,
  StructuredFieldType,
} from '@/types';
import PropertyControlInput from './PropertyControlInput';

const FIELD_TYPES: Array<{ type: StructuredFieldType; label: string }> = [
  { type: 'text', label: 'Text' },
  { type: 'number', label: 'Number' },
  { type: 'boolean', label: 'Boolean' },
  { type: 'enum', label: 'Enum' },
  { type: 'color', label: 'Color' },
];

interface StructuredPropertyEditorProps {
  variable: ComponentVariable;
  value: ComponentVariableValue | undefined;
  onValueChange: (value: ComponentVariableValue) => void;
  /** Component dialog: edit the shared field list along with the default. */
  editableSchema?: boolean;
  onFieldsChange?: (fields: StructuredField[], value: ComponentVariableValue) => void;
}

function fieldVariable(field: StructuredField): ComponentVariable {
  return {
    id: field.id,
    name: field.name,
    type: field.type,
    options: field.options,
    min: field.min,
    max: field.max,
    step: field.step,
  };
}

function FieldValue({
  field,
  value,
  onChange,
}: {
  field: StructuredField;
  value: ScalarPropertyValue | undefined;
  onChange: (value: ScalarPropertyValue) => void;
}) {
  return (
    <PropertyControlInput
      variable={fieldVariable(field)}
      value={isScalarPropertyValue(value) ? value : defaultScalarValue(field)}
      onChange={(next) => {
        if (isScalarPropertyValue(next)) onChange(next);
      }}
    />
  );
}

function FieldSchemaRow({
  field,
  onChange,
  onRemove,
  canRemove,
}: {
  field: StructuredField;
  onChange: (field: StructuredField) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [name, setName] = useState(field.name);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex items-center gap-1">
        <Input
          value={name}
          aria-label="Field name"
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            const trimmed = name.trim() || 'Field';
            setName(trimmed);
            if (trimmed !== field.name) onChange({ ...field, name: trimmed });
          }}
        />
        <Select
          value={field.type}
          onValueChange={(next) => {
            if (!FIELD_TYPES.some((item) => item.type === next)) return;
            const type = next as StructuredFieldType;
            onChange({
              ...field,
              type,
              options: type === 'enum' ? (field.options?.length ? field.options : defaultEnumOptions()) : undefined,
            });
          }}
        >
          <SelectTrigger
            className="w-28 shrink-0"
            aria-label="Field type"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((item) => (
              <SelectItem
                key={item.type}
                value={item.type}
              >
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label={`Remove ${field.name}`}
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Icon name="x" />
        </Button>
      </div>
      {field.type === 'enum' && (
        <div className="flex flex-col gap-1">
          {(field.options ?? []).map((option, index) => (
            <div
              key={option.id}
              className="flex items-center gap-1"
            >
              <Input
                defaultValue={option.label}
                aria-label={`Option ${index + 1}`}
                onBlur={(event) => {
                  const label = event.target.value;
                  if (label === option.label) return;
                  onChange({
                    ...field,
                    options: (field.options ?? []).map((item) => (
                      item.id === option.id ? { ...item, label } : item
                    )),
                  });
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-label={`Remove ${option.label || 'option'}`}
                disabled={(field.options ?? []).length <= 1}
                onClick={() => onChange({
                  ...field,
                  options: (field.options ?? []).filter((item) => item.id !== option.id),
                })}
              >
                <Icon name="x" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => onChange({
              ...field,
              options: [...(field.options ?? []), { id: generateId('opt'), label: `Option ${(field.options ?? []).length + 1}` }],
            })}
          >
            <Icon name="plus" />
            Add option
          </Button>
        </div>
      )}
    </div>
  );
}

function FieldValues({
  fields,
  values,
  onChange,
}: {
  fields: StructuredField[];
  values: Record<string, ScalarPropertyValue>;
  onChange: (values: Record<string, ScalarPropertyValue>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {fields.map((field) => (
        <div
          key={field.id}
          className="grid grid-cols-3 items-center gap-2"
        >
          <span className="truncate text-xs text-muted-foreground">{field.name}</span>
          <div className="col-span-2 *:w-full">
            <FieldValue
              field={field}
              value={values[field.id]}
              onChange={(next) => onChange({ ...values, [field.id]: next })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StructuredPropertyEditor({
  variable,
  value,
  onValueChange,
  editableSchema = false,
  onFieldsChange,
}: StructuredPropertyEditorProps) {
  const fields = variable.fields ?? [];
  const isArray = variable.type === 'array';
  const objectValue = isObjectPropertyValue(value) ? value : reconcileStructuredValue('object', fields, value);
  const arrayValue = isArrayPropertyValue(value) ? value : reconcileStructuredValue('array', fields, value);

  const commitFields = (nextFields: StructuredField[]) => {
    const nextValue = isArray
      ? reconcileStructuredValue('array', nextFields, arrayValue)
      : reconcileStructuredValue('object', nextFields, objectValue);
    onFieldsChange?.(nextFields, nextValue);
  };

  return (
    <div className="flex flex-col gap-3">
      {editableSchema && (
        <div className="flex flex-col gap-2">
          {fields.map((field) => (
            <FieldSchemaRow
              key={field.id}
              field={field}
              canRemove={fields.length > 1}
              onChange={(next) => commitFields(fields.map((item) => (item.id === field.id ? next : item)))}
              onRemove={() => commitFields(fields.filter((item) => item.id !== field.id))}
            />
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => commitFields([...fields, { id: generateId('fld'), name: 'Field', type: 'text' }])}
          >
            <Icon name="plus" />
            Add field
          </Button>
        </div>
      )}

      {isArray ? (
        <div className="flex flex-col gap-2">
          {arrayValue.items.map((item, index) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-md border border-border p-2"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium">Item {index + 1}</span>
                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label="Move item up"
                    disabled={index === 0}
                    onClick={() => {
                      const items = arrayValue.items.slice();
                      const [moved] = items.splice(index, 1);
                      items.splice(index - 1, 0, moved);
                      onValueChange({ type: 'array', items });
                    }}
                  >
                    <Icon name="chevronUp" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label="Move item down"
                    disabled={index === arrayValue.items.length - 1}
                    onClick={() => {
                      const items = arrayValue.items.slice();
                      const [moved] = items.splice(index, 1);
                      items.splice(index + 1, 0, moved);
                      onValueChange({ type: 'array', items });
                    }}
                  >
                    <Icon name="chevronDown" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label="Remove item"
                    disabled={arrayValue.items.length <= 1}
                    onClick={() => onValueChange({
                      type: 'array',
                      items: arrayValue.items.filter((entry) => entry.id !== item.id),
                    })}
                  >
                    <Icon name="x" />
                  </Button>
                </div>
              </div>
              <FieldValues
                fields={fields}
                values={item.value}
                onChange={(next) => onValueChange({
                  type: 'array',
                  items: arrayValue.items.map((entry) => (
                    entry.id === item.id ? { ...entry, value: next } : entry
                  )),
                })}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => onValueChange({
              type: 'array',
              items: [...arrayValue.items, { id: generateId('item'), value: reconcileStructuredValue('object', fields, undefined).value }],
            })}
          >
            <Icon name="plus" />
            Add item
          </Button>
        </div>
      ) : (
        <FieldValues
          fields={fields}
          values={isObjectPropertyValue(objectValue) ? objectValue.value : {}}
          onChange={(next) => onValueChange({ type: 'object', value: next })}
        />
      )}
    </div>
  );
}
