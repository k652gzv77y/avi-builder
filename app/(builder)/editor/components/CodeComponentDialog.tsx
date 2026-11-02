'use client';

/**
 * Create or edit a code component: HTML template plus property controls.
 * Saved through the existing component create/update APIs.
 */

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  PROPERTY_CONTROL_LABELS,
  PROPERTY_CONTROL_TYPES,
  codeComponentMasterLayers,
  controlIdFromName,
  readCodeComponent,
  validatePropertyControls,
} from '@/lib/code-components';
import { useComponentsStore } from '@/stores/useComponentsStore';
import type { Component, PropertyControl, PropertyControlType } from '@/types';

interface CodeComponentDialogProps {
  open: boolean;
  component: Component | null;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_SOURCE = '<div style="padding:16px;font:16px sans-serif">{{title}}</div>';

function freshControls(): PropertyControl[] {
  return [{ id: 'title', name: 'Title', type: 'string', defaultValue: 'Hello' }];
}

export default function CodeComponentDialog({
  open,
  component,
  onOpenChange,
}: CodeComponentDialogProps) {
  const createComponent = useComponentsStore((state) => state.createComponent);
  const updateComponent = useComponentsStore((state) => state.updateComponent);
  const [name, setName] = useState('Code component');
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [controls, setControls] = useState<PropertyControl[]>(freshControls);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const definition = component ? readCodeComponent(component) : null;
    setName(component?.name || 'Code component');
    setSource(definition?.source || DEFAULT_SOURCE);
    setControls(definition?.controls?.length ? definition.controls : freshControls());
    setError(null);
  }, [open, component]);

  const handleAddControl = () => {
    const taken = new Set(controls.map((control) => control.id));
    const label = 'Text';
    setControls((current) => [
      ...current,
      {
        id: controlIdFromName(label, taken),
        name: label,
        type: 'string',
        defaultValue: '',
      },
    ]);
  };

  const handleControlChange = (index: number, patch: Partial<PropertyControl>) => {
    setControls((current) => current.map((control, controlIndex) => {
      if (controlIndex !== index) return control;
      return { ...control, ...patch };
    }));
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    const validation = validatePropertyControls(controls);
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    setError(null);
    const layers = codeComponentMasterLayers({ source, controls });

    try {
      if (component) {
        await updateComponent(component.id, { name: trimmed, layers });
      } else {
        const created = await createComponent(trimmed, layers);
        if (!created) {
          setError('Could not create the code component');
          return;
        }
      }
      onOpenChange(false);
    } catch (saveError) {
      console.error('Failed to save code component:', saveError);
      toast.error('Could not save code component');
      setError(saveError instanceof Error ? saveError.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{component ? 'Edit code component' : 'New code component'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code-component-name">Name</Label>
            <Input
              id="code-component-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code-component-source">Template</Label>
            <Textarea
              id="code-component-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="min-h-28 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Use {'{{controlId}}'} for a property. Values are escaped.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label>Property controls</Label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleAddControl}
            >
              Add control
            </Button>
          </div>

          {controls.map((control, index) => (
            <div key={control.id} className="flex flex-col gap-2 rounded-lg border p-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  aria-label={`Name for ${control.id}`}
                  value={control.name}
                  onChange={(event) => handleControlChange(index, { name: event.target.value })}
                />
                <Select
                  value={control.type}
                  onValueChange={(value) => handleControlChange(index, {
                    type: value as PropertyControlType,
                    options: value === 'enum' ? (control.options?.length ? control.options : ['Option']) : undefined,
                  })}
                >
                  <SelectTrigger aria-label={`Type for ${control.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_CONTROL_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {PROPERTY_CONTROL_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">{`{{${control.id}}}`}</p>
              {control.type === 'enum' && (
                <Input
                  aria-label={`Options for ${control.name}`}
                  value={(control.options || []).join(', ')}
                  placeholder="Option A, Option B"
                  onChange={(event) => handleControlChange(index, {
                    options: event.target.value.split(',').map((option) => option.trim()).filter(Boolean),
                  })}
                />
              )}
              {control.type === 'boolean' ? null : (
                <Input
                  aria-label={`Default for ${control.name}`}
                  value={control.defaultValue === undefined ? '' : String(control.defaultValue)}
                  placeholder="Default"
                  onChange={(event) => handleControlChange(index, {
                    defaultValue: control.type === 'number' ? Number(event.target.value) : event.target.value,
                  })}
                />
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setControls((current) => current.filter((_, controlIndex) => controlIndex !== index))}
              >
                Remove
              </Button>
            </div>
          ))}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => { void handleSave(); }}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
