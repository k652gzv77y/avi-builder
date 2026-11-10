'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Icon from '@/components/ui/icon';
import { useBreakpointCatalog } from '@/hooks/use-breakpoint-catalog';
import {
  activeBreakpointAfterDelete,
  breakpointLabel,
  deleteBreakpoint,
  type BreakpointDefinition,
} from '@/lib/breakpoint-utils';
import { cn } from '@/lib/utils';
import type { Breakpoint } from '@/types';
import BreakpointManager from './breakpoint-manager';

function isConfirmDialogTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest('[data-slot="dialog-content"], [data-slot="dialog-overlay"]'));
}

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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [heldDeleteName, setHeldDeleteName] = useState('');
  const resolvedId = activeFrameId
    || catalog.find((breakpoint) => breakpoint.id === active)?.id
    || catalog[0]?.id;
  const pendingDelete = catalog.find((breakpoint) => breakpoint.id === pendingDeleteId) ?? null;
  const pendingDeleteName = pendingDelete
    ? breakpointLabel(pendingDelete.id, catalog)
    : heldDeleteName;

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    const deletedId = pendingDeleteId;
    const wasActive = deletedId === resolvedId;
    const mutation = deleteBreakpoint(catalog, deletedId);
    const saved = await commit(mutation);
    if (saved.error || !wasActive) return;
    const next = activeBreakpointAfterDelete(saved.catalog, deletedId, deletedId);
    if (next) onSelect(next);
  };

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
              <span className="font-medium">{breakpointLabel(breakpoint.id, catalog)}</span>
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
        <PopoverContent
          align="center"
          className="w-auto p-3"
          onFocusOutside={(event) => {
            if (isConfirmDialogTarget(event.target)) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (isConfirmDialogTarget(event.target)) event.preventDefault();
          }}
        >
          <BreakpointManager
            catalog={catalog}
            activeId={resolvedId}
            onCommit={commit}
            onSelect={onSelect}
            onDeleteRequest={(breakpoint) => {
              setPendingDeleteId(breakpoint.id);
              setHeldDeleteName(breakpointLabel(breakpoint.id, catalog));
            }}
          />
        </PopoverContent>
      </Popover>
      <ConfirmDialog
        open={pendingDeleteId != null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title={pendingDeleteName ? `Delete ${pendingDeleteName}?` : 'Delete breakpoint?'}
        description={pendingDeleteName
          ? `Overrides on ${pendingDeleteName} will be removed.`
          : 'Overrides on this breakpoint will be removed.'}
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
