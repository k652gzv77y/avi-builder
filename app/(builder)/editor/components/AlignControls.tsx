'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { findLayerWithParent } from '@/lib/layer-utils';
import { isFreeformDraggable } from '@/lib/canvas-freeform';
import { alignLayerTree, type AlignEdge, type DistributeAxis } from '@/lib/canvas-align';
import { readFreeformBox } from '@/lib/canvas-freeform-dom';
import {
  applyStackSelectionAlignment,
  resolveStackSelection,
  type StackCrossAlign,
  type StackSelectionAction,
} from '@/lib/stack-spacing';
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
  const stackSelection = useMemo(
    () => resolveStackSelection(layers, selectedLayerIds),
    [layers, selectedLayerIds],
  );

  if (freeformIds.length < 2 && !stackSelection) return null;

  const commitTree = (nextLayers: Layer[]) => {
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
    commitTree(alignLayerTree(layers, measured, action));
  };

  const commitStack = (action: StackSelectionAction) => {
    if (!stackSelection) return;
    const editor = useEditorStore.getState();
    commitTree(applyStackSelectionAlignment(
      layers,
      stackSelection,
      action,
      editor.activeBreakpoint,
      editor.activeUIState,
    ));
  };

  const column = stackSelection?.axis === 'column';
  const containerName = stackSelection?.kind === 'grid' ? 'grid' : 'stack';
  const crossActions: { value: StackCrossAlign; label: string; edge?: AlignEdge }[] = column
    ? [
      { value: 'start', label: 'Align selection left', edge: 'left' },
      { value: 'center', label: 'Align selection center', edge: 'center' },
      { value: 'end', label: 'Align selection right', edge: 'right' },
      { value: 'stretch', label: 'Stretch selection' },
    ]
    : [
      { value: 'start', label: 'Align selection top', edge: 'top' },
      { value: 'center', label: 'Align selection middle', edge: 'middle' },
      { value: 'end', label: 'Align selection bottom', edge: 'bottom' },
      { value: 'stretch', label: 'Stretch selection' },
    ];
  const mainActions: { value: 'start' | 'center' | 'end' | 'between'; label: string; edge: AlignEdge | DistributeAxis }[] = column
    ? [
      { value: 'start', label: `Pack ${containerName} to the top`, edge: 'top' },
      { value: 'center', label: `Pack ${containerName} to the middle`, edge: 'middle' },
      { value: 'end', label: `Pack ${containerName} to the bottom`, edge: 'bottom' },
      { value: 'between', label: `Distribute the ${containerName}`, edge: 'vertical' },
    ]
    : [
      { value: 'start', label: `Pack ${containerName} to the left`, edge: 'left' },
      { value: 'center', label: `Pack ${containerName} to the center`, edge: 'center' },
      { value: 'end', label: `Pack ${containerName} to the right`, edge: 'right' },
      { value: 'between', label: `Distribute the ${containerName}`, edge: 'horizontal' },
    ];

  return (
    <>
      {freeformIds.length >= 2 && (
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
      )}
      {stackSelection && (
        <div className="flex flex-col gap-2 border-b px-3 py-2">
          <Label>{stackSelection.kind === 'grid' ? 'Grid' : 'Stack'}</Label>
          <div className="grid grid-cols-4 gap-1">
            {crossActions.map((action) => (
              <Button
                key={action.label}
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={action.label}
                title={action.label}
                onClick={() => commitStack({ type: 'cross', value: action.value })}
              >
                {action.edge
                  ? <AlignMark edge={action.edge} />
                  : <Icon name="alignStretch" className={column ? '-rotate-90' : ''} />}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {mainActions.map((action) => (
              <Button
                key={action.label}
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={action.label}
                title={action.label}
                onClick={() => commitStack({ type: 'main', value: action.value })}
              >
                <AlignMark edge={action.edge} />
              </Button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
