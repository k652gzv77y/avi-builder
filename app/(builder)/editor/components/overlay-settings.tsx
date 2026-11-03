'use client';

/**
 * Placement and dismiss controls for an overlay layer.
 * Edits copy onto every Open Overlay action that targets this layer.
 */

import { flattenLayers } from '@/lib/interactions-framer';
import { overlayDismissSummary } from '@/lib/overlay-setup';
import { overlayKindLabel, resolveOverlayKind } from '@/lib/overlay-position';
import type { Layer, LayerOverlay } from '@/types';

import OverlayChromeControls from './overlay-chrome-controls';

interface OverlaySettingsProps {
  overlay: LayerOverlay;
  layers: Layer[];
  overlayId: string;
  onChange: (overlay: LayerOverlay) => void;
}

export default function OverlaySettings({
  overlay,
  layers,
  overlayId,
  onChange,
}: OverlaySettingsProps) {
  const kind = resolveOverlayKind(overlay);

  return (
    <div className="flex flex-col gap-3 pb-3" data-panel="overlay">
      <OverlayChromeControls
        value={{
          kind,
          anchor: overlay.anchor ?? 'bottom',
          anchorLayerId: overlay.anchorLayerId,
          dismiss: overlay.dismiss,
        }}
        layers={flattenLayers(layers)}
        excludeLayerId={overlayId}
        onChange={(next) => onChange({
          ...overlay,
          kind: next.kind,
          anchor: next.anchor,
          anchorLayerId: next.anchorLayerId,
          dismiss: next.dismiss,
        })}
      />
      <p className="text-[11px] leading-snug text-muted-foreground">
        {overlayKindLabel(kind)}
        {' · '}
        {overlayDismissSummary(overlay.dismiss)}
      </p>
    </div>
  );
}
