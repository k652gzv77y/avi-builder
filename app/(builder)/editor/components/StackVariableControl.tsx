'use client';

/**
 * Instance control for a stack variable. Desktop is the base value.
 * Tablet and Phone write breakpoint overrides on the same variable.
 */

import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OverrideReset } from './BreakpointOverride';
import { useControlledInput } from '@/hooks/use-controlled-input';
import { readStackBreakpoint, writeStackBreakpoint } from '@/lib/component-bindings';
import { extractMeasurementValue } from '@/lib/measurement-utils';
import { removeSpaces } from '@/lib/utils';
import { useEditorStore } from '@/stores/useEditorStore';
import type { StackVariableKey, StackVariableValue } from '@/types';

interface StackVariableControlProps {
  stackKey: StackVariableKey;
  value: StackVariableValue;
  onChange: (value: StackVariableValue) => void;
}

const ALIGN_OPTIONS = [
  { value: 'start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'End' },
  { value: 'stretch', label: 'Stretch' },
];

const DISTRIBUTE_OPTIONS = [
  { value: 'start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'End' },
  { value: 'between', label: 'Between' },
  { value: 'around', label: 'Around' },
  { value: 'evenly', label: 'Evenly' },
];

export default function StackVariableControl({
  stackKey,
  value,
  onChange,
}: StackVariableControlProps) {
  const activeBreakpoint = useEditorStore(state => state.activeBreakpoint);
  const current = readStackBreakpoint(value, activeBreakpoint);
  const [measurement, setMeasurement] = useControlledInput(
    current.value,
    extractMeasurementValue,
  );

  const write = (raw: string) => {
    onChange(writeStackBreakpoint(value, activeBreakpoint, raw));
  };

  const reset = (
    <OverrideReset
      isOverride={current.isOverride}
      propertyLabel="variable"
      onReset={() => write('')}
    />
  );

  if (stackKey === 'direction') {
    const axis = current.value === 'column' || current.value === 'column-reverse' ? 'column' : 'row';
    return (
      <div className="flex items-center gap-1">
        <Tabs
          value={axis}
          onValueChange={write}
          className="w-full"
        >
          <TabsList className="w-full">
            <TabsTrigger value="row" aria-label="Horizontal">
              <Icon name="layout" className="size-3" />
            </TabsTrigger>
            <TabsTrigger value="column" aria-label="Vertical">
              <Icon name="layout" className="size-3 rotate-90" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {reset}
      </div>
    );
  }

  if (stackKey === 'align' || stackKey === 'distribute') {
    const options = stackKey === 'align' ? ALIGN_OPTIONS : DISTRIBUTE_OPTIONS;
    return (
      <div className="flex items-center gap-1">
        <Select value={current.value || 'start'} onValueChange={write}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {reset}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={measurement}
        onChange={(event) => {
          setMeasurement(event.target.value);
          write(removeSpaces(event.target.value));
        }}
        aria-label={stackKey === 'padding' ? 'Padding' : 'Gap'}
      />
      {reset}
    </div>
  );
}
