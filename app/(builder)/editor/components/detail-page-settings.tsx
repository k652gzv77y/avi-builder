'use client';

/**
 * Detail page inspector: the preview item, its route, and previous / next controls.
 * Field bindings stay on each layer. Visibility stays in its own section.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import SettingsPanel from './SettingsPanel';
import {
  buildDetailNavigation,
  findDetailNavigation,
  placeDetailNavigation,
  type DetailDirection,
} from '@/lib/collection-query';
import { stableList } from '@/lib/stable-list';
import { useDetailPreview } from '@/hooks/use-detail-preview';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';

export default function DetailPageSettings() {
  const preview = useDetailPreview();
  const [isOpen, setIsOpen] = useState(true);
  const currentPageId = useEditorStore(state => state.currentPageId);
  const editingComponentId = useEditorStore(state => state.editingComponentId);
  const setSelectedLayerId = useEditorStore(state => state.setSelectedLayerId);
  const layers = usePagesStore(state => stableList(
    currentPageId ? state.draftsByPageId[currentPageId]?.layers : undefined,
  ));
  const setDraftLayers = usePagesStore(state => state.setDraftLayers);

  if (!preview.isDetail || editingComponentId || !currentPageId) return null;

  const previous = findDetailNavigation(layers, 'previous');
  const next = findDetailNavigation(layers, 'next');

  const handleNavigation = (direction: DetailDirection) => {
    const existing = findDetailNavigation(layers, direction);
    if (existing) {
      setSelectedLayerId(existing.id);
      return;
    }
    const control = buildDetailNavigation(currentPageId, direction);
    setDraftLayers(currentPageId, placeDetailNavigation(layers, control));
    setSelectedLayerId(control.id);
  };

  return (
    <SettingsPanel
      title="Detail page"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          Preview one item on this route. Bind fields from Detail. Visibility hides a layer for this item.
        </p>
        <div className="grid grid-cols-3 items-center">
          <Label variant="muted">Route</Label>
          <div className="col-span-2 truncate font-mono text-xs text-muted-foreground">
            {preview.route}
          </div>
        </div>
        <div className="grid grid-cols-3 items-center">
          <Label variant="muted">Preview</Label>
          <div className="col-span-2 flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              className="size-8! p-0"
              aria-label="Previous item"
              disabled={!preview.canGoPrevious}
              onClick={preview.goPrevious}
            >
              <Icon name="chevronLeft" />
            </Button>
            <span className="min-w-0 flex-1 truncate text-xs">
              {preview.currentLabel || 'No items'}
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="size-8! p-0"
              aria-label="Next item"
              disabled={!preview.canGoNext}
              onClick={preview.goNext}
            >
              <Icon name="chevronRight" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 items-center">
          <Label variant="muted">Previous</Label>
          <div className="col-span-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => handleNavigation('previous')}
            >
              {previous ? 'Edit previous' : 'Add previous'}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 items-center">
          <Label variant="muted">Next</Label>
          <div className="col-span-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => handleNavigation('next')}
            >
              {next ? 'Edit next' : 'Add next'}
            </Button>
          </div>
        </div>
      </div>
    </SettingsPanel>
  );
}
