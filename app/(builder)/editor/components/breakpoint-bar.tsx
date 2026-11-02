'use client';

import Icon from '@/components/ui/icon';
import {
  CANVAS_BREAKPOINT_FRAMES_SETTING,
  normalizeCanvasBreakpointFrames,
  widthToBreakpoint,
  type CanvasBreakpointFrame,
} from '@/lib/breakpoint-utils';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { Breakpoint } from '@/types';

function frameIcon(frame: CanvasBreakpointFrame): 'desktop' | 'tablet' | 'canvas-phone' | 'breakpoint' {
  if (frame.id === 'desktop') return 'desktop';
  if (frame.id === 'tablet') return 'tablet';
  if (frame.id === 'mobile') return 'canvas-phone';
  return 'breakpoint';
}

interface BreakpointBarProps {
  active: Breakpoint | 'all';
  activeFrameId?: string | null;
  onSelect: (mode: Breakpoint, frame: CanvasBreakpointFrame) => void;
}

/** Compact breakpoint switcher for the canvas chrome. */
export default function BreakpointBar({ active, activeFrameId, onSelect }: BreakpointBarProps) {
  const savedFrames = useSettingsStore(
    (state) => state.settingsByKey[CANVAS_BREAKPOINT_FRAMES_SETTING],
  );
  const frames = normalizeCanvasBreakpointFrames(savedFrames);
  const resolvedId = activeFrameId
    || frames.find((frame) => frame.id === active)?.id
    || frames.find((frame) => widthToBreakpoint(frame.width) === active)?.id
    || frames[0]?.id;

  return (
    <div
      className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-md bg-secondary/70 p-0.5"
      role="tablist"
      aria-label="Breakpoints"
    >
      {frames.map((frame) => {
        const isActive = frame.id === resolvedId;
        return (
          <button
            key={frame.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(widthToBreakpoint(frame.width), frame)}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[11px] tabular-nums',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon name={frameIcon(frame)} className="size-3 shrink-0" />
            <span className="font-medium">{frame.label}</span>
            <span className="opacity-60">{frame.width}</span>
          </button>
        );
      })}
    </div>
  );
}
