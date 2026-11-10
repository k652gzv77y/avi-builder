/**
 * Zoom and pan math for the breakpoint board.
 * The viewport is the visible canvas (side panels already excluded).
 */

export interface CanvasBoardFit {
  /** Unscaled frame widths, primary first, in page pixels. */
  frameWidths: number[];
  /** Unscaled frame heights, same order as `frameWidths`, in page pixels. */
  frameHeights: number[];
  /** Gap between frames, in page pixels. Scales with zoom. */
  gap: number;
  /** Name row above each frame, in screen pixels. Does not scale. */
  labelHeight: number;
  /** Add button after the last frame, in screen pixels. Does not scale. */
  trailingScreenWidth: number;
  /** Inset on every side of the visible canvas, in screen pixels. */
  padding: number;
}

/** Label row: `h-6` plus `mb-2`. Kept in sync with BreakpointFrames. */
export const FRAME_LABEL_HEIGHT = 32;

/** Add button: `size-6`. Kept in sync with BreakpointFrames. */
export const FRAME_ADD_BUTTON_SIZE = 24;

/**
 * Zoom that fits every frame, the gaps, the label row, and the add button
 * inside the visible canvas with padding on every side.
 * Fit never zooms past 100%.
 */
export function fitBoardZoom(
  board: CanvasBoardFit,
  viewportWidth: number,
  viewportHeight: number,
  minZoom = 10,
  maxZoom = 100,
): number {
  const widths = board.frameWidths.filter((width) => width > 0);
  if (widths.length === 0 || viewportWidth <= 0 || viewportHeight <= 0) return minZoom;

  const heights = board.frameHeights.filter((height) => height > 0);
  const pageWidth = widths.reduce((sum, width) => sum + width, 0) + board.gap * widths.length;
  const pageHeight = Math.max(1, ...(heights.length > 0 ? heights : [1]));
  const availableWidth = Math.max(1, viewportWidth - board.padding * 2 - board.trailingScreenWidth);
  const availableHeight = Math.max(1, viewportHeight - board.padding * 2 - board.labelHeight);
  const fitted = Math.min(
    (availableWidth / pageWidth) * 100,
    (availableHeight / pageHeight) * 100,
  );
  const cap = Math.min(maxZoom, 100);
  return Math.min(Math.max(fitted, minZoom), cap);
}

/** Scroll offset that centers `scrollSize` in `viewportSize`. Zero when it already fits. */
export function centerScrollOffset(scrollSize: number, viewportSize: number): number {
  return Math.max(0, (scrollSize - viewportSize) / 2);
}

/**
 * Map a wheel event onto canvas pan.
 * deltaX pans horizontally, deltaY vertically.
 * Shift+wheel pans horizontally (browsers that already move the delta onto
 * deltaX are not applied twice).
 */
export function wheelPanDelta(
  deltaX: number,
  deltaY: number,
  shiftKey: boolean,
): { x: number; y: number } {
  if (shiftKey) {
    return { x: deltaX !== 0 ? deltaX : deltaY, y: 0 };
  }
  return { x: deltaX, y: deltaY };
}
