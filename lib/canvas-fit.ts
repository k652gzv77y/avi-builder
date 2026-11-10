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

/** Phone, tablet, and desktop viewport heights. Fill and vh resolve against these. */
export const PHONE_VIEWPORT_HEIGHT = 844;
export const TABLET_VIEWPORT_HEIGHT = 1080;
export const DESKTOP_VIEWPORT_HEIGHT = 900;

/** Device viewport for a breakpoint width, so a frame is at least one screen tall. */
export function deviceViewportHeight(frameWidth: number): number {
  if (frameWidth <= 500) return PHONE_VIEWPORT_HEIGHT;
  if (frameWidth <= 1024) return TABLET_VIEWPORT_HEIGHT;
  return DESKTOP_VIEWPORT_HEIGHT;
}

/**
 * Frame height is the published document height, and never shorter than the
 * device viewport. A collapsed fill measurement (the ~140px strip) does not
 * win over the device height.
 */
export function resolveFrameHeight(contentHeight: number, frameWidth: number): number {
  return Math.max(contentHeight, deviceViewportHeight(frameWidth));
}

export interface PublishedCard {
  title: string;
  /** Card height once fill resolves against the device viewport, not auto. */
  height: number;
}

export interface PublishedFrame {
  breakpointWidth: number;
  /** Horizontal stack of collection cards, the shape of the Kolbo homepage. */
  cards: PublishedCard[];
}

/** How that page lays out at a breakpoint: every card, at least one device tall. */
export function layoutPublishedFrame(frame: PublishedFrame) {
  const viewport = deviceViewportHeight(frame.breakpointWidth);
  const contentBottom = frame.cards.reduce((max, card) => Math.max(max, card.height), 0);
  return {
    titles: frame.cards.map((card) => card.title),
    height: Math.max(contentBottom, viewport),
    viewport,
  };
}

export interface Camera {
  /** Screen pixels from the viewport origin to the board origin. */
  x: number;
  y: number;
}

/**
 * Place the frames in the viewport. The artboards are centered vertically;
 * the name row sits above them, so it is not part of the centered box.
 */
export function centerBoardCamera(input: {
  viewportWidth: number;
  viewportHeight: number;
  boardWidth: number;
  frameHeight: number;
  labelHeight: number;
}): Camera {
  return {
    x: (input.viewportWidth - input.boardWidth) / 2,
    y: (input.viewportHeight - input.frameHeight) / 2 - input.labelHeight,
  };
}

/** Wheel pan. The camera is free to leave the board; it is not clamped to content. */
export function panCamera(camera: Camera, deltaX: number, deltaY: number, shiftKey: boolean): Camera {
  const pan = wheelPanDelta(deltaX, deltaY, shiftKey);
  return { x: camera.x - pan.x, y: camera.y - pan.y };
}

/** Drag pan. The board follows the pointer. */
export function dragCamera(camera: Camera, dx: number, dy: number): Camera {
  return { x: camera.x + dx, y: camera.y + dy };
}

/**
 * Keep the viewport point under the cursor fixed while zoom changes.
 * `originX` and `originY` are relative to the viewport.
 */
export function zoomCamera(
  camera: Camera,
  prevZoom: number,
  nextZoom: number,
  originX: number,
  originY: number,
): Camera {
  if (prevZoom <= 0 || prevZoom === nextZoom) return camera;
  const ratio = nextZoom / prevZoom;
  return {
    x: originX - (originX - camera.x) * ratio,
    y: originY - (originY - camera.y) * ratio,
  };
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

export interface OverlayBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Screen box of a selection outline, hover outline, or on-canvas badge.
 * `iframe` and `container` are viewport rects. The iframe rect already
 * includes the camera translate, so this must be recomputed on every camera
 * change. `element` is the layer rect inside the iframe (unscaled). Null
 * covers the whole frame, which is how the Body layer is drawn.
 */
export function layerOverlayBox(
  iframe: OverlayBox,
  container: { left: number; top: number },
  element: OverlayBox | null,
  scale: number,
): OverlayBox {
  if (!element) {
    return {
      left: iframe.left - container.left,
      top: iframe.top - container.top,
      width: iframe.width,
      height: iframe.height,
    };
  }
  const safe = scale > 0 && Number.isFinite(scale) ? scale : 1;
  return {
    left: iframe.left - container.left + element.left * safe,
    top: iframe.top - container.top + element.top * safe,
    width: element.width * safe,
    height: element.height * safe,
  };
}

/** Camera plus zoom remembered for one page. */
export interface SavedPageView {
  x: number;
  y: number;
  zoom: number;
}

export const PAGE_CAMERA_STORAGE_KEY = 'avi.canvasPageCameras';

function normalizeSavedPageView(value: unknown): SavedPageView | null {
  if (!value || typeof value !== 'object') return null;
  const view = value as Record<string, unknown>;
  const x = view.x;
  const y = view.y;
  const zoom = view.zoom;
  if (typeof x !== 'number' || typeof y !== 'number' || typeof zoom !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom) || zoom <= 0) return null;
  return { x, y, zoom };
}

export function parseSavedPageViews(raw: string | null): Record<string, SavedPageView> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const views: Record<string, SavedPageView> = {};
    for (const [pageId, value] of Object.entries(parsed as Record<string, unknown>)) {
      const view = normalizeSavedPageView(value);
      if (view) views[pageId] = view;
    }
    return views;
  } catch {
    return {};
  }
}

export function serializeSavedPageViews(views: Record<string, SavedPageView>): string {
  return JSON.stringify(views);
}

/**
 * Opening a page uses the fitted board unless that page already has a camera.
 * The fitted view is what Shift+1 produces.
 */
export function pageEnterView(saved: SavedPageView | null, fitted: SavedPageView): SavedPageView {
  return saved ?? fitted;
}

export interface PageViewStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createPageViewStore(storage: PageViewStorage) {
  return {
    read(pageId: string): SavedPageView | null {
      if (!pageId) return null;
      try {
        return parseSavedPageViews(storage.getItem(PAGE_CAMERA_STORAGE_KEY))[pageId] ?? null;
      } catch {
        return null;
      }
    },
    write(pageId: string, view: SavedPageView) {
      if (!pageId) return;
      const next = normalizeSavedPageView(view);
      if (!next) return;
      try {
        const views = parseSavedPageViews(storage.getItem(PAGE_CAMERA_STORAGE_KEY));
        views[pageId] = next;
        storage.setItem(PAGE_CAMERA_STORAGE_KEY, serializeSavedPageViews(views));
      } catch {
        // Private mode and blocked storage still keep the in-memory camera.
      }
    },
    remove(pageId: string) {
      if (!pageId) return;
      try {
        const views = parseSavedPageViews(storage.getItem(PAGE_CAMERA_STORAGE_KEY));
        if (!views[pageId]) return;
        delete views[pageId];
        storage.setItem(PAGE_CAMERA_STORAGE_KEY, serializeSavedPageViews(views));
      } catch {
        // Ignore blocked storage.
      }
    },
  };
}
