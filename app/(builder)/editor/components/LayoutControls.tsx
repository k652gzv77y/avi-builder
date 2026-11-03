'use client';

import { useState, useEffect, memo } from 'react';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { OverrideReset } from './BreakpointOverride';
import { StackPropertyLabel } from './BindingsPicker';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useEditorStore } from '@/stores/useEditorStore';
import {
  applyBreakpointDesign,
  layoutModeFromDisplay,
  readLayerPosition,
  shouldRemapChildPosition,
  type LayoutMode,
} from '@/lib/layout-model';
import { useStackBindings } from '@/hooks/use-stack-bindings';
import { useControlBindings } from '@/hooks/use-control-bindings';
import StructureBindingControls from './structure-binding-controls';
import { Switch } from '@/components/ui/switch';
import type { Layer } from '@/types';

interface LayoutControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

const LayoutControls = memo(function LayoutControls({ layer, onLayerUpdate }: LayoutControlsProps) {
  const activeBreakpoint = useEditorStore((s) => s.activeBreakpoint);
  const activeUIState = useEditorStore((s) => s.activeUIState);
  const editingComponentId = useEditorStore((s) => s.editingComponentId);
  const { bindingFor, syncValue } = useStackBindings({ layer, onLayerUpdate });
  const { bindingFor: controlBindingFor, syncValue: syncControl } = useControlBindings({ layer, onLayerUpdate });
  const { updateDesignProperty, updateDesignProperties, debouncedUpdateDesignProperty, getDesignProperty, getPropertyInheritance } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
  });

  // Get current values from layer (with inheritance)
  const display = getDesignProperty('layout', 'display') || '';
  const flexDirection = getDesignProperty('layout', 'flexDirection') || 'row';
  const flexWrap = getDesignProperty('layout', 'flexWrap') || 'nowrap';
  const gridCols = getDesignProperty('layout', 'gridTemplateColumns') || '';
  const gridRows = getDesignProperty('layout', 'gridTemplateRows') || '';

  // Extract number from grid template: "repeat(2, 1fr)" → "2"
  const extractGridNumber = (value: string): string => {
    if (!value) return '';
    // Match repeat(N, 1fr) pattern (with space or underscore)
    const match = value.match(/^repeat\((\d+),[\s_]*1fr\)$/);
    return match ? match[1] : '';
  };

  // Convert number to grid template: "2" → "repeat(2, 1fr)"
  const numberToGridTemplate = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Only accept numbers
    if (!/^\d+$/.test(trimmed)) return null;
    return `repeat(${trimmed}, 1fr)`;
  };

  // Local state for grid inputs (number only)
  const [gridColsInput, setGridColsInput] = useState(extractGridNumber(gridCols));
  const [gridRowsInput, setGridRowsInput] = useState(extractGridNumber(gridRows));

  // Sync local state when layer values change
  useEffect(() => {
    setGridColsInput(extractGridNumber(gridCols));
  }, [gridCols]);

  useEffect(() => {
    setGridRowsInput(extractGridNumber(gridRows));
  }, [gridRows]);

  const layoutMode = layoutModeFromDisplay(display);
  const isStack = layoutMode === 'stack';
  const isGrid = layoutMode === 'grid';
  const stackAxis = flexDirection === 'column' || flexDirection === 'column-reverse' ? 'column' : 'row';
  const wrapMode = flexWrap === 'wrap' ? 'yes' : 'no';
  const displayOverride = getPropertyInheritance('display').isOverride;

  const remapChildren = (target: 'absolute' | 'relative') => {
    if (!layer?.children?.length) return;
    for (const child of layer.children) {
      const position = readLayerPosition(child, activeBreakpoint);
      if (!shouldRemapChildPosition(position, target)) continue;
      onLayerUpdate(child.id, applyBreakpointDesign(
        child,
        [{ category: 'positioning', property: 'position', value: target }],
        activeBreakpoint,
        activeUIState,
      ));
    }
  };

  const handleLayoutMode = (mode: LayoutMode) => {
    if (mode === layoutMode) return;

    if (mode === 'hidden') {
      updateDesignProperties([
        { category: 'layout', property: 'display', value: 'hidden' },
        { category: 'layout', property: 'flexDirection', value: null },
      ]);
      return;
    }

    if (mode === 'grid') {
      updateDesignProperties([
        { category: 'layout', property: 'display', value: 'grid' },
        { category: 'layout', property: 'flexDirection', value: null },
      ]);
      return;
    }

    if (mode === 'stack') {
      const updates: { category: 'layout'; property: string; value: string | null }[] = [
        { category: 'layout', property: 'display', value: 'flex' },
      ];
      if (!flexDirection) {
        updates.push({ category: 'layout', property: 'flexDirection', value: 'row' });
      }
      updateDesignProperties(updates);
      remapChildren('relative');
      return;
    }

    const updates: { category: 'layout' | 'positioning'; property: string; value: string | null }[] = [];
    if (activeBreakpoint === 'desktop') {
      updates.push(
        { category: 'layout', property: 'display', value: null },
        { category: 'layout', property: 'flexDirection', value: null },
      );
    } else {
      // A block display override stops the desktop flex/grid cascade.
      updates.push({ category: 'layout', property: 'display', value: 'block' });
    }
    const position = getDesignProperty('positioning', 'position');
    if (!position || position === 'static') {
      updates.push({ category: 'positioning', property: 'position', value: 'relative' });
    }
    updateDesignProperties(updates);
    remapChildren('absolute');
  };

  const handleDirectionChange = (value: 'row' | 'column') => {
    updateDesignProperty('layout', 'flexDirection', value);
    syncValue('direction', value);
  };

  // Handle wrap mode change
  const handleWrapChange = (value: 'yes' | 'no') => {
    updateDesignProperty('layout', 'flexWrap', value === 'yes' ? 'wrap' : 'nowrap');
  };

  // Handle grid columns change (number input only)
  const handleGridColsChange = (value: string) => {
    // Only allow numbers and empty string
    if (value !== '' && !/^\d+$/.test(value)) return;

    setGridColsInput(value);
    const converted = numberToGridTemplate(value);
    debouncedUpdateDesignProperty('layout', 'gridTemplateColumns', converted);
  };

  // Handle grid rows change (number input only)
  const handleGridRowsChange = (value: string) => {
    // Only allow numbers and empty string
    if (value !== '' && !/^\d+$/.test(value)) return;

    setGridRowsInput(value);
    const converted = numberToGridTemplate(value);
    debouncedUpdateDesignProperty('layout', 'gridTemplateRows', converted);
  };

  // Extract numeric value from design property
  return (
    <div className="py-3">
      <header className="py-2 -mt-2 flex items-center gap-1">
        <Label>Layout</Label>
        <OverrideReset
          isOverride={displayOverride}
          propertyLabel="layout"
          onReset={() => updateDesignProperty('layout', 'display', null)}
        />
      </header>

      <div className="flex flex-col gap-2">

          {layer && layer.id !== 'body' && editingComponentId && (
            <StructureBindingControls
              layer={layer}
              onLayerUpdate={onLayerUpdate}
            />
          )}

          {layer && layer.id !== 'body' && editingComponentId && (
            <div className="grid grid-cols-3 items-center">
              <StackPropertyLabel binding={controlBindingFor('visible')} fallback="Visible" />
              <div className="col-span-2">
                <Switch
                  checked={layer.settings?.hidden !== true}
                  aria-label="Visible"
                  onCheckedChange={(checked) => {
                    onLayerUpdate(layer.id, {
                      settings: { ...layer.settings, hidden: !checked },
                    });
                    syncControl('visible', { type: 'boolean', value: checked });
                  }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3">
              <Label variant="muted">Type</Label>
              <div className="col-span-2 flex flex-col gap-2">
                  <Tabs
                    value={layoutMode}
                    onValueChange={(value) => handleLayoutMode(value as LayoutMode)}
                    className="w-full"
                  >
                      <TabsList className="w-full">
                          <TabsTrigger value="frame" className="gap-1">
                            <Icon name="frame" className="size-3" />
                            Frame
                          </TabsTrigger>
                          <TabsTrigger value="stack" className="gap-1">
                            <Icon name="horizontal-stack" className="size-3" />
                            Stack
                          </TabsTrigger>
                      </TabsList>
                  </Tabs>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="xs"
                      variant={isGrid ? 'secondary' : 'ghost'}
                      onClick={() => handleLayoutMode('grid')}
                    >
                      <Icon name="canvas-grid" className="size-3" />
                      Grid
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant={layoutMode === 'hidden' ? 'secondary' : 'ghost'}
                      onClick={() => handleLayoutMode('hidden')}
                    >
                      Hide
                    </Button>
                  </div>
              </div>
          </div>

          {layoutMode === 'frame' && (
            <p className="text-[11px] leading-snug text-muted-foreground">
              Frame. Children are absolutely positioned. Turn on Stack to flow them.
            </p>
          )}

          {isStack && (
            <div className="grid grid-cols-3">
              <StackPropertyLabel binding={bindingFor('direction')} fallback="Direction" />
              <div className="col-span-2">
                <Tabs
                  value={stackAxis}
                  onValueChange={(value) => handleDirectionChange(value as 'row' | 'column')}
                  className="w-full"
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="row" aria-label="Horizontal">
                      <Icon name="horizontal-stack" className="size-3.5" />
                    </TabsTrigger>
                    <TabsTrigger value="column" aria-label="Vertical">
                      <Icon name="vertical-stack" className="size-3.5" />
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          )}

          {isGrid && (
              <div className="grid grid-cols-3">
                  <Label variant="muted">Grid</Label>
                  <div className="col-span-2 grid grid-cols-2 gap-2">
                      <InputGroup>
                          <InputGroupAddon>
                              <div className="flex">
                                  <Tooltip>
                                      <TooltipTrigger tabIndex={-1}>
                                          <Icon name="columns" className="size-3" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                          <p>Columns</p>
                                      </TooltipContent>
                                  </Tooltip>
                              </div>
                          </InputGroupAddon>
                          <InputGroupInput
                            stepper
                            min="1"
                            step="1"
                            value={gridColsInput}
                            onChange={(e) => handleGridColsChange(e.target.value)}
                          />
                      </InputGroup>
                      <InputGroup>
                          <InputGroupAddon>
                              <div className="flex">
                                  <Tooltip>
                                      <TooltipTrigger tabIndex={-1}>
                                          <Icon name="columns" className="size-3 rotate-90" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                          <p>Rows</p>
                                      </TooltipContent>
                                  </Tooltip>
                              </div>
                          </InputGroupAddon>
                          <InputGroupInput
                            stepper
                            min="1"
                            step="1"
                            value={gridRowsInput}
                            onChange={(e) => handleGridRowsChange(e.target.value)}
                          />
                      </InputGroup>
                  </div>
              </div>
          )}

          {isStack && (
              <div className="grid grid-cols-3">
                  <Label variant="muted">Wrap</Label>
                  <div className="col-span-2">
                      <Tabs
                        value={wrapMode}
                        onValueChange={(value) => handleWrapChange(value as 'yes' | 'no')}
                        className="w-full"
                      >
                          <TabsList className="w-full">
                              <TabsTrigger value="yes" className="gap-1">
                                <Icon name="stack-wrap" className="size-3" />
                                Yes
                              </TabsTrigger>
                              <TabsTrigger value="no">No</TabsTrigger>
                          </TabsList>
                      </Tabs>
                  </div>
              </div>
          )}

      </div>
    </div>
  );
});
export default LayoutControls;
