'use client';

/**
 * Instance editor for a slot. No override shows the component fallback.
 * Replacing stores a layer tree on the instance; reset clears it.
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { cloneLayersWithNewIds, createSlotFrame, createSlotTextLayer } from '@/lib/component-properties';
import type { Layer, SlotPropertyValue } from '@/types';

interface SlotContentEditorProps {
  value: SlotPropertyValue | undefined;
  fallback: Layer[];
  onChange: (value: SlotPropertyValue | undefined) => void;
}

function layerLabel(layer: Layer): string {
  const text = layer.variables?.text;
  if (text && 'type' in text && text.type === 'dynamic_text') return text.data.content || 'Text';
  if (layer.name === 'div') return layer.customName || 'Frame';
  return layer.customName || layer.name || 'Layer';
}

function textContent(layer: Layer): string | null {
  const text = layer.variables?.text;
  if (text && 'type' in text && text.type === 'dynamic_text') return text.data.content;
  return null;
}

function withText(layer: Layer, content: string): Layer {
  return {
    ...layer,
    variables: {
      ...layer.variables,
      text: { type: 'dynamic_text', data: { content } },
    },
  };
}

export default function SlotContentEditor({ value, fallback, onChange }: SlotContentEditorProps) {
  if (!value) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          {fallback.length > 0
            ? 'Showing the component content. Replace it to use different layers on this instance.'
            : 'This slot is empty. Add layers on the component, or replace it here.'}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => onChange({
            type: 'slot',
            layers: fallback.length > 0 ? cloneLayersWithNewIds(fallback) : [createSlotTextLayer()],
          })}
        >
          Replace content
        </Button>
      </div>
    );
  }

  const updateLayer = (id: string, next: Layer) => {
    onChange({
      type: 'slot',
      layers: value.layers.map((layer) => (layer.id === id ? next : layer)),
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {value.layers.length === 0 && (
        <p className="text-xs text-muted-foreground">This instance hides the component content.</p>
      )}
      {value.layers.map((layer, index) => {
        const content = textContent(layer);
        return (
          <div
            key={layer.id}
            className="flex items-center gap-1"
          >
            {content !== null ? (
              <Input
                value={content}
                aria-label={`Slot text ${index + 1}`}
                onChange={(event) => updateLayer(layer.id, withText(layer, event.target.value))}
              />
            ) : (
              <span className="min-w-0 flex-1 truncate text-xs">{layerLabel(layer)}</span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-label={`Remove ${layerLabel(layer)}`}
              onClick={() => onChange({
                type: 'slot',
                layers: value.layers.filter((item) => item.id !== layer.id),
              })}
            >
              <Icon name="x" />
            </Button>
          </div>
        );
      })}
      <div className="flex gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange({ type: 'slot', layers: [...value.layers, createSlotTextLayer()] })}
        >
          <Icon name="plus" />
          Text
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange({ type: 'slot', layers: [...value.layers, createSlotFrame()] })}
        >
          <Icon name="plus" />
          Frame
        </Button>
      </div>
    </div>
  );
}
