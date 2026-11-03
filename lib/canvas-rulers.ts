/**
 * Persistent canvas rulers.
 *
 * Page coordinates are CSS pixels in the iframe document (the same space as
 * free-form drag and snap guides). The ruler track is drawn in screen pixels
 * on the editor viewport. `origin` is where page coordinate 0 sits along that
 * track, and `scale` is zoom / 100.
 */

export const RULER_SIZE = 20;

/** Major labels stay at least this many screen pixels apart. */
export const RULER_LABEL_SCREEN_PX = 72;

/** Minor ticks are omitted when they would be denser than this. */
export const RULER_MINOR_SCREEN_PX = 6;

const MAJOR_STEPS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export interface RulerGeometry {
  /** Screen position of page coordinate 0, relative to the start of the track. */
  origin: number;
  /** Track length in screen pixels. */
  length: number;
  /** Screen pixels per page CSS pixel. */
  scale: number;
}

export interface RulerTick {
  /** Page coordinate in CSS pixels. */
  value: number;
  /** Position along the track in screen pixels. */
  offset: number;
  major: boolean;
  label: string | null;
}

export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenRange {
  start: number;
  size: number;
}

export function chooseMajorStep(scale: number, targetScreenPx = RULER_LABEL_SCREEN_PX): number {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const raw = targetScreenPx / safeScale;
  for (const step of MAJOR_STEPS) {
    if (step >= raw - 1e-6) return step;
  }
  let step = MAJOR_STEPS[MAJOR_STEPS.length - 1];
  while (step < raw && step < 1e9) step *= 10;
  return step;
}

export function chooseMinorStep(
  major: number,
  scale: number,
  minScreenPx = RULER_MINOR_SCREEN_PX,
): number | null {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (!(major > 0)) return null;
  for (const divisor of [10, 5, 2]) {
    if (major % divisor !== 0) continue;
    const minor = major / divisor;
    if (minor >= 1 && minor * safeScale >= minScreenPx) return minor;
  }
  return null;
}

/** Screen offset of a page CSS pixel along a ruler track. */
export function canvasToScreen(canvasPx: number, origin: number, scale: number): number {
  return origin + canvasPx * scale;
}

/**
 * Screen position of page coordinate 0 relative to a viewport edge.
 * `iframeEdge` and `viewportEdge` come from getBoundingClientRect, which
 * already includes ancestor scroll. `iframeScroll` is the iframe document's
 * own scroll, in CSS pixels.
 */
export function rulerOrigin(
  iframeEdge: number,
  viewportEdge: number,
  iframeScroll: number,
  scale: number,
): number {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return (iframeEdge - viewportEdge) - iframeScroll * safeScale;
}

/** Geometry of one ruler track after the corner inset. */
export function rulerTrack(
  viewportOrigin: number,
  viewportSize: number,
  inset: number,
  scale: number,
): RulerGeometry {
  return {
    origin: viewportOrigin - inset,
    length: Math.max(0, viewportSize - inset),
    scale,
  };
}

export function formatRulerLabel(value: number): string {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 0.05) return String(rounded);
  return String(Math.round(value * 10) / 10);
}

export function buildRulerTicks({ origin, length, scale }: RulerGeometry): RulerTick[] {
  if (!(length > 0) || !(scale > 0) || !Number.isFinite(origin)) return [];

  const major = chooseMajorStep(scale);
  const minor = chooseMinorStep(major, scale);
  const step = minor ?? major;
  const start = (0 - origin) / scale;
  const end = (length - origin) / scale;
  const first = Math.floor(start / step);
  let last = Math.ceil(end / step);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return [];
  if (last < first) return [];
  if (last - first > 500) last = first + 500;

  const ticks: RulerTick[] = [];
  for (let index = first; index <= last; index += 1) {
    const value = index * step;
    const offset = canvasToScreen(value, origin, scale);
    if (offset < -0.5 || offset > length + 0.5) continue;
    const isMajor = major > 0 && value % major === 0;
    ticks.push({
      value,
      offset,
      major: isMajor,
      label: isMajor ? formatRulerLabel(value) : null,
    });
  }
  return ticks;
}

/** Map a page-axis span onto a ruler track, clipped to the visible track. */
export function rulerHighlight(
  canvasStart: number,
  canvasSize: number,
  origin: number,
  scale: number,
  trackLength: number,
): ScreenRange | null {
  if (!(canvasSize > 0) || !(scale > 0) || !(trackLength > 0)) return null;
  if (!Number.isFinite(canvasStart) || !Number.isFinite(origin)) return null;

  const start = canvasToScreen(canvasStart, origin, scale);
  const end = canvasToScreen(canvasStart + canvasSize, origin, scale);
  const clippedStart = Math.max(0, Math.min(start, end));
  const clippedEnd = Math.min(trackLength, Math.max(start, end));
  if (clippedEnd - clippedStart < 0.5) return null;
  return { start: clippedStart, size: clippedEnd - clippedStart };
}

export function unionCanvasRects(rects: CanvasRect[]): CanvasRect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const rect of rects) {
    if (!(rect.width > 0) && !(rect.height > 0)) continue;
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + Math.max(0, rect.width));
    maxY = Math.max(maxY, rect.y + Math.max(0, rect.height));
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** iframe getBoundingClientRect plus the document scroll, in page CSS pixels. */
export function iframeClientRectToCanvas(
  rect: { left: number; top: number; width: number; height: number },
  scroll: { x: number; y: number },
): CanvasRect {
  return {
    x: rect.left + scroll.x,
    y: rect.top + scroll.y,
    width: rect.width,
    height: rect.height,
  };
}
