'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { editorBreakpointLabel, stripBreakpointOverrides, toClassList } from '@/lib/layout-model';
import { useEditorStore } from '@/stores/useEditorStore';
import type { Layer } from '@/types';

interface OverrideResetProps {
  isOverride: boolean;
  propertyLabel: string;
  onReset: () => void;
}

/** Blue dot that clears the active breakpoint's override for one property. */
export function OverrideReset({ isOverride, propertyLabel, onReset }: OverrideResetProps) {
  const activeBreakpoint = useEditorStore((state) => state.activeBreakpoint);
  if (!isOverride) return null;

  const breakpointLabel = editorBreakpointLabel(activeBreakpoint);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="size-5 px-0"
          aria-label={`Reset ${propertyLabel} ${breakpointLabel} override`}
          onClick={onReset}
        >
          <span className="size-1.5 rounded-full bg-sky-500" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {breakpointLabel} override. Reset to the inherited value.
      </TooltipContent>
    </Tooltip>
  );
}

interface BreakpointContextBarProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

/**
 * Shown while editing Tablet or Phone. Desktop is the primary breakpoint;
 * edits here are overrides and can be cleared for the selected layer.
 */
export function BreakpointContextBar({ layer, onLayerUpdate }: BreakpointContextBarProps) {
  const activeBreakpoint = useEditorStore((state) => state.activeBreakpoint);
  if (!layer || activeBreakpoint === 'desktop') return null;

  const breakpointLabel = editorBreakpointLabel(activeBreakpoint);
  const classes = toClassList(layer.classes);
  const hasOverride = classes.some((cls) => (
    activeBreakpoint === 'mobile' ? cls.startsWith('max-md:') : cls.startsWith('max-lg:')
  ));

  const handleReset = () => {
    const next = stripBreakpointOverrides(classes, activeBreakpoint);
    onLayerUpdate(layer.id, { classes: next.join(' ') });
  };

  return (
    <div className="flex flex-col gap-2 px-0 py-3">
      <p className="text-[11px] leading-snug text-muted-foreground">
        Editing {breakpointLabel}. Desktop is primary and cascades here. Changes on {breakpointLabel} are overrides.
      </p>
      {hasOverride && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 self-start px-2 text-[11px]"
          onClick={handleReset}
        >
          Reset {breakpointLabel} overrides
        </Button>
      )}
    </div>
  );
}
