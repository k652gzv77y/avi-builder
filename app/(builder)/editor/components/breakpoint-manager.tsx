'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import {
  breakpointForWidth,
  breakpointLabel,
  createBreakpoint,
  formatBreakpointRange,
  moveBreakpoint,
  renameBreakpoint,
  updateBreakpointRange,
  type BreakpointDefinition,
  type BreakpointMutation,
} from '@/lib/breakpoint-utils';

interface BreakpointManagerProps {
  catalog: BreakpointDefinition[];
  activeId?: string | null;
  onCommit: (mutation: BreakpointMutation) => Promise<BreakpointMutation>;
  onSelect?: (breakpoint: BreakpointDefinition) => void;
  onDeleteRequest?: (breakpoint: BreakpointDefinition) => void;
}

export default function BreakpointManager({
  catalog,
  activeId,
  onCommit,
  onSelect,
  onDeleteRequest,
}: BreakpointManagerProps) {
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [minWidth, setMinWidth] = useState('');
  const [maxWidth, setMaxWidth] = useState('');
  const [width, setWidth] = useState('');

  const apply = async (mutation: BreakpointMutation) => {
    if (mutation.error) {
      setError(mutation.error);
      return mutation;
    }
    setError(null);
    const saved = await onCommit(mutation);
    if (saved.error) setError(saved.error);
    return saved;
  };

  const handleAdd = () => {
    const parsedMax = maxWidth.trim() === '' ? null : Number(maxWidth);
    const parsedMin = minWidth.trim() === '' ? null : Number(minWidth);
    const parsedWidth = width.trim() === '' ? undefined : Number(width);
    if (parsedMax != null && !Number.isFinite(parsedMax)) {
      setError('Max width must be a number.');
      return;
    }
    if (parsedMin != null && !Number.isFinite(parsedMin)) {
      setError('Min width must be a number.');
      return;
    }
    const mutation = createBreakpoint(catalog, {
      name: name.trim() || undefined,
      maxWidth: parsedMax,
      minWidth: parsedMin,
      width: parsedWidth != null && Number.isFinite(parsedWidth) ? parsedWidth : undefined,
    });
    if (mutation.error || !mutation.created) {
      void apply(mutation);
      return;
    }
    setName('');
    setMinWidth('');
    setMaxWidth('');
    setWidth('');
    setError(null);
    void apply(mutation).then((saved) => {
      if (!saved.error && saved.created) onSelect?.(saved.created);
    });
  };

  return (
    <div className="flex w-[320px] flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-medium">Breakpoints</p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Desktop is the primary breakpoint. Other breakpoints override it up to their max width.
        </p>
      </div>

      <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {catalog.map((breakpoint, index) => (
          <BreakpointRow
            key={breakpoint.id}
            breakpoint={breakpoint}
            catalog={catalog}
            isActive={breakpoint.id === activeId}
            isFirst={index === 0}
            isLast={index === catalog.length - 1}
            onCommit={apply}
            onSelect={onSelect}
            onDeleteRequest={onDeleteRequest}
          />
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t pt-3">
        <Label className="text-[11px] text-muted-foreground">Add breakpoint</Label>
        <Input
          value={name}
          placeholder="Name"
          aria-label="New breakpoint name"
          disableKeyboardStep
          onChange={(event) => setName(event.target.value)}
        />
        <div className="grid grid-cols-3 gap-1.5">
          <Input
            value={width}
            placeholder="Width"
            aria-label="New breakpoint canvas width"
            inputMode="numeric"
            onChange={(event) => setWidth(event.target.value)}
          />
          <Input
            value={minWidth}
            placeholder="Min"
            aria-label="New breakpoint min width"
            inputMode="numeric"
            onChange={(event) => setMinWidth(event.target.value)}
          />
          <Input
            value={maxWidth}
            placeholder="Max"
            aria-label="New breakpoint max width"
            inputMode="numeric"
            onChange={(event) => setMaxWidth(event.target.value)}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleAdd}
        >
          <Icon name="plus" />
          Add breakpoint
        </Button>
      </div>

      {error && (
        <p className="text-[11px] text-destructive" role="alert">{error}</p>
      )}
    </div>
  );
}

function BreakpointRow({
  breakpoint,
  catalog,
  isActive,
  isFirst,
  isLast,
  onCommit,
  onSelect,
  onDeleteRequest,
}: {
  breakpoint: BreakpointDefinition;
  catalog: BreakpointDefinition[];
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  onCommit: (mutation: BreakpointMutation) => Promise<BreakpointMutation>;
  onSelect?: (breakpoint: BreakpointDefinition) => void;
  onDeleteRequest?: (breakpoint: BreakpointDefinition) => void;
}) {
  const [name, setName] = useState(breakpoint.name);
  const [width, setWidth] = useState(String(breakpoint.width));
  const [minWidth, setMinWidth] = useState(breakpoint.minWidth == null ? '' : String(breakpoint.minWidth));
  const [maxWidth, setMaxWidth] = useState(breakpoint.maxWidth == null ? '' : String(breakpoint.maxWidth));

  useEffect(() => {
    setName(breakpoint.name);
    setWidth(String(breakpoint.width));
    setMinWidth(breakpoint.minWidth == null ? '' : String(breakpoint.minWidth));
    setMaxWidth(breakpoint.maxWidth == null ? '' : String(breakpoint.maxWidth));
  }, [breakpoint.name, breakpoint.width, breakpoint.minWidth, breakpoint.maxWidth]);

  const resolved = breakpointForWidth(breakpoint.width, catalog);
  const widthIsOutside = resolved.id !== breakpoint.id;

  const commitName = () => {
    if (name.trim() === breakpoint.name) return;
    void onCommit(renameBreakpoint(catalog, breakpoint.id, name));
  };

  const commitRange = () => {
    const parsedWidth = Number(width);
    const parsedMin = minWidth.trim() === '' ? null : Number(minWidth);
    const parsedMax = breakpoint.maxWidth == null ? null : Number(maxWidth);
    if (!Number.isFinite(parsedWidth)) {
      setWidth(String(breakpoint.width));
      return;
    }
    if (parsedMin != null && !Number.isFinite(parsedMin)) {
      setMinWidth(breakpoint.minWidth == null ? '' : String(breakpoint.minWidth));
      return;
    }
    if (breakpoint.maxWidth != null && !Number.isFinite(parsedMax)) {
      setMaxWidth(String(breakpoint.maxWidth));
      return;
    }
    void onCommit(updateBreakpointRange(catalog, breakpoint.id, {
      width: parsedWidth,
      minWidth: parsedMin,
      maxWidth: breakpoint.maxWidth == null ? null : parsedMax,
    }));
  };

  return (
    <li className={`flex flex-col gap-1.5 rounded-md border p-2 ${isActive ? 'border-foreground/20 bg-secondary/60' : 'border-transparent bg-secondary/30'}`}>
      <div className="flex items-center gap-1">
        <div className="flex flex-col">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="size-4 px-0"
            aria-label={`Move ${breakpointLabel(breakpoint.id, catalog)} earlier`}
            disabled={isFirst}
            onClick={() => void onCommit(moveBreakpoint(catalog, breakpoint.id, -1))}
          >
            <Icon name="chevronUp" className="size-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="size-4 px-0"
            aria-label={`Move ${breakpointLabel(breakpoint.id, catalog)} later`}
            disabled={isLast}
            onClick={() => void onCommit(moveBreakpoint(catalog, breakpoint.id, 1))}
          >
            <Icon name="chevronDown" className="size-3" />
          </Button>
        </div>
        <Input
          value={name}
          aria-label={`${breakpointLabel(breakpoint.id, catalog)} name`}
          disableKeyboardStep
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          onFocus={() => onSelect?.(breakpoint)}
        />
        {!breakpoint.system && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="size-7 px-0"
            aria-label={`Delete ${breakpointLabel(breakpoint.id, catalog)}`}
            onClick={() => onDeleteRequest?.(breakpoint)}
          >
            <Icon name="trash" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">Width</span>
          <Input
            value={width}
            aria-label={`${breakpointLabel(breakpoint.id, catalog)} canvas width`}
            inputMode="numeric"
            onChange={(event) => setWidth(event.target.value)}
            onBlur={commitRange}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">Min</span>
          <Input
            value={minWidth}
            aria-label={`${breakpointLabel(breakpoint.id, catalog)} min width`}
            inputMode="numeric"
            placeholder="—"
            onChange={(event) => setMinWidth(event.target.value)}
            onBlur={commitRange}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">Max</span>
          <Input
            value={breakpoint.maxWidth == null ? '' : maxWidth}
            aria-label={`${breakpointLabel(breakpoint.id, catalog)} max width`}
            inputMode="numeric"
            placeholder={breakpoint.maxWidth == null ? 'Primary' : undefined}
            disabled={breakpoint.maxWidth == null}
            onChange={(event) => setMaxWidth(event.target.value)}
            onBlur={commitRange}
          />
        </label>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {formatBreakpointRange(breakpoint)}
        {breakpoint.system ? ' · Preset' : ''}
        {widthIsOutside ? ' · Artboard is outside this range' : ''}
      </p>
    </li>
  );
}
