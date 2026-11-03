'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

import { motionSpec } from '@/lib/action-transition';
import {
  captureVariantSnapshot,
  playVariantCrossfade,
} from '@/lib/action-transition-playback';
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

function layerElement(layerId: string): HTMLElement | null {
  if (typeof document === 'undefined' || !layerId) return null;
  const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(layerId)
    : layerId.replace(/"/g, '\\"');
  return document.querySelector(`[data-layer-id="${escaped}"]`);
}

/**
 * Crossfade a variant change in preview and on published pages.
 * The first paint only records the tree. Later playback tokens play the
 * authored transition. The design canvas does not use this hook.
 */
export function useVariantTransitionPlayback(layerId: string): void {
  const token = useInteractionPreviewStore(state => state.playbackByLayerId[layerId]?.token ?? 0);
  const snapshotRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const seenRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const live = layerElement(layerId);
    if (seenRef.current === null) {
      seenRef.current = token;
      if (live) snapshotRef.current = captureVariantSnapshot(live);
      return;
    }
    if (seenRef.current !== token) {
      seenRef.current = token;
      const transition = useInteractionPreviewStore.getState().playbackByLayerId[layerId]?.transition;
      const spec = motionSpec(transition);
      const previous = snapshotRef.current;
      cancelRef.current?.();
      cancelRef.current = null;
      if (live && previous && spec) {
        cancelRef.current = playVariantCrossfade(live, previous, spec);
      }
    }
    if (live) snapshotRef.current = captureVariantSnapshot(live);
  }, [layerId, token]);

  useEffect(() => () => {
    cancelRef.current?.();
    cancelRef.current = null;
  }, []);
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
