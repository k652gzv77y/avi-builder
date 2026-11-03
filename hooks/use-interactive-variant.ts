'use client';

import { useEffect } from 'react';

import { bindComponentGestures } from '@/lib/interaction-runtime';
import { useInteractionPreviewStore } from '@/stores/useInteractionPreviewStore';
import type { Layer } from '@/types';

/** The variant tree to render. The resting layer is used until a gesture selects a pane. */
export function useInteractiveVariantLayer(layer: Layer): Layer {
  const spec = layer._interactiveVariants;
  const activeVariantId = useInteractionPreviewStore((state) => (
    spec ? state.variantByLayerId[layer.id] : undefined
  ));
  if (!spec || !activeVariantId) return layer;
  return spec.panes[activeVariantId] ?? layer;
}

/** Bind Hover and Press for variants that are not already driven by a layer action. */
export function useInteractiveVariantGestures(layer: Layer): void {
  const hoverVariantId = layer._interactiveVariants?.hoverVariantId;
  const pressedVariantId = layer._interactiveVariants?.pressedVariantId;

  useEffect(() => {
    if (!hoverVariantId && !pressedVariantId) return undefined;
    return bindComponentGestures(document, layer.id, { hoverVariantId, pressedVariantId });
  }, [layer.id, hoverVariantId, pressedVariantId]);
}
