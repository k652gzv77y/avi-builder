'use client';

import { memo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Icon from '@/components/ui/icon';
import { StackPropertyLabel } from './BindingsPicker';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useControlledInput, useControlledInputs } from '@/hooks/use-controlled-input';
import { useModeToggle } from '@/hooks/use-mode-toggle';
import { useStackBindings } from '@/hooks/use-stack-bindings';
import { useEditorStore } from '@/stores/useEditorStore';
import { extractMeasurementValue } from '@/lib/measurement-utils';
import {
  paddingEditPlan,
  resolvePaddingMode,
  stackAxisFromDirection,
  uniformPaddingValue,
  type PaddingSideProperty,
  type SpacingContainerKind,
} from '@/lib/stack-spacing';
import { removeSpaces } from '@/lib/utils';
import type { Layer } from '@/types';

interface StackSpacingControlsProps {
  layer: Layer | null;
  kind: SpacingContainerKind;
  /** True when the selection is a child and these controls edit its parent. */
  editsParent?: boolean;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

const DISTRIBUTE_OPTIONS = [
  { value: 'start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'End' },
  { value: 'between', label: 'Space between' },
  { value: 'around', label: 'Space around' },
  { value: 'evenly', label: 'Space evenly' },
] as const;

const PADDING_FIELDS: { property: PaddingSideProperty; short: string; label: string }[] = [
  { property: 'paddingTop', short: 'T', label: 'Padding top' },
  { property: 'paddingRight', short: 'R', label: 'Padding right' },
  { property: 'paddingBottom', short: 'B', label: 'Padding bottom' },
  { property: 'paddingLeft', short: 'L', label: 'Padding left' },
];

const StackSpacingControls = memo(function StackSpacingControls({
  layer,
  kind,
  editsParent = false,
  onLayerUpdate,
}: StackSpacingControlsProps) {
  const activeBreakpoint = useEditorStore((state) => state.activeBreakpoint);
  const activeUIState = useEditorStore((state) => state.activeUIState);
  const { bindingFor, syncValue } = useStackBindings({ layer, onLayerUpdate });
  const {
    updateDesignProperty,
    updateDesignProperties,
    debouncedUpdateDesignProperty,
    getDesignProperty,
  } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
  });

  const isStack = kind === 'stack';
  const flexDirection = getDesignProperty('layout', 'flexDirection') || 'row';
  const axis = stackAxisFromDirection(flexDirection);
  const alignItems = getDesignProperty('layout', 'alignItems') || 'start';
  const justifyContent = getDesignProperty('layout', 'justifyContent') || 'start';
  const gap = getDesignProperty('layout', 'gap') || '';
  const columnGap = getDesignProperty('layout', 'columnGap') || '';
  const rowGap = getDesignProperty('layout', 'rowGap') || '';
  const paddingTop = getDesignProperty('spacing', 'paddingTop') || '';
  const paddingRight = getDesignProperty('spacing', 'paddingRight') || '';
  const paddingBottom = getDesignProperty('spacing', 'paddingBottom') || '';
  const paddingLeft = getDesignProperty('spacing', 'paddingLeft') || '';

  const inputs = useControlledInputs({
    gap,
    columnGap,
    rowGap,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
  }, extractMeasurementValue);

  const [gapInput, setGapInput] = inputs.gap;
  const [columnGapInput, setColumnGapInput] = inputs.columnGap;
  const [rowGapInput, setRowGapInput] = inputs.rowGap;
  const [paddingTopInput, setPaddingTopInput] = inputs.paddingTop;
  const [paddingRightInput, setPaddingRightInput] = inputs.paddingRight;
  const [paddingBottomInput, setPaddingBottomInput] = inputs.paddingBottom;
  const [paddingLeftInput, setPaddingLeftInput] = inputs.paddingLeft;

  const paddingUniform = uniformPaddingValue([paddingTop, paddingRight, paddingBottom, paddingLeft]);
  const [paddingInput, setPaddingInput] = useControlledInput(paddingUniform, extractMeasurementValue);
  const paddingMode = resolvePaddingMode(layer?.design?.spacing?.paddingMode, [
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
  ]);

  const gapModeToggle = useModeToggle({
    category: 'layout',
    unifiedProperty: 'gap',
    individualProperties: ['columnGap', 'rowGap'],
    modeProperty: 'gapMode',
    updateDesignProperty,
    updateDesignProperties,
    getCurrentValue: (property: string) => getDesignProperty('layout', property) || '',
    getStoredMode: () => {
      const stored = layer?.design?.layout?.gapMode;
      return stored === 'all' || stored === 'individual' ? stored : null;
    },
  });

  const updateDesignPropertiesRef = useRef(updateDesignProperties);
  updateDesignPropertiesRef.current = updateDesignProperties;
  const paddingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (paddingTimer.current) clearTimeout(paddingTimer.current);
    };
  }, [layer?.id]);

  const kindLabel = kind === 'grid' ? 'Grid' : 'Stack';
  const hint = editsParent
    ? `In ${layer?.customName || layer?.name || kindLabel}`
    : kindLabel;

  const fieldLabel = (key: 'align' | 'distribute' | 'gap' | 'padding', fallback: string, className?: string) => {
    if (!isStack) return <Label variant="muted" className={className}>{fallback}</Label>;
    return (
      <StackPropertyLabel
        binding={bindingFor(key)}
        fallback={fallback}
        className={className}
      />
    );
  };

  const handleAlignChange = (value: string) => {
    updateDesignProperty('layout', 'alignItems', value);
    syncValue('align', value);
  };

  const handleJustifyChange = (value: string) => {
    updateDesignProperty('layout', 'justifyContent', value);
    syncValue('distribute', value);
  };

  const handleGapChange = (value: string) => {
    setGapInput(value);
    if (gapModeToggle.mode !== 'all') return;
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('layout', 'gap', sanitized || null);
    syncValue('gap', sanitized);
  };

  const handleColumnGapChange = (value: string) => {
    setColumnGapInput(value);
    debouncedUpdateDesignProperty('layout', 'columnGap', removeSpaces(value) || null);
  };

  const handleRowGapChange = (value: string) => {
    setRowGapInput(value);
    debouncedUpdateDesignProperty('layout', 'rowGap', removeSpaces(value) || null);
  };

  const queueUniformPadding = (stored: string | null) => {
    if (paddingTimer.current) clearTimeout(paddingTimer.current);
    paddingTimer.current = setTimeout(() => {
      updateDesignPropertiesRef.current([
        { category: 'spacing', property: 'paddingTop', value: stored },
        { category: 'spacing', property: 'paddingRight', value: stored },
        { category: 'spacing', property: 'paddingBottom', value: stored },
        { category: 'spacing', property: 'paddingLeft', value: stored },
      ]);
    }, 150);
  };

  const handleUniformPadding = (value: string) => {
    setPaddingInput(value);
    const sanitized = removeSpaces(value);
    queueUniformPadding(sanitized || null);
    syncValue('padding', sanitized);
  };

  const sideSetters: Record<PaddingSideProperty, (value: string) => void> = {
    paddingTop: setPaddingTopInput,
    paddingRight: setPaddingRightInput,
    paddingBottom: setPaddingBottomInput,
    paddingLeft: setPaddingLeftInput,
  };

  const handleSidePadding = (property: PaddingSideProperty, value: string) => {
    sideSetters[property](value);
    debouncedUpdateDesignProperty('spacing', property, removeSpaces(value) || null);
  };

  const handlePaddingModeToggle = () => {
    if (paddingTimer.current) clearTimeout(paddingTimer.current);
    const nextMode = paddingMode === 'all' ? 'individual' : 'all';
    const plan = paddingEditPlan(nextMode, {
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
    });
    updateDesignProperties(plan.map((edit) => ({
      category: 'spacing' as const,
      property: edit.property,
      value: edit.value ? removeSpaces(edit.value) : null,
    })));
    if (nextMode === 'all') {
      const uniform = plan.find((edit) => edit.property === 'paddingTop')?.value || '';
      syncValue('padding', removeSpaces(uniform));
    }
  };

  const alignIcon = (value: string) => {
    if (value === 'stretch') {
      return <Icon name="alignStretch" className={axis === 'column' ? '-rotate-90' : ''} />;
    }
    if (axis === 'column') {
      if (value === 'center') return <Icon name="layout-align-center-horizontally" className="size-3.5" />;
      if (value === 'end') return <Icon name="layout-align-right" className="size-3.5" />;
      return <Icon name="layout-align-left" className="size-3.5" />;
    }
    if (value === 'center') return <Icon name="layout-align-center-vertically" className="size-3.5" />;
    if (value === 'end') return <Icon name="layout-align-bottom" className="size-3.5" />;
    return <Icon name="layout-align-top" className="size-3.5" />;
  };

  const distributeIcon = (value: string) => {
    if (value === 'between') {
      return (
        <Icon
          name={axis === 'column' ? 'distribute-vertically' : 'distribute-horizontally'}
          className="size-3"
        />
      );
    }
    if (axis === 'column') {
      if (value === 'center') return <Icon name="layout-align-center-vertically" className="size-3" />;
      if (value === 'end') return <Icon name="layout-align-bottom" className="size-3" />;
      if (value === 'start') return <Icon name="layout-align-top" className="size-3" />;
    } else {
      if (value === 'center') return <Icon name="layout-align-center-horizontally" className="size-3" />;
      if (value === 'end') return <Icon name="layout-align-right" className="size-3" />;
      if (value === 'start') return <Icon name="layout-align-left" className="size-3" />;
    }
    return null;
  };

  const sideValue: Record<PaddingSideProperty, string> = {
    paddingTop: paddingTopInput,
    paddingRight: paddingRightInput,
    paddingBottom: paddingBottomInput,
    paddingLeft: paddingLeftInput,
  };

  const mixedPadding = paddingUniform === '' && Boolean(
    paddingTop || paddingRight || paddingBottom || paddingLeft,
  );

  return (
    <div className="py-3" data-spacing-owner={editsParent ? 'parent' : 'self'}>
      <header className="py-2 -mt-2 flex items-center gap-1.5">
        <Label>Spacing</Label>
        <Label variant="muted" className="truncate">{hint}</Label>
      </header>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3">
          {fieldLabel('distribute', 'Distribute')}
          <div className="col-span-2 *:w-full">
            <Select value={justifyContent} onValueChange={handleJustifyChange}>
              <SelectTrigger aria-label="Distribute">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {DISTRIBUTE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {distributeIcon(option.value)}
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3">
          {fieldLabel('align', 'Align')}
          <div className="col-span-2">
            <Tabs
              value={alignItems}
              onValueChange={handleAlignChange}
              className="w-full"
            >
              <TabsList className="w-full">
                <TabsTrigger value="start" aria-label="Align start">
                  {alignIcon('start')}
                </TabsTrigger>
                <TabsTrigger value="center" aria-label="Align center">
                  {alignIcon('center')}
                </TabsTrigger>
                <TabsTrigger value="end" aria-label="Align end">
                  {alignIcon('end')}
                </TabsTrigger>
                <TabsTrigger value="stretch" aria-label="Stretch">
                  {alignIcon('stretch')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="grid grid-cols-3 items-start">
          {fieldLabel('gap', 'Gap', 'h-8')}
          <div className="col-span-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <InputGroup className="flex-1">
                <InputGroupInput
                  stepper
                  min="0"
                  step="1"
                  disabled={gapModeToggle.mode === 'individual'}
                  value={gapInput}
                  aria-label="Gap"
                  onChange={(event) => handleGapChange(event.target.value)}
                />
              </InputGroup>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={gapModeToggle.mode === 'individual' ? 'secondary' : 'ghost'}
                    size="sm"
                    aria-label={gapModeToggle.mode === 'individual' ? 'Use one gap' : 'Edit row and column gap'}
                    aria-pressed={gapModeToggle.mode === 'individual'}
                    onClick={gapModeToggle.handleToggle}
                  >
                    <Icon name={gapModeToggle.mode === 'individual' ? 'unlink' : 'link'} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {gapModeToggle.mode === 'individual' ? 'Use one gap' : 'Row and column gap'}
                </TooltipContent>
              </Tooltip>
            </div>
            {gapModeToggle.mode === 'individual' && (
              <div className="grid grid-cols-2 gap-2">
                <InputGroup>
                  <InputGroupAddon>
                    <Icon name="horizontalGap" className="size-3" />
                  </InputGroupAddon>
                  <InputGroupInput
                    stepper
                    min="0"
                    step="1"
                    value={columnGapInput}
                    aria-label="Horizontal gap"
                    onChange={(event) => handleColumnGapChange(event.target.value)}
                  />
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon>
                    <Icon name="verticalGap" className="size-3" />
                  </InputGroupAddon>
                  <InputGroupInput
                    stepper
                    min="0"
                    step="1"
                    value={rowGapInput}
                    aria-label="Vertical gap"
                    onChange={(event) => handleRowGapChange(event.target.value)}
                  />
                </InputGroup>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 items-start">
          {fieldLabel('padding', 'Padding', 'h-8')}
          <div className="col-span-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <InputGroup className="flex-1">
                <InputGroupAddon>
                  <Icon name="padding-per-side" className="size-3" />
                </InputGroupAddon>
                <InputGroupInput
                  stepper
                  min="0"
                  step="1"
                  disabled={paddingMode === 'individual'}
                  placeholder={mixedPadding ? 'Mixed' : undefined}
                  value={paddingMode === 'individual' ? '' : paddingInput}
                  aria-label="Padding"
                  onChange={(event) => handleUniformPadding(event.target.value)}
                />
              </InputGroup>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={paddingMode === 'individual' ? 'secondary' : 'ghost'}
                    size="sm"
                    aria-label={paddingMode === 'individual' ? 'Use the same padding on every side' : 'Edit padding per side'}
                    aria-pressed={paddingMode === 'individual'}
                    onClick={handlePaddingModeToggle}
                  >
                    <Icon name={paddingMode === 'individual' ? 'unlink' : 'padding-per-side'} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {paddingMode === 'individual' ? 'Padding on all sides' : 'Padding per side'}
                </TooltipContent>
              </Tooltip>
            </div>
            {paddingMode === 'individual' && (
              <div className="grid grid-cols-2 gap-1.5">
                {PADDING_FIELDS.map((side) => (
                  <InputGroup key={side.property}>
                    <InputGroupAddon>
                      <span className="w-3 text-center text-[10px] text-muted-foreground">{side.short}</span>
                    </InputGroupAddon>
                    <InputGroupInput
                      stepper
                      min="0"
                      step="1"
                      value={sideValue[side.property]}
                      aria-label={side.label}
                      onChange={(event) => handleSidePadding(side.property, event.target.value)}
                    />
                  </InputGroup>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default StackSpacingControls;
