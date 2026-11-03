'use client';

/**
 * Defaults for one component variable across every variant.
 * The primary row edits the shared default. Other rows inherit it until changed.
 * Stack rows keep the tablet and phone values already stored on the variable.
 */

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import PropertyControlInput from './PropertyControlInput';
import StackVariableControl from './StackVariableControl';
import { isStackVariableValue } from '@/lib/component-bindings';
import { variantPropertyDefault } from '@/lib/component-properties';
import type { Component, ComponentVariable, ComponentVariableValue } from '@/types';

interface VariantPropertyMatrixProps {
  component: Component;
  variable: ComponentVariable;
  onCommit: (variantId: string, value: ComponentVariableValue | null) => void;
}

export default function VariantPropertyMatrix({
  component,
  variable,
  onCommit,
}: VariantPropertyMatrixProps) {
  const variants = component.variants ?? [];
  const primaryId = variants[0]?.id;
  if (variants.length < 2 || !primaryId) return null;

  return (
    <div className="flex flex-col gap-3">
      {variants.map((variant) => {
        const isPrimary = variant.id === primaryId;
        const ownsDefault = !isPrimary && !!variant.propertyDefaults && variable.id in variant.propertyDefaults;
        const value = variantPropertyDefault(variable, component, variant.id);
        return (
          <div key={variant.id} className="grid grid-cols-3 items-center gap-2">
            <Label
              variant="muted"
              className="truncate"
              title={variant.name}
            >
              {variant.name}
            </Label>
            <div className="col-span-2 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                {variable.type === 'stack' && variable.stack_key ? (
                  <StackVariableControl
                    stackKey={variable.stack_key}
                    value={isStackVariableValue(value) ? value : { value: '' }}
                    onChange={(next) => onCommit(variant.id, next)}
                  />
                ) : (
                  <PropertyControlInput
                    variable={variable}
                    value={value}
                    onChange={(next) => onCommit(variant.id, next)}
                  />
                )}
              </div>
              {ownsDefault ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-label={`Reset ${variant.name} to ${variants[0]?.name ?? 'primary'}`}
                  onClick={() => onCommit(variant.id, null)}
                >
                  Reset
                </Button>
              ) : !isPrimary ? (
                <span className="shrink-0 text-[10px] text-muted-foreground">Inherited</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
