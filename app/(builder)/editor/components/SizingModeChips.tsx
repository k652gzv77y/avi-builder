'use client';

import { cn } from '@/lib/utils';

export type SizingMode = 'fill' | 'fit' | 'fixed' | 'relative';

const MODE_LABELS: Record<SizingMode, string> = {
  fill: 'Fill',
  fit: 'Fit',
  fixed: 'Fixed',
  relative: 'Rel',
};

const MODE_ORDER: SizingMode[] = ['fill', 'fit', 'fixed', 'relative'];

export function detectSizingMode(value: string, axis: 'width' | 'height'): SizingMode {
  const normalized = value.trim().toLowerCase();

  if (normalized === '100%' || normalized === '[100%]' || normalized === '1fr') {
    return 'fill';
  }

  if (
    normalized === 'fit'
    || normalized === 'fit-content'
    || normalized === 'auto'
    || normalized === 'max-content'
    || normalized === 'min-content'
  ) {
    return 'fit';
  }

  if (
    normalized.includes('%')
    || normalized.includes('vw')
    || normalized.includes('vh')
    || normalized.includes('svh')
    || normalized.includes('lvh')
    || normalized.includes('dvh')
  ) {
    return 'relative';
  }

  if (!normalized) {
    return axis === 'height' ? 'fit' : 'fill';
  }

  return 'fixed';
}

interface SizingModeChipsProps {
  value: string;
  axis: 'width' | 'height';
  onChange: (mode: SizingMode) => void;
}

export default function SizingModeChips({ value, axis, onChange }: SizingModeChipsProps) {
  const active = detectSizingMode(value, axis);

  return (
    <div
      role="group"
      aria-label={`${axis} sizing mode`}
      className="grid grid-cols-4 overflow-hidden rounded-md border border-border bg-secondary/40"
    >
      {MODE_ORDER.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={cn(
            'h-6 text-[10px] font-medium tracking-tight transition-colors',
            active === mode
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {MODE_LABELS[mode]}
        </button>
      ))}
    </div>
  );
}
