'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import {
  BREAKPOINT_FRAME_GAP,
  DEFAULT_MOBILE_WIDTH,
  DEFAULT_TABLET_WIDTH,
  activeBreakpointAfterDelete,
  addBreakpointPreset,
  breakpointLabel,
  canvasFrameOrder,
  clampFrameWidth,
  deleteBreakpoint,
  duplicateBreakpoint,
  renameBreakpoint,
  resizeBreakpointWidth,
  setPrimaryBreakpoint,
  type BreakpointDefinition,
  type BreakpointPresetKey,
} from '@/lib/breakpoint-utils';
import { useBreakpointCatalog } from '@/hooks/use-breakpoint-catalog';
import { cn } from '@/lib/utils';
import type { Breakpoint } from '@/types';

export default function BreakpointFrames({
  active,
  activeFrameId,
  zoom,
  previewHeight = 640,
  previewHeights,
  onSelect,
  onActiveWidthChange,
  renderPreview,
  children,
}: {
  active: Breakpoint | 'all';
  activeFrameId?: string | null;
  zoom: number;
  /** Unscaled height used for frames that have not measured their own content yet. */
  previewHeight?: number;
  previewHeights?: Record<string, number>;
  onSelect: (breakpoint: BreakpointDefinition) => void;
  onActiveWidthChange?: (width: number) => void;
  /** Paints a non-selected frame. The selected frame renders `children`. */
  renderPreview?: (breakpoint: BreakpointDefinition) => ReactNode;
  children: ReactNode;
}) {
  const { catalog, commit } = useBreakpointCatalog();
  const [dragWidths, setDragWidths] = useState<Record<string, number>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [heldDeleteName, setHeldDeleteName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameOnCloseRef = useRef(false);
  const ignoreCloseBlur = useRef(false);
  const resizingRef = useRef<{
    id: string;
    edge: 'left' | 'right';
    startX: number;
    startWidth: number;
  } | null>(null);

  const frames = canvasFrameOrder(catalog).map((breakpoint) => (
    dragWidths[breakpoint.id] == null
      ? breakpoint
      : { ...breakpoint, width: dragWidths[breakpoint.id] }
  ));

  const scale = zoom / 100;
  const pendingDelete = catalog.find((breakpoint) => breakpoint.id === pendingDeleteId) ?? null;
  const pendingDeleteName = pendingDelete
    ? breakpointLabel(pendingDelete.id, catalog)
    : heldDeleteName;
  const resolvedActiveId = activeFrameId
    || frames.find((breakpoint) => breakpoint.id === active)?.id
    || frames[0]?.id
    || 'desktop';

  const handleSelect = useCallback((breakpoint: BreakpointDefinition) => {
    onActiveWidthChange?.(breakpoint.width);
    onSelect(breakpoint);
  }, [onActiveWidthChange, onSelect]);

  const handleAdd = useCallback((preset: BreakpointPresetKey) => {
    const mutation = addBreakpointPreset(catalog, preset);
    const created = mutation.created;
    if (mutation.error || !created) return;
    void commit(mutation);
    if (preset === 'custom') {
      renameOnCloseRef.current = true;
      ignoreCloseBlur.current = true;
      setRenamingId(created.id);
      setRenameValue(created.name);
      handleSelect(created);
      return;
    }
    handleSelect(created);
  }, [catalog, commit, handleSelect]);

  useEffect(() => {
    if (!renamingId) return;
    const frame = window.requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [renamingId]);

  const handleDelete = useCallback((breakpointId: string) => {
    const mutation = deleteBreakpoint(catalog, breakpointId);
    if (mutation.error) return;
    void commit(mutation);
    if (resolvedActiveId === breakpointId) {
      const next = activeBreakpointAfterDelete(mutation.catalog, breakpointId, resolvedActiveId);
      if (next) handleSelect(next);
    }
  }, [catalog, commit, handleSelect, resolvedActiveId]);

  const beginRename = (breakpoint: BreakpointDefinition, name: string) => {
    setRenamingId(breakpoint.id);
    setRenameValue(name);
    handleSelect(breakpoint);
  };

  const startRename = (breakpoint: BreakpointDefinition) => {
    beginRename(breakpoint, breakpointLabel(breakpoint.id, catalog));
  };

  const commitRename = () => {
    if (!renamingId) return;
    const current = catalog.find((breakpoint) => breakpoint.id === renamingId);
    const nextName = renameValue.trim();
    setRenamingId(null);
    if (!current || !nextName || nextName === current.name) return;
    void commit(renameBreakpoint(catalog, renamingId, nextName));
  };

  const handleResizeStart = useCallback((
    event: PointerEvent<HTMLDivElement>,
    breakpoint: BreakpointDefinition,
    edge: 'left' | 'right',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    resizingRef.current = {
      id: breakpoint.id,
      edge,
      startX: event.clientX,
      startWidth: breakpoint.width,
    };
    setDraggingId(breakpoint.id);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }, []);

  const handleResizeMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const resizing = resizingRef.current;
    if (!resizing) return;
    const delta = (event.clientX - resizing.startX) / Math.max(scale, 0.01);
    const signed = resizing.edge === 'left' ? -delta : delta;
    const width = clampFrameWidth(resizing.startWidth + signed);
    setDragWidths((current) => ({ ...current, [resizing.id]: width }));
    if (resizing.id === resolvedActiveId) onActiveWidthChange?.(width);
  }, [onActiveWidthChange, resolvedActiveId, scale]);

  const handleResizeEnd = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const resizing = resizingRef.current;
    if (!resizing) return;
    resizingRef.current = null;
    setDraggingId(null);
    try {
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released.
    }
    setDragWidths((current) => {
      const width = current[resizing.id];
      if (width != null) {
        const mutation = resizeBreakpointWidth(catalog, resizing.id, width);
        void commit(mutation).then((saved) => {
          const next = saved.catalog.find((breakpoint) => breakpoint.id === resizing.id);
          if (next && resizing.id === resolvedActiveId) onSelect(next);
        });
      }
      const next = { ...current };
      delete next[resizing.id];
      return next;
    });
  }, [catalog, commit, onSelect, resolvedActiveId]);

  const phoneTaken = catalog.some((breakpoint) => breakpoint.id === 'mobile');
  const tabletTaken = catalog.some((breakpoint) => breakpoint.id === 'tablet');

  return (
    <div
      className="flex items-start"
      style={{ gap: BREAKPOINT_FRAME_GAP * scale }}
    >
      {frames.map((breakpoint) => {
        const isActive = breakpoint.id === resolvedActiveId
          || (active === 'all' && breakpoint.id === 'desktop');
        const label = breakpointLabel(breakpoint.id, catalog);
        const measuredHeight = previewHeights?.[breakpoint.id];
        const unscaledHeight = measuredHeight && measuredHeight > 0
          ? measuredHeight
          : Math.max(previewHeight, 1);
        const isRenaming = renamingId === breakpoint.id;

        return (
          <div
            key={breakpoint.id}
            className="relative flex flex-col items-start"
            data-breakpoint-id={breakpoint.id}
          >
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  className="mb-2 flex h-6 min-w-0 cursor-default items-baseline gap-2 text-[11px] text-neutral-500 dark:text-white/45"
                  onClick={() => handleSelect(breakpoint)}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    startRename(breakpoint);
                  }}
                >
                  {isRenaming ? (
                    <Input
                      ref={renameInputRef}
                      value={renameValue}
                      aria-label={`${label} name`}
                      autoFocus
                      disableKeyboardStep
                      className="h-6 w-28 px-1.5 text-[11px]"
                      onChange={(event) => setRenameValue(event.target.value)}
                      onBlur={(event) => {
                        // The add menu moves focus as it closes. That blur is
                        // not the user leaving the name field.
                        if (ignoreCloseBlur.current && event.relatedTarget) {
                          ignoreCloseBlur.current = false;
                          window.requestAnimationFrame(() => {
                            renameInputRef.current?.focus();
                            renameInputRef.current?.select();
                          });
                          return;
                        }
                        ignoreCloseBlur.current = false;
                        commitRename();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                        if (event.key === 'Escape') {
                          setRenamingId(null);
                        }
                      }}
                      onClick={(event) => event.stopPropagation()}
                    />
                  ) : (
                    <span
                      className={cn(
                        'truncate font-medium',
                        isActive ? 'text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-white/75',
                      )}
                    >
                      {label}
                    </span>
                  )}
                  <span className="tabular-nums">{breakpoint.width}</span>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => startRename(breakpoint)}>
                  Rename
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={breakpoint.primary === true}
                  onSelect={() => {
                    void commit(setPrimaryBreakpoint(catalog, breakpoint.id));
                  }}
                >
                  Set as Primary
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    const mutation = duplicateBreakpoint(catalog, breakpoint.id);
                    void commit(mutation).then((saved) => {
                      const created = saved.created
                        ? saved.catalog.find((item) => item.id === saved.created?.id) ?? saved.created
                        : undefined;
                      if (created) handleSelect(created);
                    });
                  }}
                >
                  Duplicate
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  disabled={breakpoint.primary === true}
                  onSelect={() => {
                    setPendingDeleteId(breakpoint.id);
                    setHeldDeleteName(label);
                  }}
                >
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>

            <div
              className="relative"
              onClick={() => handleSelect(breakpoint)}
            >
              {isActive ? children : (
                <div
                  className="overflow-hidden rounded-[10px] bg-white shadow-[0_18px_40px_rgba(0,0,0,0.08)] outline outline-black/5 dark:bg-[#111] dark:outline-white/10"
                  style={{ width: breakpoint.width * scale, height: unscaledHeight * scale }}
                >
                  <div
                    className="pointer-events-none origin-top-left"
                    style={{
                      width: breakpoint.width,
                      height: unscaledHeight,
                      transform: `scale(${scale})`,
                    }}
                  >
                    {renderPreview ? renderPreview(breakpoint) : (
                      <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                        {label}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {draggingId === breakpoint.id && (
                <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] tabular-nums text-white">
                  {breakpoint.width}
                </div>
              )}

              {(['left', 'right'] as const).map((edge) => (
                <div
                  key={edge}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Resize ${label} ${edge} edge`}
                  className={cn(
                    'absolute top-0 z-10 h-full w-2 cursor-ew-resize',
                    edge === 'right' ? '-right-1' : '-left-1',
                    'after:absolute after:inset-y-2 after:w-px after:bg-neutral-400/80 after:opacity-0 hover:after:opacity-100 dark:after:bg-white/40',
                    edge === 'right' ? 'after:right-0.5' : 'after:left-0.5',
                  )}
                  onPointerDown={(event) => handleResizeStart(event, breakpoint, edge)}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                  onPointerCancel={handleResizeEnd}
                />
              ))}
            </div>
          </div>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Add breakpoint"
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-800 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <Icon name="plus" className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-44"
          onCloseAutoFocus={(event) => {
            if (!renameOnCloseRef.current) return;
            renameOnCloseRef.current = false;
            event.preventDefault();
          }}
        >
          <DropdownMenuItem
            disabled={tabletTaken}
            onSelect={() => handleAdd('tablet')}
          >
            <span className="flex-1">Tablet</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{DEFAULT_TABLET_WIDTH}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={phoneTaken}
            onSelect={() => handleAdd('phone')}
          >
            <span className="flex-1">Phone</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{DEFAULT_MOBILE_WIDTH}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handleAdd('custom')}>
            Custom
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
        onConfirm={() => {
          if (pendingDeleteId) handleDelete(pendingDeleteId);
        }}
      />
    </div>
  );
}
