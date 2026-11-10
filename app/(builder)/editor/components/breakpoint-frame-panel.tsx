'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBreakpointCatalog } from '@/hooks/use-breakpoint-catalog';
import { breakpointLabel, resizeBreakpointWidth } from '@/lib/breakpoint-utils';
import { useEditorStore } from '@/stores/useEditorStore';

/** Width of the selected breakpoint frame. Shown when no layer is selected. */
export default function BreakpointFramePanel() {
  const activeBreakpoint = useEditorStore((state) => state.activeBreakpoint);
  const { catalog, commit } = useBreakpointCatalog();
  const breakpoint = catalog.find((item) => item.id === activeBreakpoint)
    ?? catalog.find((item) => item.primary)
    ?? catalog[0];
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setDraft(null);
  }, [breakpoint?.id]);

  if (!breakpoint) return null;

  const label = breakpointLabel(breakpoint.id, catalog);
  const shown = draft ?? String(breakpoint.width);

  const commitWidth = () => {
    const width = Number(shown);
    setDraft(null);
    if (!Number.isFinite(width) || width === breakpoint.width) return;
    void commit(resizeBreakpointWidth(catalog, breakpoint.id, width));
  };

  return (
    <div className="flex w-64 shrink-0 flex-col gap-3 border-l bg-background p-4 h-full">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-xs font-medium">{label}</p>
        {breakpoint.primary && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Primary</span>
        )}
      </div>
      <label className="flex flex-col gap-1">
        <Label className="text-[11px] text-muted-foreground">Width</Label>
        <Input
          value={shown}
          aria-label={`${label} width`}
          inputMode="numeric"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitWidth}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </label>
    </div>
  );
}
