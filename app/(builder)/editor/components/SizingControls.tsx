'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AviIcon, type AviIconName } from '@/components/ui/avi-icon';
import SettingsPanel from './SettingsPanel';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useControlledInputs } from '@/hooks/use-controlled-input';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { extractMeasurementValue, formatMeasurementValue } from '@/lib/measurement-utils';
import type { Layer } from '@/types';

interface SizingControlsProps {
  layer: Layer | null;
  parentLayer?: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

// Framer-style sizing modes for the width/height segmented control
type SizeMode = 'fill' | 'hug' | 'fixed' | 'relative';

// Per-axis icons for the mode toggle. Width uses horizontal glyphs, height vertical.
const SIZE_MODE_ICONS: Record<'width' | 'height', Record<Exclude<SizeMode, 'relative'>, AviIconName>> = {
  width: { fill: 'double-arrow-horizontal', hug: 'horizontal-stack', fixed: 'frame' },
  height: { fill: 'double-arrow-vertical', hug: 'vertical-stack', fixed: 'frame' },
};

// Labels mirror Framer's sizing terminology (Fill / Fit Content / Fixed / Relative).
const SIZE_MODE_LABELS: Record<SizeMode, string> = {
  fill: 'Fill',
  hug: 'Fit content',
  fixed: 'Fixed',
  relative: 'Relative',
};

const SIZE_MODE_ORDER: SizeMode[] = ['fill', 'hug', 'fixed', 'relative'];

// Derive the active mode from the effective Tailwind value (classes are the
// source of truth). flexGrow (flex-1) means "Fill" on a flex main axis.
function deriveSizeMode(value: string, isMainAxisFill: boolean): SizeMode | '' {
  if (isMainAxisFill) return 'fill';
  if (!value) return '';
  if (value === '100%' || value === 'full') return 'fill';
  if (value === 'fit') return 'hug';
  if (value.endsWith('%')) return 'relative';
  return 'fixed';
}

// Round only the outer corner of each grid corner cell so the 3x3 grid reads as one rounded block
const OBJECT_POSITION_CORNERS: Record<string, string> = {
  'left-top': 'rounded-tl-lg',
  'right-top': 'rounded-tr-lg',
  'left-bottom': 'rounded-bl-lg',
  'right-bottom': 'rounded-br-lg',
};

// 3x3 focal point grid: cell position maps to the image alignment value
const OBJECT_POSITIONS: { value: string; label: string; icon: React.ComponentProps<typeof Icon>['name'] }[] = [
  { value: 'left-top', label: 'Top left', icon: 'arrow-left-up' },
  { value: 'top', label: 'Top center', icon: 'arrow-up' },
  { value: 'right-top', label: 'Top right', icon: 'arrow-right-up' },
  { value: 'left', label: 'Center left', icon: 'arrow-left' },
  { value: 'center', label: 'Center', icon: 'circle' },
  { value: 'right', label: 'Center right', icon: 'arrow-right' },
  { value: 'left-bottom', label: 'Bottom left', icon: 'arrow-left-down' },
  { value: 'bottom', label: 'Bottom center', icon: 'arrow-down' },
  { value: 'right-bottom', label: 'Bottom right', icon: 'arrow-right-down' },
];

const noop = () => {};

// Segmented Fill / Hug / Fixed / Relative control for one axis.
function SizeModeToggle({
  axis,
  value,
  onChange,
}: {
  axis: 'width' | 'height';
  value: SizeMode | '';
  onChange: (mode: SizeMode) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as SizeMode)}
      className="w-full"
    >
      <TabsList className="w-full">
        {SIZE_MODE_ORDER.map((mode) => (
          <TabsTrigger
            key={mode}
            value={mode}
            aria-label={SIZE_MODE_LABELS[mode]}
            title={SIZE_MODE_LABELS[mode]}
          >
            {mode === 'relative' ? (
              <span className="text-xs font-medium">%</span>
            ) : (
              <AviIcon name={SIZE_MODE_ICONS[axis][mode]} className="size-3.5" />
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

const SizingControls = memo(function SizingControls({ layer, parentLayer = null, onLayerUpdate }: SizingControlsProps) {
  const activeBreakpoint = useEditorStore((s) => s.activeBreakpoint);
  const activeUIState = useEditorStore((s) => s.activeUIState);
  const { updateDesignProperty, debouncedUpdateDesignProperty, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
  });

  // Read-only sync for the parent: whether this layer is on a flex main axis
  // decides if "Fill" grows (flex-1) or stretches (w-full/h-full).
  const { getDesignProperty: getParentDesignProperty } = useDesignSync({
    layer: parentLayer,
    onLayerUpdate: noop,
    activeBreakpoint,
    activeUIState,
  });

  const parentDisplay = parentLayer ? (getParentDesignProperty('layout', 'display') || '') : '';
  const parentFlexDirection = getParentDesignProperty('layout', 'flexDirection') || 'row';
  const isParentFlex = parentDisplay === 'flex' || parentDisplay === 'inline-flex';
  const isParentRowAxis = isParentFlex && (parentFlexDirection === 'row' || parentFlexDirection === 'row-reverse');
  const isParentColumnAxis = isParentFlex && (parentFlexDirection === 'column' || parentFlexDirection === 'column-reverse');
  // Width grows via flex-1 only when it's the flex main axis (row parent);
  // height grows via flex-1 only on a column parent.
  const widthIsMainAxis = isParentRowAxis;
  const heightIsMainAxis = isParentColumnAxis;

  // flex-1 on the layer itself (Fill on the main axis)
  const flexGrow = getDesignProperty('layout', 'flexGrow') || '';
  const hasFlexGrow = flexGrow === '1';

  const [isOpen, setIsOpen] = useState(true);

  // Get current values from layer (with inheritance)
  const width = getDesignProperty('sizing', 'width') || '';
  const height = getDesignProperty('sizing', 'height') || '';
  const minWidth = getDesignProperty('sizing', 'minWidth') || '';
  const minHeight = getDesignProperty('sizing', 'minHeight') || '';
  const maxWidth = getDesignProperty('sizing', 'maxWidth') || '';
  const maxHeight = getDesignProperty('sizing', 'maxHeight') || '';
  const overflow = getDesignProperty('sizing', 'overflow') || 'visible';
  const aspectRatio = getDesignProperty('sizing', 'aspectRatio') || '';
  const objectFit = getDesignProperty('sizing', 'objectFit') || '';
  const objectPosition = getDesignProperty('sizing', 'objectPosition') || '';
  const gridColumnSpan = getDesignProperty('sizing', 'gridColumnSpan') || '';
  const gridRowSpan = getDesignProperty('sizing', 'gridRowSpan') || '';

  // Extract aspect ratio value for display (remove brackets)
  const extractAspectRatioValue = (value: string): string => {
    if (!value) return '';
    // Remove brackets: [16/9] → 16/9
    if (value.startsWith('[') && value.endsWith(']')) {
      return value.slice(1, -1);
    }
    return value;
  };

  // Local controlled inputs (prevents repopulation bug)
  const inputs = useControlledInputs({
    width,
    height,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
  }, extractMeasurementValue);

  const [widthInput, setWidthInput] = inputs.width;
  const [heightInput, setHeightInput] = inputs.height;
  const [minWidthInput, setMinWidthInput] = inputs.minWidth;
  const [minHeightInput, setMinHeightInput] = inputs.minHeight;
  const [maxWidthInput, setMaxWidthInput] = inputs.maxWidth;
  const [maxHeightInput, setMaxHeightInput] = inputs.maxHeight;

  // Aspect ratio uses custom extraction to remove brackets
  const [aspectRatioInput, setAspectRatioInput] = useState(extractAspectRatioValue(aspectRatio));

  // Sync aspect ratio input when prop changes
  useEffect(() => {
    setAspectRatioInput(extractAspectRatioValue(aspectRatio));
  }, [aspectRatio]);

  // Handle width changes (debounced for text input)
  const handleWidthChange = (value: string) => {
    setWidthInput(value);
    debouncedUpdateDesignProperty('sizing', 'width', formatMeasurementValue(value));
  };

  // Handle height changes (debounced for text input)
  const handleHeightChange = (value: string) => {
    setHeightInput(value);
    debouncedUpdateDesignProperty('sizing', 'height', formatMeasurementValue(value));
  };

  // ── Framer-style sizing modes (Fill / Hug / Fixed / Relative) ──────────────
  // Mode is derived from the effective class value; flex-1 on a flex main axis
  // reads as Fill even though no w-*/h-* class is present.
  const widthMode = deriveSizeMode(width, widthIsMainAxis && hasFlexGrow);
  const heightMode = deriveSizeMode(height, heightIsMainAxis && hasFlexGrow);

  // Relative inputs show a bare number; the '%' unit is appended on write.
  const widthRelValue = width.endsWith('%') && width !== '100%' ? width.slice(0, -1) : '';
  const heightRelValue = height.endsWith('%') && height !== '100%' ? height.slice(0, -1) : '';

  const applyWidthMode = (mode: SizeMode) => {
    switch (mode) {
      case 'fill':
        if (widthIsMainAxis) {
          // Grow to fill the flex main axis; drop any explicit width.
          updateDesignProperty('sizing', 'width', null);
          updateDesignProperty('layout', 'flexGrow', '1');
        } else {
          if (hasFlexGrow) updateDesignProperty('layout', 'flexGrow', null);
          setWidthInput('100%');
          updateDesignProperty('sizing', 'width', '100%');
        }
        break;
      case 'hug':
        if (widthIsMainAxis && hasFlexGrow) updateDesignProperty('layout', 'flexGrow', null);
        setWidthInput('fit');
        updateDesignProperty('sizing', 'width', 'fit');
        break;
      case 'fixed': {
        if (widthIsMainAxis && hasFlexGrow) updateDesignProperty('layout', 'flexGrow', null);
        const next = widthMode === 'fixed' && widthInput ? widthInput : '100';
        setWidthInput(next);
        updateDesignProperty('sizing', 'width', formatMeasurementValue(next));
        break;
      }
      case 'relative': {
        if (widthIsMainAxis && hasFlexGrow) updateDesignProperty('layout', 'flexGrow', null);
        const next = widthMode === 'relative' && widthRelValue ? `${widthRelValue}%` : '50%';
        setWidthInput(next);
        updateDesignProperty('sizing', 'width', next);
        break;
      }
    }
  };

  const applyHeightMode = (mode: SizeMode) => {
    switch (mode) {
      case 'fill':
        if (heightIsMainAxis) {
          updateDesignProperty('sizing', 'height', null);
          updateDesignProperty('layout', 'flexGrow', '1');
        } else {
          if (hasFlexGrow) updateDesignProperty('layout', 'flexGrow', null);
          setHeightInput('100%');
          updateDesignProperty('sizing', 'height', '100%');
        }
        break;
      case 'hug':
        if (heightIsMainAxis && hasFlexGrow) updateDesignProperty('layout', 'flexGrow', null);
        setHeightInput('fit');
        updateDesignProperty('sizing', 'height', 'fit');
        break;
      case 'fixed': {
        if (heightIsMainAxis && hasFlexGrow) updateDesignProperty('layout', 'flexGrow', null);
        const next = heightMode === 'fixed' && heightInput ? heightInput : '100';
        setHeightInput(next);
        updateDesignProperty('sizing', 'height', formatMeasurementValue(next));
        break;
      }
      case 'relative': {
        if (heightIsMainAxis && hasFlexGrow) updateDesignProperty('layout', 'flexGrow', null);
        const next = heightMode === 'relative' && heightRelValue ? `${heightRelValue}%` : '50%';
        setHeightInput(next);
        updateDesignProperty('sizing', 'height', next);
        break;
      }
    }
  };

  // Relative (%) numeric input handlers — store as "N%", debounced while typing.
  const handleWidthRelChange = (value: string) => {
    const bare = value.replace('%', '');
    setWidthInput(bare ? `${bare}%` : '');
    debouncedUpdateDesignProperty('sizing', 'width', bare ? `${bare}%` : null);
  };

  const handleHeightRelChange = (value: string) => {
    const bare = value.replace('%', '');
    setHeightInput(bare ? `${bare}%` : '');
    debouncedUpdateDesignProperty('sizing', 'height', bare ? `${bare}%` : null);
  };

  // Get current min/max width preset values
  const getMinWidthPresetValue = () => {
    if (minWidthInput === '100%') return 'w-[100%]';
    if (minWidthInput === 'fit') return 'w-fit-content';
    if (minWidthInput === '100vw') return 'w-[100vw]';
    return '';
  };

  const getMaxWidthPresetValue = () => {
    if (maxWidthInput === '100%') return 'w-[100%]';
    if (maxWidthInput === 'fit') return 'w-fit-content';
    if (maxWidthInput === '100vw') return 'w-[100vw]';
    return '';
  };

  // Handle min/max width changes (debounced for text input)
  const handleMinWidthChange = (value: string) => {
    setMinWidthInput(value);
    debouncedUpdateDesignProperty('sizing', 'minWidth', formatMeasurementValue(value));
  };

  const handleMinWidthPresetChange = (value: string) => {
    if (value === 'w-[100%]') {
      setMinWidthInput('100%');
      updateDesignProperty('sizing', 'minWidth', '[100%]');
    } else if (value === 'w-fit-content') {
      setMinWidthInput('fit');
      updateDesignProperty('sizing', 'minWidth', 'fit');
    } else if (value === 'w-[100vw]') {
      setMinWidthInput('100vw');
      updateDesignProperty('sizing', 'minWidth', '[100vw]');
    }
  };

  const handleMaxWidthChange = (value: string) => {
    setMaxWidthInput(value);
    debouncedUpdateDesignProperty('sizing', 'maxWidth', formatMeasurementValue(value));
  };

  const handleMaxWidthPresetChange = (value: string) => {
    if (value === 'w-[100%]') {
      setMaxWidthInput('100%');
      updateDesignProperty('sizing', 'maxWidth', '[100%]');
    } else if (value === 'w-fit-content') {
      setMaxWidthInput('fit');
      updateDesignProperty('sizing', 'maxWidth', 'fit');
    } else if (value === 'w-[100vw]') {
      setMaxWidthInput('100vw');
      updateDesignProperty('sizing', 'maxWidth', '[100vw]');
    }
  };

  // Get current min/max height preset values
  const getMinHeightPresetValue = () => {
    if (minHeightInput === '100%') return 'h-[100%]';
    if (minHeightInput === '100svh') return 'h-[100svh]';
    return '';
  };

  const getMaxHeightPresetValue = () => {
    if (maxHeightInput === '100%') return 'h-[100%]';
    if (maxHeightInput === '100svh') return 'h-[100svh]';
    return '';
  };

  // Handle min/max height changes (debounced for text input)
  const handleMinHeightChange = (value: string) => {
    setMinHeightInput(value);
    debouncedUpdateDesignProperty('sizing', 'minHeight', formatMeasurementValue(value));
  };

  const handleMinHeightPresetChange = (value: string) => {
    if (value === 'h-[100%]') {
      setMinHeightInput('100%');
      updateDesignProperty('sizing', 'minHeight', '[100%]');
    } else if (value === 'h-[100svh]') {
      setMinHeightInput('100svh');
      updateDesignProperty('sizing', 'minHeight', '[100svh]');
    }
  };

  const handleMaxHeightChange = (value: string) => {
    setMaxHeightInput(value);
    debouncedUpdateDesignProperty('sizing', 'maxHeight', formatMeasurementValue(value));
  };

  const handleMaxHeightPresetChange = (value: string) => {
    if (value === 'h-[100%]') {
      setMaxHeightInput('100%');
      updateDesignProperty('sizing', 'maxHeight', '[100%]');
    } else if (value === 'h-[100svh]') {
      setMaxHeightInput('100svh');
      updateDesignProperty('sizing', 'maxHeight', '[100svh]');
    }
  };

  // Handle overflow change
  const handleOverflowChange = (value: string) => {
    updateDesignProperty('sizing', 'overflow', value);
  };

  // Handle aspect ratio changes (debounced for text input)
  const handleAspectRatioChange = (value: string) => {
    setAspectRatioInput(value);
    // Format as [16/9] for arbitrary values
    const formattedValue = value ? `[${value}]` : null;
    debouncedUpdateDesignProperty('sizing', 'aspectRatio', formattedValue);
  };

  // Get current aspect ratio preset value (for Select display)
  const getAspectRatioPresetValue = () => {
    if (aspectRatioInput === '16/9') return 'aspect-video';
    if (aspectRatioInput === '1/1') return 'aspect-square';
    if (aspectRatioInput === '4/3') return 'aspect-4/3';
    if (aspectRatioInput === '3/4') return 'aspect-3/4';
    return '';
  };

  // Preset changes are immediate (dropdown selection)
  const handleAspectRatioPresetChange = (value: string) => {
    if (value === 'aspect-video') {
      setAspectRatioInput('16/9');
      updateDesignProperty('sizing', 'aspectRatio', '[16/9]');
    } else if (value === 'aspect-square') {
      setAspectRatioInput('1/1');
      updateDesignProperty('sizing', 'aspectRatio', '[1/1]');
    } else if (value === 'aspect-4/3') {
      setAspectRatioInput('4/3');
      updateDesignProperty('sizing', 'aspectRatio', '[4/3]');
    } else if (value === 'aspect-3/4') {
      setAspectRatioInput('3/4');
      updateDesignProperty('sizing', 'aspectRatio', '[3/4]');
    } else if (value === 'aspect-auto') {
      setAspectRatioInput('');
      updateDesignProperty('sizing', 'aspectRatio', null);
    }
  };

  const handleAddAspectRatio = () => {
    setAspectRatioInput('1/1');
    updateDesignProperty('sizing', 'aspectRatio', '[1/1]');
  };

  const handleRemoveAspectRatio = () => {
    setAspectRatioInput('');
    updateDesignProperty('sizing', 'aspectRatio', null);
  };

  // Handle object-fit change
  const handleObjectFitChange = (value: string) => {
    updateDesignProperty('sizing', 'objectFit', value || null);
  };

  // Handle object-position change (center is the browser default, so clear it)
  const handleObjectPositionChange = (value: string) => {
    updateDesignProperty('sizing', 'objectPosition', value === 'center' ? null : value);
  };

  // Handle grid column span change
  const handleGridColumnSpanChange = (value: string) => {
    updateDesignProperty('sizing', 'gridColumnSpan', value || null);
  };

  // Handle grid row span change
  const handleGridRowSpanChange = (value: string) => {
    updateDesignProperty('sizing', 'gridRowSpan', value || null);
  };

  // Get store values
  const currentPageId = useEditorStore((s) => s.currentPageId);
  const editingComponentId = useEditorStore((s) => s.editingComponentId);
  const editingComponentVariantId = useEditorStore((s) => s.editingComponentVariantId);
  const draftsByPageId = usePagesStore((s) => s.draftsByPageId);
  const componentDrafts = useComponentsStore((s) => s.componentDrafts);

  // Check if parent layer has grid display
  const parentHasGrid = useMemo(() => {
    if (!layer) return false;

    let layers: Layer[] = [];
    if (editingComponentId) {
      const variantDrafts = componentDrafts[editingComponentId];
      const variantId = (editingComponentVariantId && variantDrafts?.[editingComponentVariantId])
        ? editingComponentVariantId
        : (variantDrafts ? Object.keys(variantDrafts)[0] : null);
      layers = (variantId && variantDrafts) ? variantDrafts[variantId] || [] : [];
    } else if (currentPageId) {
      const draft = draftsByPageId[currentPageId];
      layers = draft ? draft.layers : [];
    }

    if (!layers.length) return false;

    // Find parent layer
    const findParent = (tree: Layer[], targetId: string, parent: Layer | null = null): Layer | null => {
      for (const node of tree) {
        if (node.id === targetId) return parent;
        if (node.children) {
          const found = findParent(node.children, targetId, node);
          if (found !== null) return found;
        }
      }
      return null;
    };

    const parent = findParent(layers, layer.id);
    if (!parent) return false;

    // Check if parent has grid display
    const parentDisplay = parent.design?.layout?.display;
    return parentDisplay === 'Grid';
  }, [layer, currentPageId, editingComponentId, editingComponentVariantId, draftsByPageId, componentDrafts]);

  return (
    <SettingsPanel
      title="Sizing" isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      action={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs">
              <Icon name="plus" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={handleAddAspectRatio}
              disabled={!!aspectRatio}
            >
              Aspect ratio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >

{parentHasGrid && (
        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="h-8">Span</Label>
          <div className="col-span-2 grid grid-cols-2 gap-2">
            <Select value={gridColumnSpan} onValueChange={handleGridColumnSpanChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="7">7</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="9">9</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="11">11</SelectItem>
                  <SelectItem value="12">12</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select value={gridRowSpan} onValueChange={handleGridRowSpanChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="7">7</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="9">9</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="11">11</SelectItem>
                  <SelectItem value="12">12</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
)}

      <div className="grid grid-cols-3 items-start">
        <Label variant="muted" className="h-8">Width</Label>
        <div className="col-span-2 flex flex-col gap-2">
          <SizeModeToggle
            axis="width" value={widthMode}
            onChange={applyWidthMode}
          />
          {widthMode === 'fixed' && (
            <Input
              value={widthInput} onChange={(e) => handleWidthChange(e.target.value)}
            />
          )}
          {widthMode === 'relative' && (
            <InputGroup>
              <InputGroupInput
                value={widthRelValue}
                onChange={(e) => handleWidthRelChange(e.target.value)}
              />
              <InputGroupAddon align="inline-end">%</InputGroupAddon>
            </InputGroup>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="w-full group relative">
              <ButtonGroup className="w-full">
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger>
                          <Icon name="minSize" className="size-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Min width</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    placeholder="Min" value={minWidthInput}
                    onChange={(e) => handleMinWidthChange(e.target.value)}
                  />
                </InputGroup>
              </ButtonGroup>
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                <Select value={getMinWidthPresetValue()} onValueChange={handleMinWidthPresetChange}>
                  <SelectTrigger size="xs" variant="ghost" />
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="w-[100%]">Fill</SelectItem>
                      <SelectItem value="w-fit-content">Fit</SelectItem>
                      <SelectItem value="w-[100vw]">Screen</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="w-full group relative">
              <ButtonGroup className="w-full">
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger>
                          <Icon name="maxSize" className="size-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Max width</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    placeholder="Max" value={maxWidthInput}
                    onChange={(e) => handleMaxWidthChange(e.target.value)}
                  />
                </InputGroup>
              </ButtonGroup>
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                <Select value={getMaxWidthPresetValue()} onValueChange={handleMaxWidthPresetChange}>
                  <SelectTrigger size="xs" variant="ghost" />
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="w-[100%]">Fill</SelectItem>
                      <SelectItem value="w-fit-content">Fit</SelectItem>
                      <SelectItem value="w-[100vw]">Screen</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 items-start">
        <Label variant="muted" className="h-8">Height</Label>
        <div className="col-span-2 flex flex-col gap-2">
          <SizeModeToggle
            axis="height" value={heightMode}
            onChange={applyHeightMode}
          />
          {heightMode === 'fixed' && (
            <Input
              value={heightInput} onChange={(e) => handleHeightChange(e.target.value)}
            />
          )}
          {heightMode === 'relative' && (
            <InputGroup>
              <InputGroupInput
                value={heightRelValue}
                onChange={(e) => handleHeightRelChange(e.target.value)}
              />
              <InputGroupAddon align="inline-end">%</InputGroupAddon>
            </InputGroup>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="w-full group relative">
              <ButtonGroup className="w-full">
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger>
                          <Icon name="minSize" className="size-3 rotate-90" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Min height</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    placeholder="Min" value={minHeightInput}
                    onChange={(e) => handleMinHeightChange(e.target.value)}
                  />
                </InputGroup>
              </ButtonGroup>
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                <Select value={getMinHeightPresetValue()} onValueChange={handleMinHeightPresetChange}>
                  <SelectTrigger size="xs" variant="ghost" />
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="h-[100%]">Fill</SelectItem>
                      <SelectItem value="h-[100svh]">Screen</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="w-full group relative">
              <ButtonGroup className="w-full">
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger>
                          <Icon name="maxSize" className="size-3 rotate-90" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Max height</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    placeholder="Max" value={maxHeightInput}
                    onChange={(e) => handleMaxHeightChange(e.target.value)}
                  />
                </InputGroup>
              </ButtonGroup>
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                <Select value={getMaxHeightPresetValue()} onValueChange={handleMaxHeightPresetChange}>
                  <SelectTrigger size="xs" variant="ghost" />
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="h-[100%]">Fill</SelectItem>
                      <SelectItem value="h-[100svh]">Screen</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3">
        <Label variant="muted">Overflow</Label>
        <div className="col-span-2 *:w-full">
          <Select value={overflow} onValueChange={handleOverflowChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="visible">Visible</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
                <SelectItem value="scroll">Scroll</SelectItem>
                <SelectItem value="ellipsis">Ellipsis</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(['image', 'video'].includes(layer?.name || '')) && (
        <div className="grid grid-cols-3 items-center">
          <Label variant="muted">Object fit</Label>
          <div className="col-span-2 flex items-center gap-1">
            <Select value={objectFit} onValueChange={handleObjectFitChange}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="contain">Contain</SelectItem>
                  <SelectItem value="cover">Cover</SelectItem>
                  <SelectItem value="fill">Fill</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="scale-down">Scale down</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="input"
                  size="icon-sm"
                  className="rounded-lg"
                  aria-label="Object position"
                  title="Object position"
                >
                  <Icon name={(OBJECT_POSITIONS.find((p) => p.value === (objectPosition || 'center'))?.icon) || 'circle'} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2 my-0.5" align="end">
                <div className="grid grid-cols-3 gap-1">
                  {OBJECT_POSITIONS.map((position) => {
                    const isActive = (objectPosition || 'center') === position.value;
                    return (
                      <Button
                        key={position.value}
                        variant={isActive ? 'secondary' : 'outline'}
                        size="icon-sm"
                        className={`rounded-none ${OBJECT_POSITION_CORNERS[position.value] || ''}`}
                        aria-label={position.label}
                        title={position.label}
                        onClick={() => handleObjectPositionChange(position.value)}
                      >
                        <Icon name={position.icon} className={isActive ? 'text-foreground' : 'opacity-40'} />
                      </Button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      {aspectRatio && (
        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="h-8">Aspect ratio</Label>
          <div className="col-span-2 flex items-center gap-2">
            <ButtonGroup className="flex-1">
              <Input
                value={aspectRatioInput}
                onChange={(e) => handleAspectRatioChange(e.target.value)}
              />
              <ButtonGroupSeparator />
              <Select value={getAspectRatioPresetValue()} onValueChange={handleAspectRatioPresetChange}>
                <SelectTrigger />
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="aspect-square">Square</SelectItem>
                    <SelectItem value="aspect-video">Video</SelectItem>
                    <SelectItem value="aspect-4/3">4:3</SelectItem>
                    <SelectItem value="aspect-3/4">3:4</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </ButtonGroup>
            <button
              type="button"
              className="p-0.5 rounded-sm opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
              onClick={handleRemoveAspectRatio}
            >
              <Icon name="x" className="size-2.5" />
            </button>
          </div>
        </div>
      )}

    </SettingsPanel>
  );
});
export default SizingControls;
