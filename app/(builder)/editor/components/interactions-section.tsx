'use client';

import { Button } from '@/components/ui/button';
import { interactionSummary } from '@/lib/interactions-framer';
import type { Layer } from '@/types';

interface InteractionsSectionProps {
  layer: Layer | null;
  onOpen: () => void;
}

/**
 * Compact Interactions entry in the properties column.
 * The full event editor stays on the Interactions tab so Effects and
 * Interactions stay separate sections instead of one mixed list.
 */
export function InteractionsSection({ layer, onOpen }: InteractionsSectionProps) {
  const interactions = layer?.interactions ?? [];

  return (
    <div className="flex flex-col gap-2 pb-3" data-panel="interactions-summary">
      {interactions.length === 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Tap, hover, appear, and scroll. These are events, not visual effects.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {interactions.slice(0, 4).map((interaction) => (
            <li key={interaction.id} className="truncate text-[11px] text-muted-foreground">
              {interactionSummary(interaction)}
            </li>
          ))}
          {interactions.length > 4 ? (
            <li className="text-[11px] text-muted-foreground">
              +{interactions.length - 4} more
            </li>
          ) : null}
        </ul>
      )}
      <Button
        type="button"
        size="xs"
        variant="secondary"
        onClick={onOpen}
      >
        {interactions.length === 0 ? 'Add interaction' : 'Edit interactions'}
      </Button>
    </div>
  );
}
