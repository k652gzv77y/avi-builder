'use client';

/**
 * Code override: class and data/aria attributes only.
 *
 * Interactions already cover tap, hover, appear, scroll, and load.
 * Effects already cover opacity, shadow, and blur. This panel does not
 * replace either of those.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Layer } from '@/types';
import SettingsPanel from './SettingsPanel';

interface CodeOverrideSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function CodeOverrideSettings({ layer, onLayerUpdate }: CodeOverrideSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  if (!layer) return null;

  const current = layer.settings?.codeOverride;
  const attributes = Object.entries(current?.attributes || {});

  const write = (className: string, nextAttributes: Array<[string, string]>) => {
    const record: Record<string, string> = {};
    nextAttributes.forEach(([key, value], index) => {
      record[key || `data-field-${index}`] = value;
    });
    const hasClass = className.trim().length > 0;
    const hasAttributes = nextAttributes.length > 0;
    onLayerUpdate(layer.id, {
      settings: {
        ...layer.settings,
        codeOverride: hasClass || hasAttributes
          ? { className: className || undefined, attributes: hasAttributes ? record : undefined }
          : undefined,
      },
    });
  };

  return (
    <SettingsPanel
      title="Code override"
      collapsible
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <p className="text-xs text-muted-foreground leading-relaxed">
        Adds a class or a data/aria attribute on this layer. Events stay in
        Interactions. Opacity, shadow, and blur stay in Effects.
      </p>
      <div className="flex flex-col gap-2 mt-2">
        <Label htmlFor={`override-class-${layer.id}`} className="text-xs">Class</Label>
        <Input
          id={`override-class-${layer.id}`}
          value={current?.className || ''}
          placeholder="rounded-md"
          onChange={(event) => write(event.target.value, attributes)}
        />
        {attributes.map(([key, value], index) => (
          <div key={`${key}-${index}`} className="grid grid-cols-2 gap-1">
            <Input
              aria-label="Attribute name"
              value={key}
              placeholder="data-theme"
              onChange={(event) => {
                const next = attributes.map((entry, entryIndex) => (
                  entryIndex === index ? [event.target.value, entry[1]] as [string, string] : entry
                ));
                write(current?.className || '', next);
              }}
            />
            <Input
              aria-label="Attribute value"
              value={value}
              onChange={(event) => {
                const next = attributes.map((entry, entryIndex) => (
                  entryIndex === index ? [entry[0], event.target.value] as [string, string] : entry
                ));
                write(current?.className || '', next);
              }}
            />
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => write(current?.className || '', [...attributes, ['data-', '']])}
        >
          Add attribute
        </Button>
      </div>
    </SettingsPanel>
  );
}
