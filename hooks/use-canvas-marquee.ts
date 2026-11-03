'use client';

/**
 * Drag on empty canvas space to select free-form layers inside the rectangle.
 * Clicks on a layer are left to the existing drag/select handlers.
 */

import { useEffect, useRef } from 'react';
import { findLayerWithParent } from '@/lib/layer-utils';
import { isFreeformDraggable, pointerToWindowPoint } from '@/lib/canvas-freeform';
import { normalizeRect, outermostIntersectingIds } from '@/lib/canvas-align';
import type { Layer } from '@/types';

const MARQUEE_THRESHOLD = 4;

let suppressBodySelect = false;

/** Body click follows mouseup. Ignore it when a marquee just replaced the selection. */
export function shouldIgnoreCanvasBodySelect(): boolean {
  if (!suppressBodySelect) return false;
  suppressBodySelect = false;
  return true;
}

interface UseCanvasMarqueeOptions {
  iframeElement: HTMLIFrameElement | null;
  zoom: number;
  layers: Layer[];
  disabled?: boolean;
  isPanGestureActive?: () => boolean;
  onSelect: (ids: string[]) => void;
}

export function useCanvasMarquee({
  iframeElement,
  zoom,
  layers,
  disabled = false,
  isPanGestureActive,
  onSelect,
}: UseCanvasMarqueeOptions) {
  const layersRef = useRef(layers);
  const zoomRef = useRef(zoom);
  const onSelectRef = useRef(onSelect);
  const panRef = useRef(isPanGestureActive);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    panRef.current = isPanGestureActive;
  }, [isPanGestureActive]);

  useEffect(() => {
    if (!iframeElement || disabled) return;
    const iframeDoc = iframeElement.contentDocument;
    if (!iframeDoc) return;

    let start: { x: number; y: number } | null = null;
    let dragging = false;
    let rectEl: HTMLDivElement | null = null;

    const canvasPoint = (event: MouseEvent) => {
      const fromIframe = event.view === iframeElement.contentWindow;
      if (fromIframe) return { x: event.clientX, y: event.clientY };
      const origin = iframeElement.getBoundingClientRect();
      const scale = zoomRef.current > 0 ? zoomRef.current / 100 : 1;
      return {
        x: (event.clientX - origin.left) / scale,
        y: (event.clientY - origin.top) / scale,
      };
    };

    const paint = (current: { x: number; y: number }) => {
      if (!start) return;
      const origin = iframeElement.getBoundingClientRect();
      const a = pointerToWindowPoint(start.x, start.y, true, origin, zoomRef.current);
      const b = pointerToWindowPoint(current.x, current.y, true, origin, zoomRef.current);
      const rect = normalizeRect(a.x, a.y, b.x, b.y);
      if (!rectEl) {
        rectEl = document.createElement('div');
        rectEl.setAttribute('data-canvas-marquee', 'true');
        rectEl.style.cssText = [
          'position:fixed',
          'z-index:70',
          'pointer-events:none',
          'border:1px solid #0099ff',
          'background:rgba(0,153,255,0.12)',
        ].join(';');
        document.body.appendChild(rectEl);
      }
      rectEl.style.left = `${rect.left}px`;
      rectEl.style.top = `${rect.top}px`;
      rectEl.style.width = `${rect.width}px`;
      rectEl.style.height = `${rect.height}px`;
    };

    const clearRect = () => {
      rectEl?.remove();
      rectEl = null;
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
      if (panRef.current?.()) return;
      const target = event.target as HTMLElement | null;
      const layerEl = target?.closest?.('[data-layer-id]') as HTMLElement | null;
      const layerId = layerEl?.getAttribute('data-layer-id');
      if (layerId && layerId !== 'body') return;
      start = { x: event.clientX, y: event.clientY };
      dragging = false;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!start) return;
      const current = canvasPoint(event);
      if (!dragging) {
        if (Math.hypot(current.x - start.x, current.y - start.y) < MARQUEE_THRESHOLD) return;
        dragging = true;
      }
      paint(current);
    };

    const onMouseUp = (event: MouseEvent) => {
      if (!start) return;
      const origin = start;
      const didDrag = dragging;
      const current = canvasPoint(event);
      start = null;
      dragging = false;
      clearRect();
      if (!didDrag) return;

      const marquee = normalizeRect(origin.x, origin.y, current.x, current.y);
      const doc = iframeElement.contentDocument;
      if (!doc) return;
      const items: Array<{ id: string; parentId: string | null; box: { left: number; top: number; width: number; height: number } }> = [];
      doc.querySelectorAll('[data-layer-id]').forEach((node) => {
        const id = (node as HTMLElement).getAttribute('data-layer-id');
        if (!id || id === 'body') return;
        const found = findLayerWithParent(layersRef.current, id);
        if (!found || !isFreeformDraggable(found.layer, found.parent)) return;
        const rect = (node as HTMLElement).getBoundingClientRect();
        items.push({
          id,
          parentId: found.parent?.id ?? null,
          box: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        });
      });
      const ids = outermostIntersectingIds(items, marquee);
      suppressBodySelect = true;
      onSelectRef.current(ids);
    };

    iframeDoc.addEventListener('mousedown', onMouseDown);
    iframeDoc.addEventListener('mousemove', onMouseMove);
    iframeDoc.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      iframeDoc.removeEventListener('mousedown', onMouseDown);
      iframeDoc.removeEventListener('mousemove', onMouseMove);
      iframeDoc.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      clearRect();
    };
  }, [iframeElement, disabled]);
}
