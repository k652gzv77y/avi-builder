'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useEditorStore } from '@/stores/useEditorStore';
import {
  RULER_SIZE,
  buildRulerTicks,
  iframeClientRectToCanvas,
  rulerHighlight,
  rulerOrigin,
  rulerTrack,
  unionCanvasRects,
  type CanvasRect,
  type RulerTick,
} from '@/lib/canvas-rulers';

interface CanvasRulersProps {
  iframeElement: HTMLIFrameElement | null;
  viewportRef: React.RefObject<HTMLElement | null>;
  scrollRef: React.RefObject<HTMLElement | null>;
  zoom: number;
  enabled: boolean;
}

interface RulerLayout {
  width: number;
  height: number;
  originX: number;
  originY: number;
  scale: number;
  selection: CanvasRect | null;
}

function nearly(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.25;
}

function sameRect(a: CanvasRect | null, b: CanvasRect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return nearly(a.x, b.x) && nearly(a.y, b.y) && nearly(a.width, b.width) && nearly(a.height, b.height);
}

function sameLayout(a: RulerLayout | null, b: RulerLayout): boolean {
  if (!a) return false;
  return nearly(a.width, b.width)
    && nearly(a.height, b.height)
    && nearly(a.originX, b.originX)
    && nearly(a.originY, b.originY)
    && nearly(a.scale, b.scale)
    && sameRect(a.selection, b.selection);
}

function measureSelection(doc: Document, ids: string[]): CanvasRect | null {
  const scroll = {
    x: doc.documentElement.scrollLeft || doc.body.scrollLeft || 0,
    y: doc.documentElement.scrollTop || doc.body.scrollTop || 0,
  };
  const rects: CanvasRect[] = [];

  for (const id of ids) {
    if (!id || id === 'body') continue;
    const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(id)
      : id.replace(/"/g, '\\"');
    doc.querySelectorAll(`[data-layer-id="${escaped}"]`).forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width < 1 && rect.height < 1) return;
      rects.push(iframeClientRectToCanvas(rect, scroll));
    });
  }

  return unionCanvasRects(rects);
}

function snap(offset: number): number {
  return Math.round(offset) + 0.5;
}

function RulerTicks({ ticks, axis }: { ticks: RulerTick[]; axis: 'x' | 'y' }) {
  return (
    <svg
      className="absolute inset-0 size-full overflow-hidden text-muted-foreground"
      style={{ fontFamily: 'inherit' }}
      aria-hidden
    >
      {ticks.map((tick) => {
        const at = snap(tick.offset);
        if (axis === 'x') {
          return (
            <line
              key={tick.value}
              x1={at}
              x2={at}
              y1={tick.major ? 10 : 15}
              y2={RULER_SIZE}
              stroke="currentColor"
              strokeWidth={1}
              opacity={tick.major ? 0.85 : 0.4}
            />
          );
        }
        return (
          <line
            key={tick.value}
            y1={at}
            y2={at}
            x1={tick.major ? 11 : 15}
            x2={RULER_SIZE}
            stroke="currentColor"
            strokeWidth={1}
            opacity={tick.major ? 0.85 : 0.4}
          />
        );
      })}
      {ticks.map((tick) => {
        if (!tick.label) return null;
        const at = Math.round(tick.offset);
        if (axis === 'x') {
          return (
            <text
              key={`label-${tick.value}`}
              x={at + 3}
              y={8}
              fill="currentColor"
              fontSize="8"
            >
              {tick.label}
            </text>
          );
        }
        const anchorX = 9;
        const anchorY = at + 3;
        return (
          <text
            key={`label-${tick.value}`}
            x={anchorX}
            y={anchorY}
            fill="currentColor"
            fontSize="8"
            textAnchor="end"
            transform={`rotate(-90 ${anchorX} ${anchorY})`}
          >
            {tick.label}
          </text>
        );
      })}
    </svg>
  );
}

function RulerRange({ range, axis }: { range: { start: number; size: number } | null; axis: 'x' | 'y' }) {
  if (!range) return null;

  const band = axis === 'x'
    ? { top: 0, height: '100%', left: range.start, width: range.size }
    : { left: 0, width: '100%', top: range.start, height: range.size };
  const leading = axis === 'x'
    ? { top: 0, height: '100%', left: range.start, width: 1 }
    : { left: 0, width: '100%', top: range.start, height: 1 };
  const trailing = axis === 'x'
    ? { top: 0, height: '100%', left: range.start + range.size, width: 1 }
    : { left: 0, width: '100%', top: range.start + range.size, height: 1 };

  return (
    <>
      <div
        className="absolute bg-[#0099ff]/25"
        style={band}
      />
      <div
        className="absolute bg-[#0099ff]"
        style={leading}
      />
      <div
        className="absolute bg-[#0099ff]"
        style={trailing}
      />
    </>
  );
}

/**
 * Horizontal and vertical rulers fixed to the canvas viewport.
 * Ticks stay in page CSS pixels while the editor zooms and pans.
 */
export default function CanvasRulers({
  iframeElement,
  viewportRef,
  scrollRef,
  zoom,
  enabled,
}: CanvasRulersProps) {
  const selectedLayerIds = useEditorStore((state) => state.selectedLayerIds);
  const [layout, setLayout] = useState<RulerLayout | null>(null);
  const selectionKey = selectedLayerIds.join('\0');

  const measure = useCallback(() => {
    try {
      const viewport = viewportRef.current;
      if (!enabled || !iframeElement || !viewport) {
        setLayout(null);
        return;
      }

      const doc = iframeElement.contentDocument;
      const iframeRect = iframeElement.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      if (viewportRect.width < 1 || viewportRect.height < 1) return;

      const scale = zoom / 100;
      const scrollLeft = doc?.documentElement.scrollLeft || doc?.body.scrollLeft || 0;
      const scrollTop = doc?.documentElement.scrollTop || doc?.body.scrollTop || 0;
      const next: RulerLayout = {
        width: viewportRect.width,
        height: viewportRect.height,
        originX: rulerOrigin(iframeRect.left, viewportRect.left, scrollLeft, scale),
        originY: rulerOrigin(iframeRect.top, viewportRect.top, scrollTop, scale),
        scale,
        selection: doc ? measureSelection(doc, selectionKey ? selectionKey.split('\0') : []) : null,
      };
      setLayout((current) => (sameLayout(current, next) ? current : next));
    } catch {
      // The iframe document can throw while it is detaching.
      setLayout(null);
    }
  }, [enabled, iframeElement, selectionKey, viewportRef, zoom]);

  useEffect(() => {
    if (!enabled || !iframeElement) {
      setLayout(null);
      return;
    }

    const viewport = viewportRef.current;
    const scroll = scrollRef.current;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    measure();
    scroll?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    const observer = new ResizeObserver(schedule);
    observer.observe(viewport ?? iframeElement);
    observer.observe(iframeElement);

    const body = iframeElement.contentDocument?.body ?? null;
    const mutation = body ? new MutationObserver(schedule) : null;
    if (body && mutation) {
      mutation.observe(body, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        childList: true,
        subtree: true,
      });
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroll?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      mutation?.disconnect();
    };
  }, [enabled, iframeElement, measure, scrollRef, viewportRef]);

  const horizontal = useMemo(
    () => (layout ? rulerTrack(layout.originX, layout.width, RULER_SIZE, layout.scale) : null),
    [layout],
  );
  const vertical = useMemo(
    () => (layout ? rulerTrack(layout.originY, layout.height, RULER_SIZE, layout.scale) : null),
    [layout],
  );
  const horizontalTicks = useMemo(
    () => (horizontal ? buildRulerTicks(horizontal) : []),
    [horizontal],
  );
  const verticalTicks = useMemo(
    () => (vertical ? buildRulerTicks(vertical) : []),
    [vertical],
  );
  const horizontalRange = useMemo(() => {
    if (!layout?.selection || !horizontal) return null;
    return rulerHighlight(
      layout.selection.x,
      layout.selection.width,
      horizontal.origin,
      layout.scale,
      horizontal.length,
    );
  }, [horizontal, layout]);
  const verticalRange = useMemo(() => {
    if (!layout?.selection || !vertical) return null;
    return rulerHighlight(
      layout.selection.y,
      layout.selection.height,
      vertical.origin,
      layout.scale,
      vertical.length,
    );
  }, [layout, vertical]);

  if (!enabled || !layout || !horizontal || !vertical) return null;

  return (
    <div
      data-canvas-rulers
      className="pointer-events-none absolute inset-0 z-[8] select-none"
      aria-hidden
    >
      <div
        className="absolute left-0 top-0 border-b border-r border-border bg-background"
        style={{ width: RULER_SIZE, height: RULER_SIZE }}
      />
      <div
        className="absolute right-0 top-0 overflow-hidden border-b border-border bg-background text-muted-foreground"
        style={{ left: RULER_SIZE, height: RULER_SIZE }}
      >
        <RulerRange
          range={horizontalRange}
          axis="x"
        />
        <RulerTicks
          ticks={horizontalTicks}
          axis="x"
        />
      </div>
      <div
        className="absolute bottom-0 left-0 overflow-hidden border-r border-border bg-background text-muted-foreground"
        style={{ top: RULER_SIZE, width: RULER_SIZE }}
      >
        <RulerRange
          range={verticalRange}
          axis="y"
        />
        <RulerTicks
          ticks={verticalTicks}
          axis="y"
        />
      </div>
    </div>
  );
}
