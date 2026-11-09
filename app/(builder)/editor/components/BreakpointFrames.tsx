'use client';

import { useCallback, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Icon from '@/components/ui/icon';
import {
  clampFrameWidth,
  createBreakpoint,
  deleteBreakpoint,
  formatBreakpointRange,
  isBaseBreakpoint,
  updateBreakpointRange,
  type BreakpointDefinition,
} from '@/lib/breakpoint-utils';
import { useBreakpointCatalog } from '@/hooks/use-breakpoint-catalog';
import { cn } from '@/lib/utils';
import type { Breakpoint } from '@/types';

const PREVIEW_HEIGHT = 820;

function frameIcon(breakpoint: BreakpointDefinition): 'desktop' | 'tablet' | 'canvas-phone' | 'breakpoint' {
  if (breakpoint.id === 'desktop') return 'desktop';
  if (breakpoint.id === 'tablet') return 'tablet';
  if (breakpoint.id === 'mobile') return 'canvas-phone';
  return 'breakpoint';
}

export default function BreakpointFrames({
  active,
  activeFrameId,
  zoom,
  onSelect,
  onActiveWidthChange,
  children,
}: {
  active: Breakpoint | 'all';
  activeFrameId?: string | null;
  zoom: number;
  onSelect: (breakpoint: BreakpointDefinition) => void;
  onActiveWidthChange?: (width: number) => void;
  children: React.ReactNode;
}) {
  const { catalog, commit } = useBreakpointCatalog();
  const [dragWidths, setDragWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const frames = catalog.map((breakpoint) => (
    dragWidths[breakpoint.id] == null
      ? breakpoint
      : { ...breakpoint, width: dragWidths[breakpoint.id] }
  ));

  const scale = zoom / 100;
  const resolvedActiveId = activeFrameId
    || frames.find((breakpoint) => breakpoint.id === active)?.id
    || frames[0]?.id
    || 'desktop';

  const handleSelect = useCallback((breakpoint: BreakpointDefinition) => {
    onActiveWidthChange?.(breakpoint.width);
    onSelect(breakpoint);
  }, [onActiveWidthChange, onSelect]);

  const handleAdd = useCallback(() => {
    const mutation = createBreakpoint(catalog);
    void commit(mutation).then((saved) => {
      if (saved.created) handleSelect(saved.created);
    });
  }, [catalog, commit, handleSelect]);

  const handleDelete = useCallback((breakpointId: string) => {
    const mutation = deleteBreakpoint(catalog, breakpointId);
    void commit(mutation);
    if (!mutation.error && resolvedActiveId === breakpointId) {
      const next = mutation.catalog[0];
      if (next) handleSelect(next);
    }
  }, [catalog, commit, handleSelect, resolvedActiveId]);

  const handleResizeStart = useCallback((event: React.PointerEvent, breakpoint: BreakpointDefinition) => {
    event.preventDefault();
    event.stopPropagation();
    resizingRef.current = {
      id: breakpoint.id,
      startX: event.clientX,
      startWidth: breakpoint.width,
    };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }, []);

  const handleResizeMove = useCallback((event: React.PointerEvent) => {
    const resizing = resizingRef.current;
    if (!resizing) return;
    const delta = (event.clientX - resizing.startX) / Math.max(scale, 0.01);
    const width = clampFrameWidth(resizing.startWidth + delta);
    setDragWidths((current) => ({ ...current, [resizing.id]: width }));
    if (resizing.id === resolvedActiveId) onActiveWidthChange?.(width);
  }, [onActiveWidthChange, resolvedActiveId, scale]);

  const handleResizeEnd = useCallback((event: React.PointerEvent) => {
    const resizing = resizingRef.current;
    if (!resizing) return;
    resizingRef.current = null;
    try {
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released.
    }
    setDragWidths((current) => {
      const width = current[resizing.id];
      if (width != null) {
        const saved = catalog.find((breakpoint) => breakpoint.id === resizing.id);
        void commit(updateBreakpointRange(catalog, resizing.id, { width }));
        if (saved && resizing.id === resolvedActiveId) {
          onSelect({ ...saved, width });
        }
      }
      const next = { ...current };
      delete next[resizing.id];
      return next;
    });
  }, [catalog, commit, onSelect, resolvedActiveId]);

  return (
    <div className="flex items-start gap-10">
      {frames.map((breakpoint) => {
        const isActive = breakpoint.id === resolvedActiveId
          || (active === 'all' && breakpoint.id === 'desktop');
        const displayWidth = breakpoint.width * scale;
        const displayHeight = Math.max(420, PREVIEW_HEIGHT * scale);

        return (
          <div key={breakpoint.id} className="relative flex flex-col items-start gap-2">
            <div className="flex w-full items-center gap-2 text-[11px] text-neutral-500 dark:text-white/40">
              <button
                type="button"
                className="flex min-w-0 items-baseline gap-2 text-left"
                onClick={() => handleSelect(breakpoint)}
              >
                <Icon
                  name={frameIcon(breakpoint)}
                  className="size-3.5 shrink-0 self-center"
                />
                <span className="truncate font-medium text-neutral-800 dark:text-white/80">
                  {breakpoint.name}
                </span>
                {isBaseBreakpoint(breakpoint.id) && (
                  <span className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-white/35">
                    Primary
                  </span>
                )}
                <span className="tabular-nums">{breakpoint.width}</span>
                <span className="text-[10px] opacity-70">{formatBreakpointRange(breakpoint)}</span>
              </button>
              {!breakpoint.system && frames.length > 1 && (
                <button
                  type="button"
                  aria-label={`Delete ${breakpoint.name}`}
                  className="ml-auto rounded p-0.5 text-neutral-400 hover:bg-neutral-200/70 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-white/80"
                  onClick={() => handleDelete(breakpoint.id)}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <div className="relative">
              {isActive ? (
                children
              ) : (
                <button
                  type="button"
                  onClick={() => handleSelect(breakpoint)}
                  className="overflow-hidden rounded-[10px] bg-white shadow-[0_18px_40px_rgba(0,0,0,0.08)] outline outline-black/5 dark:bg-[#111] dark:outline-white/10"
                  style={{ width: displayWidth, height: displayHeight }}
                >
                  <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                    {breakpoint.name}
                  </div>
                </button>
              )}

              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={`Resize ${breakpoint.name}`}
                className={cn(
                  'absolute top-0 -right-1 z-10 h-full w-2 cursor-ew-resize',
                  'after:absolute after:inset-y-2 after:right-0.5 after:w-px after:bg-neutral-300/80 after:opacity-0 hover:after:opacity-100 dark:after:bg-white/30',
                )}
                onPointerDown={(event) => handleResizeStart(event, breakpoint)}
                onPointerMove={handleResizeMove}
                onPointerUp={handleResizeEnd}
                onPointerCancel={handleResizeEnd}
              />
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={handleAdd}
        aria-label="Add breakpoint"
        className="mt-7 flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-neutral-300 text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-800 dark:border-white/20 dark:text-white/50 dark:hover:border-white/40 dark:hover:text-white/80"
      >
        <Icon name="canvas-plus" className="size-3.5" />
      </button>
    </div>
  );
}
