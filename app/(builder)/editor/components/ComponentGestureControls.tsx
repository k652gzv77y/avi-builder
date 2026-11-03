'use client';

/**
 * Inspector controls for component variants.
 * Hover and Pressed are style replicas of the primary. Open and Closed stay
 * full variants. Layout breakpoints are unchanged.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SettingsPanel from './SettingsPanel';
import {
  countReplicaOverrides,
  isReplicaVariant,
  variantHasState,
} from '@/lib/component-variant-utils';
import { useComponentsStore } from '@/stores/useComponentsStore';
import type { ComponentVariantState } from '@/types';

interface ComponentGestureControlsProps {
  componentId: string;
  activeVariantId: string | null;
  selectedLayerId: string | null;
  onSelectVariant: (variantId: string) => void;
}

export default function ComponentGestureControls({
  componentId,
  activeVariantId,
  selectedLayerId,
  onSelectVariant,
}: ComponentGestureControlsProps) {
  const component = useComponentsStore((state) => state.components.find(item => item.id === componentId));
  const addVariant = useComponentsStore((state) => state.addVariant);
  const setVariantTrigger = useComponentsStore((state) => state.setVariantTrigger);
  const resetVariantOverrides = useComponentsStore((state) => state.resetVariantOverrides);
  const [open, setOpen] = useState(true);

  if (!component) return null;
  const variants = component.variants ?? [];
  if (variants.length === 0) return null;

  const active = variants.find(variant => variant.id === activeVariantId) ?? variants[0];
  const primary = variants.find(variant => !isReplicaVariant(variant)) ?? variants[0];
  const isPrimary = active.id === primary.id;
  const overrideCount = countReplicaOverrides(active.overrides);
  const layerOverridden = !!selectedLayerId && !!active.overrides?.[selectedLayerId];

  const handleCreate = async (preset?: { name: string; state: ComponentVariantState }) => {
    const newId = await addVariant(componentId, primary.id, preset);
    if (newId) onSelectVariant(newId);
  };

  const triggerValue = active.state && active.state !== 'default' ? active.state : 'custom';

  return (
    <SettingsPanel
      title="Variants" isOpen={open}
      onToggle={() => setOpen(!open)}
    >
      <div className="flex flex-col gap-2">
        <p className="text-[11px] leading-snug text-muted-foreground">
          Hover and Pressed switch a resting instance while the pointer is there, then return. That variant&apos;s property defaults apply.
        </p>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => { void handleCreate(); }}
          >
            Variant
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={variantHasState(variants, 'hover')}
            onClick={() => { void handleCreate({ name: 'Hover', state: 'hover' }); }}
          >
            Hover
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={variantHasState(variants, 'pressed')}
            onClick={() => { void handleCreate({ name: 'Pressed', state: 'pressed' }); }}
          >
            Pressed
          </Button>
        </div>

        <div className="grid grid-cols-3 items-center gap-2">
          <span className="text-xs text-muted-foreground">Editing</span>
          <div className="col-span-2">
            <Select value={active.id} onValueChange={onSelectVariant}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {variants.map(variant => (
                  <SelectItem key={variant.id} value={variant.id}>
                    {variant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!isPrimary && (
          <div className="grid grid-cols-3 items-center gap-2">
            <span className="text-xs text-muted-foreground">Trigger</span>
            <div className="col-span-2">
              <Select
                value={triggerValue}
                onValueChange={(value) => {
                  const next = value === 'custom' ? null : value as ComponentVariantState;
                  void setVariantTrigger(componentId, active.id, next);
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">None</SelectItem>
                  <SelectItem value="hover">Hover</SelectItem>
                  <SelectItem value="pressed">Pressed</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {isReplicaVariant(active) && (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] leading-snug text-muted-foreground">
              {overrideCount === 0
                ? 'No style overrides yet. Layout stays on the primary for every breakpoint.'
                : `${overrideCount} ${overrideCount === 1 ? 'layer overrides' : 'layers override'} the primary. Breakpoint layout is unchanged.`}
            </p>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={overrideCount === 0}
                onClick={() => { void resetVariantOverrides(componentId, active.id); }}
              >
                Reset overrides
              </Button>
              {layerOverridden && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => { void resetVariantOverrides(componentId, active.id, selectedLayerId!); }}
                >
                  Reset layer
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </SettingsPanel>
  );
}
