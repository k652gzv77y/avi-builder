'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  CANVAS_BREAKPOINT_FRAMES_SETTING,
  clampFrameWidth,
  normalizeCanvasBreakpointFrames,
  widthToBreakpoint,
  type CanvasBreakpointFrame,
} from '@/lib/breakpoint-utils';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { cn } from '@/lib/utils';
import type { Breakpoint } from '@/types';

const PREVIEW_HEIGHT = 820;

export default function BreakpointFrames({
  active,
  activeFrameId,
  zoom,
  previewUrl,
  onSelect,
  onActiveWidthChange,
  children,
}: {
  active: Breakpoint | 'all';
  activeFrameId?: string | null;
  zoom: number;
  previewUrl?: string;
  onSelect: (mode: Breakpoint, frame: CanvasBreakpointFrame) => void;
  onActiveWidthChange?: (width: number) => void;
  children: React.ReactNode;
}) {
  const savedFrames = useSettingsStore(
    (state) => state.settingsByKey[CANVAS_BREAKPOINT_FRAMES_SETTING],
  );
  const saveSettings = useSettingsStore((state) => state.saveSettings);

  const [frames, setFrames] = useState<CanvasBreakpointFrame[]>(() =>
    normalizeCanvasBreakpointFrames(savedFrames),
  );
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizingRef = useRef<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    setFrames(normalizeCanvasBreakpointFrames(savedFrames));
  }, [savedFrames]);

  const persistFrames = useCallback(
    (next: CanvasBreakpointFrame[]) => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        void saveSettings({ [CANVAS_BREAKPOINT_FRAMES_SETTING]: next });
      }, 300);
    },
    [saveSettings],
  );

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, []);

  const scale = zoom / 100;
  const resolvedActiveId =
    activeFrameId
    || frames.find((frame) => frame.id === active)?.id
    || frames.find((frame) => widthToBreakpoint(frame.width) === active)?.id
    || frames[0]?.id
    || 'desktop';

  const updateFrames = useCallback(
    (updater: (prev: CanvasBreakpointFrame[]) => CanvasBreakpointFrame[]) => {
      setFrames((prev) => {
        const next = updater(prev);
        persistFrames(next);
        return next;
      });
    },
    [persistFrames],
  );

  const handleSelect = useCallback(
    (frame: CanvasBreakpointFrame) => {
      const mode = widthToBreakpoint(frame.width);
      onActiveWidthChange?.(frame.width);
      onSelect(mode, frame);
    },
    [onActiveWidthChange, onSelect],
  );

  const handleAdd = useCallback(() => {
    const customCount = frames.filter((frame) => !frame.locked).length;
    const width = clampFrameWidth(600);
    const frame: CanvasBreakpointFrame = {
      id: `custom-${Date.now()}`,
      label: customCount === 0 ? 'Custom' : `Custom ${customCount + 1}`,
      width,
      locked: false,
    };
    updateFrames((prev) => [...prev, frame]);
    handleSelect(frame);
  }, [frames, handleSelect, updateFrames]);

  const handleDelete = useCallback(
    (frameId: string) => {
      const target = frames.find((frame) => frame.id === frameId);
      if (!target || target.locked || frames.length <= 1) return;

      const next = frames.filter((frame) => frame.id !== frameId);
      updateFrames(() => next);

      if (resolvedActiveId === frameId && next[0]) {
        handleSelect(next[0]);
      }
    },
    [frames, handleSelect, resolvedActiveId, updateFrames],
  );

  const handleResizeStart = useCallback(
    (event: React.PointerEvent, frame: CanvasBreakpointFrame) => {
      event.preventDefault();
      event.stopPropagation();
      resizingRef.current = {
        id: frame.id,
        startX: event.clientX,
        startWidth: frame.width,
      };
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    [],
  );

  const handleResizeMove = useCallback(
    (event: React.PointerEvent) => {
      const resizing = resizingRef.current;
      if (!resizing) return;

      const delta = (event.clientX - resizing.startX) / Math.max(scale, 0.01);
      const width = clampFrameWidth(resizing.startWidth + delta);

      setFrames((prev) =>
        prev.map((frame) =>
          frame.id === resizing.id ? { ...frame, width } : frame,
        ),
      );

      if (resizing.id === resolvedActiveId) {
        onActiveWidthChange?.(width);
      }
    },
    [onActiveWidthChange, resolvedActiveId, scale],
  );

  const handleResizeEnd = useCallback(
    (event: React.PointerEvent) => {
      if (!resizingRef.current) return;
      const { id } = resizingRef.current;
      resizingRef.current = null;
      try {
        (event.target as HTMLElement).releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }

      setFrames((prev) => {
        persistFrames(prev);
        const frame = prev.find((entry) => entry.id === id);
        if (frame && id === resolvedActiveId) {
          onActiveWidthChange?.(frame.width);
          onSelect(widthToBreakpoint(frame.width), frame);
        }
        return prev;
      });
    },
    [onActiveWidthChange, onSelect, persistFrames, resolvedActiveId],
  );

  return (
    <div className="flex items-start gap-8">
      {frames.map((frame) => {
        const isActive = frame.id === resolvedActiveId
          || (active === 'all' && frame.id === 'desktop');
        const displayWidth = frame.width * scale;
        const displayHeight = Math.max(420, PREVIEW_HEIGHT * scale);

        return (
          <div key={frame.id} className="relative flex flex-col items-start gap-2">
            <div className="flex w-full items-center gap-2 text-[11px] text-neutral-500 dark:text-white/40">
              <button
                type="button"
                className="flex min-w-0 items-baseline gap-2 text-left"
                onClick={() => handleSelect(frame)}
              >
                <span className="truncate font-medium text-neutral-800 dark:text-white/80">
                  {frame.label}
                </span>
                <span className="tabular-nums">{frame.width}</span>
              </button>
              {!frame.locked && frames.length > 1 && (
                <button
                  type="button"
                  aria-label={`Delete ${frame.label}`}
                  className="ml-auto rounded p-0.5 text-neutral-400 hover:bg-neutral-200/70 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-white/80"
                  onClick={() => handleDelete(frame.id)}
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
                  onClick={() => handleSelect(frame)}
                  className="overflow-hidden rounded-[10px] bg-white shadow-[0_18px_40px_rgba(0,0,0,0.08)] outline outline-black/5 dark:bg-[#111] dark:outline-white/10"
                  style={{ width: displayWidth, height: displayHeight }}
                >
                  {previewUrl ? (
                    <iframe
                      title={`${frame.label} preview`}
                      src={previewUrl}
                      className="pointer-events-none origin-top-left border-0 bg-white"
                      style={{
                        width: frame.width,
                        height: PREVIEW_HEIGHT,
                        transform: `scale(${scale})`,
                      }}
                      tabIndex={-1}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                      {frame.label}
                    </div>
                  )}
                </button>
              )}

              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={`Resize ${frame.label}`}
                className={cn(
                  'absolute top-0 -right-1 z-10 h-full w-2 cursor-ew-resize',
                  'after:absolute after:inset-y-2 after:right-0.5 after:w-px after:bg-neutral-300/80 after:opacity-0 hover:after:opacity-100 dark:after:bg-white/30',
                )}
                onPointerDown={(event) => handleResizeStart(event, frame)}
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
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
