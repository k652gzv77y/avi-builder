'use client';

/**
 * Placement and dismiss controls for a Fixed or Relative overlay.
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OVERLAY_DISMISS_ROWS } from '@/lib/interactions-framer';
import { overlayDismissSummary } from '@/lib/overlay-setup';
import type { LayerOverlay, OverlayDismiss, OverlayPlacement } from '@/types';

interface OverlaySettingsProps {
  overlay: LayerOverlay;
  onChange: (overlay: LayerOverlay) => void;
}

export default function OverlaySettings({ overlay, onChange }: OverlaySettingsProps) {
  const setDismiss = (dismiss: OverlayDismiss) => {
    onChange({ ...overlay, dismiss });
  };

  return (
    <div className="flex flex-col gap-3 pb-3" data-panel="overlay">
      <div className="grid grid-cols-3 items-center">
        <Label variant="muted">Position</Label>
        <div className="col-span-2">
          <Tabs
            value={overlay.placement}
            onValueChange={(placement) => onChange({
              ...overlay,
              placement: placement as OverlayPlacement,
            })}
          >
            <TabsList className="w-full">
              <TabsTrigger value="fixed">Fixed</TabsTrigger>
              <TabsTrigger value="relative">Relative</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {OVERLAY_DISMISS_ROWS.map(row => (
          <label key={row.key} className="flex items-center gap-2">
            <Checkbox
              checked={overlay.dismiss[row.key]}
              onCheckedChange={(checked) => setDismiss({
                ...overlay.dismiss,
                [row.key]: checked === true,
              })}
            />
            <Label variant="muted">{row.label}</Label>
          </label>
        ))}
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {overlay.placement === 'fixed' ? 'Fixed' : 'Relative'}
        {' · '}
        {overlayDismissSummary(overlay.dismiss)}
      </p>
    </div>
  );
}
