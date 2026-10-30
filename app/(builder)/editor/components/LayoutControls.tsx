'use client';

import { useState, useEffect, memo } from 'react';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OverrideReset } from './BreakpointOverride';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useControlledInput, useControlledInputs } from '@/hooks/use-controlled-input';
import { useModeToggle } from '@/hooks/use-mode-toggle';
import { useEditorStore } from '@/stores/useEditorStore';
import { extractMeasurementValue } from '@/lib/measurement-utils';
import {
  applyBreakpointDesign,
  layoutModeFromDisplay,
  readLayerPosition,
  shouldRemapChildPosition,
  type LayoutMode,
} from '@/lib/layout-model';
import { removeSpaces } from '@/lib/utils';
import type { Layer } from '@/types';

interface LayoutControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

const LayoutControls = memo(function LayoutControls({ layer, onLayerUpdate }: LayoutControlsProps) {
  const activeBreakpoint = useEditorStore((s) => s.activeBreakpoint);
  const activeUIState = useEditorStore((s) => s.activeUIState);
  const { updateDesignProperty, updateDesignProperties, debouncedUpdateDesignProperty, getDesignProperty, getPropertyInheritance } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
  });

  // Get current values from layer (with inheritance)
  const display = getDesignProperty('layout', 'display') || '';
  const flexDirection = getDesignProperty('layout', 'flexDirection') || 'row';
  const alignItems = getDesignProperty('layout', 'alignItems') || '';
  const justifyContent = getDesignProperty('layout', 'justifyContent') || 'start';
  const flexWrap = getDesignProperty('layout', 'flexWrap') || 'nowrap';
  const gap = getDesignProperty('layout', 'gap') || '';
  const columnGap = getDesignProperty('layout', 'columnGap') || '';
  const rowGap = getDesignProperty('layout', 'rowGap') || '';
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

  // Local controlled inputs (prevents repopulation bug)
  const inputs = useControlledInputs({
    gap,
    columnGap,
    rowGap,
  }, extractMeasurementValue);

  const [gapInput, setGapInput] = inputs.gap;
  const [columnGapInput, setColumnGapInput] = inputs.columnGap;
  const [rowGapInput, setRowGapInput] = inputs.rowGap;

  // Use mode toggle hook for gap
  const gapModeToggle = useModeToggle({
    category: 'layout',
    unifiedProperty: 'gap',
    individualProperties: ['columnGap', 'rowGap'],
    modeProperty: 'gapMode', // Store the mode preference in layer JSON
    updateDesignProperty,
    updateDesignProperties,
    // Don't wrap in useCallback - let it recreate on every render to avoid stale closures
    getCurrentValue: (prop: string) => getDesignProperty('layout', prop) || '',
  });

  const layoutMode = layoutModeFromDisplay(display);
  const isStack = layoutMode === 'stack';
  const isGrid = layoutMode === 'grid';
  const stackAxis = flexDirection === 'column' || flexDirection === 'column-reverse' ? 'column' : 'row';
  const wrapMode = flexWrap === 'wrap' ? 'yes' : 'no';
  const displayOverride = getPropertyInheritance('display').isOverride;

  const paddingTop = getDesignProperty('spacing', 'paddingTop') || '';
  const paddingRight = getDesignProperty('spacing', 'paddingRight') || '';
  const paddingBottom = getDesignProperty('spacing', 'paddingBottom') || '';
  const paddingLeft = getDesignProperty('spacing', 'paddingLeft') || '';
  const paddingUniform = [paddingRight, paddingBottom, paddingLeft].every((side) => side === paddingTop)
    ? paddingTop
    : '';
  const [paddingInput, setPaddingInput] = useControlledInput(paddingUniform, extractMeasurementValue);

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
  };

  const handlePaddingChange = (value: string) => {
    setPaddingInput(value);
    const sanitized = removeSpaces(value) || null;
    debouncedUpdateDesignProperty('spacing', 'paddingTop', sanitized);
    debouncedUpdateDesignProperty('spacing', 'paddingRight', sanitized);
    debouncedUpdateDesignProperty('spacing', 'paddingBottom', sanitized);
    debouncedUpdateDesignProperty('spacing', 'paddingLeft', sanitized);
  };

  // Handle align items change
  const handleAlignChange = (value: string) => {
    updateDesignProperty('layout', 'alignItems', value);
  };

  // Handle justify content change
  const handleJustifyChange = (value: string) => {
    updateDesignProperty('layout', 'justifyContent', value);
  };

  // Handle wrap mode change
  const handleWrapChange = (value: 'yes' | 'no') => {
    updateDesignProperty('layout', 'flexWrap', value === 'yes' ? 'wrap' : 'nowrap');
  };

  // Handle gap changes (debounced for text input)
  const handleGapChange = (value: string) => {
    setGapInput(value);
    if (gapModeToggle.mode === 'all') {
      const sanitized = removeSpaces(value);
      debouncedUpdateDesignProperty('layout', 'gap', sanitized || null);
    }
  };

  const handleColumnGapChange = (value: string) => {
    setColumnGapInput(value);
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('layout', 'columnGap', sanitized || null);
  };

  const handleRowGapChange = (value: string) => {
    setRowGapInput(value);
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('layout', 'rowGap', sanitized || null);
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
    <div className="py-5">
      <header className="py-4 -mt-4 flex items-center gap-1">
        <Label>Layout</Label>
        <OverrideReset
          isOverride={displayOverride}
          propertyLabel="layout"
          onReset={() => updateDesignProperty('layout', 'display', null)}
        />
      </header>

      <div className="flex flex-col gap-2">

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
              <Label variant="muted">Direction</Label>
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

          {(isStack || isGrid) && (
              <>
                  <div className="grid grid-cols-3">
                      <Label variant="muted">Align</Label>
                      <div className="col-span-2">
                          <Tabs
                            value={alignItems || 'start'}
                            onValueChange={handleAlignChange}
                            className="w-full"
                          >
                              <TabsList className="w-full">
                                  <TabsTrigger value="start" aria-label="Align start">
                                      <Icon name={stackAxis === 'column' ? 'layout-align-left' : 'layout-align-top'} className="size-3.5" />
                                  </TabsTrigger>
                                  <TabsTrigger value="center" aria-label="Align center">
                                      <Icon name={stackAxis === 'column' ? 'layout-align-center-horizontally' : 'layout-align-center-vertically'} className="size-3.5" />
                                  </TabsTrigger>
                                  <TabsTrigger value="end" aria-label="Align end">
                                      <Icon name={stackAxis === 'column' ? 'layout-align-right' : 'layout-align-bottom'} className="size-3.5" />
                                  </TabsTrigger>
                                  <TabsTrigger value="stretch" aria-label="Stretch">
                                      <Icon name="alignStretch" className={stackAxis === 'column' ? '-rotate-90' : ''} />
                                  </TabsTrigger>
                              </TabsList>
                          </Tabs>
                      </div>
                  </div>

                  <div className="grid grid-cols-3">
                      <Label variant="muted">{isStack ? 'Distribute' : 'Justify'}</Label>
                      <div className="col-span-2 *:w-full">
                          <Select value={justifyContent} onValueChange={handleJustifyChange}>
                              <SelectTrigger>
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectGroup>
                                      <SelectItem value="start">
                                        <Icon name={stackAxis === 'column' ? 'layout-align-top' : 'layout-align-left'} className="size-3" />
                                        Start
                                      </SelectItem>
                                      <SelectItem value="center">
                                        <Icon name={stackAxis === 'column' ? 'layout-align-center-vertically' : 'layout-align-center-horizontally'} className="size-3" />
                                        Center
                                      </SelectItem>
                                      <SelectItem value="end">
                                        <Icon name={stackAxis === 'column' ? 'layout-align-bottom' : 'layout-align-right'} className="size-3" />
                                        End
                                      </SelectItem>
                                      <SelectItem value="between">
                                        <Icon name={stackAxis === 'column' ? 'distribute-vertically' : 'distribute-horizontally'} className="size-3" />
                                        Between
                                      </SelectItem>
                                      <SelectItem value="around">Around</SelectItem>
                                      <SelectItem value="evenly">Evenly</SelectItem>
                                  </SelectGroup>
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
              </>
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

          {(isStack || isGrid) && (
              <div className="grid grid-cols-3 items-start">
                  <Label variant="muted" className="h-8">Gap</Label>
                  <div className="col-span-2 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                          <InputGroup className="flex-1">
                              <InputGroupInput
                                stepper
                                min="0"
                                step="1"
                                disabled={gapModeToggle.mode === 'individual'}
                                value={gapInput}
                                onChange={(e) => handleGapChange(e.target.value)}
                              />
                          </InputGroup>
                          <Button
                            variant={gapModeToggle.mode === 'individual' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={gapModeToggle.handleToggle}
                          >
                              <Icon name="link" />
                          </Button>
                      </div>
                      {gapModeToggle.mode === 'individual' && (
                           <div className="col-span-2 grid grid-cols-2 gap-2">
                           <InputGroup>
                               <InputGroupAddon>
                                   <div className="flex">
                                       <Tooltip>
                                           <TooltipTrigger tabIndex={-1}>
                                               <Icon name="horizontalGap" className="size-3" />
                                           </TooltipTrigger>
                                           <TooltipContent>
                                               <p>Horizontal gap</p>
                                           </TooltipContent>
                                       </Tooltip>
                                   </div>
                               </InputGroupAddon>
                               <InputGroupInput
                                 stepper
                                 min="0"
                                 step="1"
                                 value={columnGapInput}
                                 onChange={(e) => handleColumnGapChange(e.target.value)}
                               />
                           </InputGroup>
                           <InputGroup>
                               <InputGroupAddon>
                                   <div className="flex">
                                       <Tooltip>
                                           <TooltipTrigger tabIndex={-1}>
                                               <Icon name="verticalGap" className="size-3" />
                                           </TooltipTrigger>
                                           <TooltipContent>
                                               <p>Vertical gap</p>
                                           </TooltipContent>
                                       </Tooltip>
                                   </div>
                               </InputGroupAddon>
                               <InputGroupInput
                                 stepper
                                 min="0"
                                 step="1"
                                 value={rowGapInput}
                                 onChange={(e) => handleRowGapChange(e.target.value)}
                               />
                           </InputGroup>
                       </div>
                      )}
                  </div>
              </div>
          )}

          {isStack && (
            <div className="grid grid-cols-3 items-start">
              <Label variant="muted" className="h-8">Padding</Label>
              <div className="col-span-2">
                <InputGroup>
                  <InputGroupAddon>
                    <Icon name="padding-per-side" className="size-3" />
                  </InputGroupAddon>
                  <InputGroupInput
                    stepper
                    min="0"
                    step="1"
                    placeholder={paddingUniform === '' && (paddingTop || paddingRight || paddingBottom || paddingLeft) ? 'Mixed' : undefined}
                    value={paddingInput}
                    onChange={(e) => handlePaddingChange(e.target.value)}
                    aria-label="Stack padding"
                  />
                </InputGroup>
              </div>
            </div>
          )}

      </div>
    </div>
  );
});
export default LayoutControls;
