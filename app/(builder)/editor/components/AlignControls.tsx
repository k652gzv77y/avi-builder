'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { findLayerWithParent } from '@/lib/layer-utils';
import { isFreeformDraggable } from '@/lib/canvas-freeform';
import { alignLayerTree, type AlignEdge, type DistributeAxis } from '@/lib/canvas-align';
import { readFreeformBox } from '@/lib/canvas-freeform-dom';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import type { Layer } from '@/types';

interface AlignControlsProps {
  layers: Layer[];
}

const ALIGN_ACTIONS: { edge: AlignEdge; label: string }[] = [
  { edge: 'left', label: 'Align left' },
  { edge: 'center', label: 'Align center' },
  { edge: 'right', label: 'Align right' },
  { edge: 'top', label: 'Align top' },
  { edge: 'middle', label: 'Align middle' },
  { edge: 'bottom', label: 'Align bottom' },
];

function AlignMark({ edge }: { edge: AlignEdge | DistributeAxis }) {
  const horizontal = edge === 'left' || edge === 'center' || edge === 'right' || edge === 'horizontal';
  const atStart = edge === 'left' || edge === 'top';
  const atEnd = edge === 'right' || edge === 'bottom';
  return (
    <span className="relative block size-3" aria-hidden>
      <span
        className="absolute bg-current"
        style={horizontal
          ? { width: 1, top: 0, bottom: 0, left: atStart ? 0 : atEnd ? '100%' : '50%' }
          : { height: 1, left: 0, right: 0, top: atStart ? 0 : atEnd ? '100%' : '50%' }}
      />
      <span
        className="absolute border border-current"
        style={{
          width: horizontal ? 6 : 8,
          height: horizontal ? 8 : 6,
          left: horizontal ? (atStart ? 2 : atEnd ? 2 : 3) : 2,
          top: horizontal ? 2 : (atStart ? 2 : atEnd ? 2 : 3),
        }}
      />
    </span>
  );
}

export default function AlignControls({ layers }: AlignControlsProps) {
  const selectedLayerIds = useEditorStore((state) => state.selectedLayerIds);
  const freeformIds = useMemo(() => {
    return selectedLayerIds.filter((id) => {
      const found = findLayerWithParent(layers, id);
      return !!found && isFreeformDraggable(found.layer, found.parent);
    });
  }, [layers, selectedLayerIds]);

  if (freeformIds.length < 2) return null;

  const commit = (action: { type: 'align'; edge: AlignEdge } | { type: 'distribute'; axis: DistributeAxis }) => {
    const iframe = document.querySelector('iframe[title="Canvas Editor"]') as HTMLIFrameElement | null;
    const doc = iframe?.contentDocument;
    if (!doc) return;
    const measured = freeformIds.flatMap((id) => {
      const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
      const el = doc.querySelector(`[data-layer-id="${escaped}"]`) as HTMLElement | null;
      if (!el) return [];
      return [{ id, ...readFreeformBox(el) }];
    });
    if (measured.length < 2) return;
    const nextLayers = alignLayerTree(layers, measured, action);
    if (nextLayers === layers) return;

    const editor = useEditorStore.getState();
    if (editor.editingComponentId) {
      const variantId = editor.editingComponentVariantId;
      if (!variantId) return;
      useComponentsStore.getState().updateComponentDraft(editor.editingComponentId, variantId, nextLayers);
      return;
    }
    if (editor.currentPageId) {
      usePagesStore.getState().setDraftLayers(editor.currentPageId, nextLayers);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-b px-3 py-2">
      <Label>Align</Label>
      <div className="grid grid-cols-6 gap-1">
        {ALIGN_ACTIONS.map((action) => (
          <Button
            key={action.edge}
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={action.label}
            title={action.label}
            onClick={() => commit({ type: 'align', edge: action.edge })}
          >
            <AlignMark edge={action.edge} />
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Distribute horizontal spacing"
          title="Distribute horizontal spacing"
          disabled={freeformIds.length < 3}
          onClick={() => commit({ type: 'distribute', axis: 'horizontal' })}
        >
          <AlignMark edge="horizontal" />
          Horizontal
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Distribute vertical spacing"
          title="Distribute vertical spacing"
          disabled={freeformIds.length < 3}
          onClick={() => commit({ type: 'distribute', axis: 'vertical' })}
        >
          <AlignMark edge="vertical" />
          Vertical
        </Button>
      </div>
    </div>
  );
}
