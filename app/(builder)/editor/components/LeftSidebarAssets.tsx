'use client';

/**
 * Assets tab — Framer-style list of reusable components.
 * Click inserts on the current canvas. Drag uses the existing canvas drop path.
 * Code files are not a stored asset type in this product, so the panel lists components only.
 */

import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { useEditComponent } from '@/hooks/use-edit-component';
import { useLocalizationMode } from '@/hooks/use-localization-mode';
import { isCircularComponentReference } from '@/lib/component-utils';
import { insertComponentOnCanvas } from '@/lib/insert-component-on-canvas';
import { cn } from '@/lib/utils';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import type { UseLiveLayerUpdatesReturn } from '@/hooks/use-live-layer-updates';
import type { Component } from '@/types';
import RenameComponentDialog from './RenameComponentDialog';

interface LeftSidebarAssetsProps {
  liveLayerUpdates?: UseLiveLayerUpdatesReturn | null;
  readOnly?: boolean;
}

interface AssetComponentRowProps {
  component: Component;
  insertDisabled?: boolean;
  showActions?: boolean;
  disabledReason?: string;
  onInsert: (componentId: string) => void;
  onEdit: (componentId: string) => void;
  onRename: (component: Component) => void;
  onDelete: (component: Component) => void;
}

function AssetComponentRow({
  component,
  insertDisabled = false,
  showActions = true,
  disabledReason,
  onInsert,
  onEdit,
  onRename,
  onDelete,
}: AssetComponentRowProps) {
  const startCanvasDrag = useEditorStore((state) => state.startCanvasDrag);
  const suppressClickRef = useRef(false);

  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (insertDisabled || event.button !== 0) return;

    const startX = event.clientX;
    const startY = event.clientY;
    let dragged = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (dragged) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) <= 5) return;

      dragged = true;
      startCanvasDrag(component.id, 'components', component.name, {
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (!dragged) return;

      suppressClickRef.current = true;
      requestAnimationFrame(() => {
        suppressClickRef.current = false;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className={cn(
        'group flex items-center h-8 rounded-lg pr-1',
        insertDisabled ? 'opacity-40' : 'hover:bg-secondary/50',
      )}
    >
      <button
        type="button"
        className={cn(
          'flex flex-1 items-center min-w-0 h-8 rounded-lg text-left outline-none',
          insertDisabled
            ? 'cursor-not-allowed text-secondary-foreground/80 dark:text-muted-foreground'
            : 'cursor-grab active:cursor-grabbing text-secondary-foreground/80 dark:text-muted-foreground',
        )}
        disabled={insertDisabled}
        aria-label={`Insert ${component.name}`}
        title={insertDisabled ? disabledReason : 'Click to insert, or drag onto the canvas'}
        onMouseDown={handleMouseDown}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          onInsert(component.id);
        }}
      >
        <Icon name="component" className="size-3 mx-2 shrink-0 opacity-60" />
        <span className="flex-1 truncate text-xs font-medium">{component.name}</span>
      </button>

      {showActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="xs"
              variant="ghost"
              className="size-6 p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0"
              aria-label={`Actions for ${component.name}`}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <Icon name="more" className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(component.id)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRename(component)}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-500 focus:text-red-500"
              onSelect={() => onDelete(component)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default function LeftSidebarAssets({
  liveLayerUpdates,
  readOnly = false,
}: LeftSidebarAssetsProps) {
  const components = useComponentsStore((state) => state.components);
  const renameComponent = useComponentsStore((state) => state.renameComponent);
  const deleteComponent = useComponentsStore((state) => state.deleteComponent);
  const getDeletePreview = useComponentsStore((state) => state.getDeletePreview);
  const editingComponentId = useEditorStore((state) => state.editingComponentId);
  const setActiveSidebarTab = useEditorStore((state) => state.setActiveSidebarTab);
  const editComponent = useEditComponent();
  const { isLocalizing } = useLocalizationMode();

  const [query, setQuery] = useState('');
  const [componentsOpen, setComponentsOpen] = useState(true);
  const [renameTarget, setRenameTarget] = useState<Component | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Component | null>(null);
  const [deleteDescription, setDeleteDescription] = useState('Delete this component?');

  const circularIds = useMemo(() => {
    if (!editingComponentId) return new Set<string>();
    return new Set(
      components
        .filter((component) => isCircularComponentReference(editingComponentId, component.id, components))
        .map((component) => component.id),
    );
  }, [components, editingComponentId]);

  const visibleComponents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? components.filter((component) => component.name.toLowerCase().includes(normalized))
      : components;

    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [components, query]);

  const sectionOpen = query.trim().length > 0 || componentsOpen;
  const canInsert = !readOnly && !isLocalizing;

  const handleInsert = (componentId: string) => {
    if (!canInsert) return;
    insertComponentOnCanvas(componentId, { liveLayerUpdates });
  };

  const handleEdit = (componentId: string) => {
    setActiveSidebarTab('layers');
    void editComponent(componentId);
  };

  const handleConfirmRename = async (name: string) => {
    if (!renameTarget) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === renameTarget.name) return;

    try {
      await renameComponent(renameTarget.id, trimmed);
    } catch (error) {
      console.error('Failed to rename component:', error);
      toast.error('Could not rename component');
    }
  };

  const handleDelete = async (component: Component) => {
    setDeleteTarget(component);
    setDeleteDescription(`Delete "${component.name}"?`);

    const preview = await getDeletePreview(component.id);
    if (!preview) return;

    const pageCount = preview.affectedEntities.filter((entity) => entity.type === 'page').length;
    const componentCount = preview.affectedEntities.filter((entity) => entity.type === 'component').length;
    const parts: string[] = [];
    if (pageCount > 0) parts.push(`${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`);
    if (componentCount > 0) parts.push(`${componentCount} ${componentCount === 1 ? 'component' : 'components'}`);

    const usage = parts.length > 0
      ? `This component is used in ${parts.join(' and ')}.`
      : 'This component is not used anywhere.';
    setDeleteDescription(`Are you sure you want to delete "${component.name}"? ${usage}`);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteComponent(deleteTarget.id);
    } catch (error) {
      console.error('Failed to delete component:', error);
      toast.error('Could not delete component');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="pt-4 pb-2 shrink-0">
        <div className="relative">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              setQuery('');
              event.currentTarget.blur();
            }}
            placeholder="Search"
            aria-label="Search assets"
            className="h-8 text-xs pl-8"
          />
        </div>
      </div>

      {isLocalizing && (
        <p className="pb-3 text-xs text-muted-foreground">
          Switch to the default locale to insert components.
        </p>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-4">
        <button
          type="button"
          className="flex w-full items-center gap-1.5 py-2 text-left"
          aria-expanded={sectionOpen}
          onClick={() => setComponentsOpen((open) => !open)}
        >
          <Icon
            name="triangle-down"
            className={cn('size-3 opacity-40 transition-transform', !sectionOpen && '-rotate-90')}
          />
          <span className="text-xs font-medium">Components</span>
        </button>

        {sectionOpen && components.length === 0 && (
          <Empty className="px-2 py-6">
            <EmptyTitle>No components yet</EmptyTitle>
            <EmptyDescription>
              Right-click a layer and select &quot;Create component&quot; to make it reusable
            </EmptyDescription>
          </Empty>
        )}

        {sectionOpen && components.length > 0 && visibleComponents.length === 0 && (
          <Empty className="px-2 py-6">
            <EmptyTitle>No matching components</EmptyTitle>
            <EmptyDescription>Try a different name</EmptyDescription>
          </Empty>
        )}

        {sectionOpen && visibleComponents.length > 0 && (
          <div className="flex flex-col">
            {visibleComponents.map((component) => {
              const createsLoop = circularIds.has(component.id);
              return (
                <AssetComponentRow
                  key={component.id}
                  component={component}
                  insertDisabled={!canInsert || createsLoop}
                  showActions={!readOnly && !isLocalizing}
                  disabledReason={createsLoop ? 'This component would create a loop' : undefined}
                  onInsert={handleInsert}
                  onEdit={handleEdit}
                  onRename={setRenameTarget}
                  onDelete={(target) => {
                    void handleDelete(target);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      <RenameComponentDialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        onConfirm={(name) => {
          void handleConfirmRename(name);
        }}
        currentName={renameTarget?.name}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete component"
        description={deleteDescription}
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
