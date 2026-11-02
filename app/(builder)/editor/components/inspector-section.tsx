'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface InspectorSectionProps {
  title: string;
  hint?: string;
  children: ReactNode;
}

/** Category header for the properties column. Inner controls keep their own titles. */
export function InspectorSection({ title, hint, children }: InspectorSectionProps) {
  return (
    <section className="border-b border-border/60 pb-1" data-inspector-section={title}>
      <header className="flex items-baseline justify-between gap-2 px-0 pb-1 pt-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {hint ? (
          <span className="truncate text-[10px] text-muted-foreground/80">{hint}</span>
        ) : null}
      </header>
      <div className="flex flex-col divide-y divide-border/50">{children}</div>
    </section>
  );
}

interface VariablesSectionProps {
  names: string[];
  onManage: () => void;
}

export function VariablesSection({ names, onManage }: VariablesSectionProps) {
  const preview = names.slice(0, 5).join(', ');

  return (
    <div className="flex flex-col gap-2 pb-3" data-panel="variables">
      <p className="text-[11px] leading-snug text-muted-foreground">
        {names.length === 0
          ? 'Expose text, image, and link properties on this component.'
          : preview}
        {names.length > 5 ? ` +${names.length - 5}` : ''}
      </p>
      <Button
        type="button"
        size="xs"
        variant="secondary"
        onClick={onManage}
      >
        {names.length === 0 ? 'Add variable' : 'Edit variables'}
      </Button>
    </div>
  );
}
