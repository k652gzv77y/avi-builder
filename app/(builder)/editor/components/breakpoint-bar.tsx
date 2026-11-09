'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Icon from '@/components/ui/icon';
import { useBreakpointCatalog } from '@/hooks/use-breakpoint-catalog';
import { cn } from '@/lib/utils';
import type { Breakpoint } from '@/types';
import type { BreakpointDefinition } from '@/lib/breakpoint-utils';
import BreakpointManager from './breakpoint-manager';

function frameIcon(breakpoint: BreakpointDefinition): 'desktop' | 'tablet' | 'canvas-phone' | 'breakpoint' {
  if (breakpoint.id === 'desktop') return 'desktop';
  if (breakpoint.id === 'tablet') return 'tablet';
  if (breakpoint.id === 'mobile') return 'canvas-phone';
  return 'breakpoint';
}

interface BreakpointBarProps {
  active: Breakpoint | 'all';
  activeFrameId?: string | null;
  onSelect: (breakpoint: BreakpointDefinition) => void;
}

/** Compact breakpoint switcher for the canvas chrome. */
export default function BreakpointBar({ active, activeFrameId, onSelect }: BreakpointBarProps) {
  const { catalog, commit } = useBreakpointCatalog();
  const resolvedId = activeFrameId
    || catalog.find((breakpoint) => breakpoint.id === active)?.id
    || catalog[0]?.id;

  return (
    <div className="flex max-w-full items-center gap-0.5">
      <div
        className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-md bg-secondary/70 p-0.5"
        role="tablist"
        aria-label="Breakpoints"
      >
        {catalog.map((breakpoint) => {
          const isActive = breakpoint.id === resolvedId;
          return (
            <button
              key={breakpoint.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(breakpoint)}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[11px] tabular-nums',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon name={frameIcon(breakpoint)} className="size-3 shrink-0" />
              <span className="font-medium">{breakpoint.name}</span>
              <span className="opacity-60">{breakpoint.width}</span>
            </button>
          );
        })}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Edit breakpoints"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Icon name="plus" className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-auto p-3">
          <BreakpointManager
            catalog={catalog}
            activeId={resolvedId}
            onCommit={commit}
            onSelect={onSelect}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
