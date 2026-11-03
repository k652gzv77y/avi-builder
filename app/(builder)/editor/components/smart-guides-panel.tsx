'use client';

import { useMemo } from 'react';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { useActiveSnapGuides } from '@/hooks/use-active-snap-guides';
import { useShowCanvasGuides } from '@/hooks/use-show-canvas-guides';
import { isFreeformDraggable } from '@/lib/canvas-freeform';
import { activeGuideEntries } from '@/lib/canvas-snap-guides';

import { InspectorSection } from './inspector-section';

import type { Layer } from '@/types';

interface SmartGuidesPanelProps {
  layer: Layer | null;
  parent: Layer | null;
}

function formatGuideAt(at: number): string {
  const rounded = Math.round(at);
  return `${Object.is(rounded, -0) ? 0 : rounded}px`;
}

/**
 * Lists the parent and sibling edges the current free-form drag or resize
 * is snapped to. Hidden for in-flow layers so the inspector stays quiet.
 */
export function SmartGuidesPanel({ layer, parent }: SmartGuidesPanelProps) {
  const guides = useActiveSnapGuides();
  const { show, setShow } = useShowCanvasGuides();
  const entries = useMemo(() => activeGuideEntries(guides), [guides]);
  const relevant = isFreeformDraggable(layer, parent);

  if (!relevant && entries.length === 0) return null;

  return (
    <InspectorSection
      title="Guides"
      hint={entries.length > 0 ? 'Snap' : undefined}
    >
      <div
        className="flex items-center justify-between gap-2 py-2"
        data-panel="smart-guides"
      >
        <Label
          htmlFor="show-canvas-guides"
          variant="muted"
        >
          Show on canvas
        </Label>
        <Switch
          id="show-canvas-guides"
          size="sm"
          checked={show}
          onCheckedChange={setShow}
          aria-label="Show guides on canvas"
        />
      </div>
      {entries.length === 0 ? (
        <p className="py-2 text-[11px] leading-snug text-muted-foreground">
          No active guides
        </p>
      ) : (
        <ul
          className="flex max-h-40 flex-col overflow-y-auto py-1"
          aria-label="Active smart guides"
        >
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-baseline justify-between gap-3 py-1 text-xs"
            >
              <span className="min-w-0 truncate">{entry.label}</span>
              <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                {formatGuideAt(entry.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </InspectorSection>
  );
}
