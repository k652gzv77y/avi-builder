import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { centerScrollOffset, fitBoardZoom, type CanvasBoardFit } from '@/lib/canvas-fit';
import { CANVAS_PADDING } from '@/lib/canvas-utils';

export type ZoomMode = 'custom' | 'fit' | 'autofit';

interface UseZoomOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentWidth: number; // iframe width in pixels
  contentHeight: number; // iframe height in pixels
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  /** When false, keyboard shortcuts and wheel zoom are disabled (e.g. preview mode active) */
  shortcutsEnabled?: boolean;
  /** Optional iframe ref — attaches wheel/gesture listeners to its contentDocument (separate browsing context) */
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  /** Scrollable canvas. Wheel zoom keeps the point under the cursor fixed. */
  scrollRef?: React.RefObject<HTMLElement | null>;
  /**
   * Breakpoint board. Shift+1 fits these frames in the scrollport, which is
   * the visible canvas with the side panels already excluded.
   */
  boardFit?: CanvasBoardFit | null;
  /** Called with the fitted zoom so the board camera can center. */
  onFit?: (zoom: number) => void;
  /** Cursor-anchored zoom. Origin is in viewport coordinates. */
  onAnchoredZoom?: (prev: number, next: number, origin: { x: number; y: number } | null) => void;
}

interface ZoomOrigin {
  x: number;
  y: number;
}

interface ZoomAnchor {
  x: number;
  y: number;
  prev: number;
  next: number;
}

function scrollZoomAnchor(element: HTMLElement, anchor: ZoomAnchor) {
  const rect = element.getBoundingClientRect();
  const localX = anchor.x - rect.left;
  const localY = anchor.y - rect.top;
  const ratio = anchor.next / anchor.prev;
  element.scrollLeft = (element.scrollLeft + localX) * ratio - localX;
  element.scrollTop = (element.scrollTop + localY) * ratio - localY;
}

function centerScroller(element: HTMLElement) {
  element.scrollLeft = centerScrollOffset(element.scrollWidth, element.clientWidth);
  element.scrollTop = centerScrollOffset(element.scrollHeight, element.clientHeight);
}

interface UseZoomResult {
  zoom: number;
  zoomMode: ZoomMode;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoomTo: (zoom: number) => void;
  resetZoom: () => void;
  zoomToFit: () => void;
  /** Fit the whole breakpoint board in the viewport. Shift+1. */
  zoomToBoard: () => void;
  autofit: () => void;
  handleZoomGesture: (delta: number, origin?: ZoomOrigin) => void;
  lockZoomMode: () => void; // Lock current zoom to custom mode
}

export function useZoom({
  containerRef,
  contentWidth,
  contentHeight,
  minZoom = 10,
  maxZoom = 200,
  zoomStep: _zoomStep = 10,
  shortcutsEnabled = true,
  iframeRef,
  scrollRef,
  boardFit,
  onFit,
  onAnchoredZoom,
}: UseZoomOptions): UseZoomResult {
  const [zoom, setZoom] = useState(100);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('autofit'); // Default to autofit
  const zoomAnchor = useRef<ZoomAnchor | null>(null);
  const [boardFitNonce, setBoardFitNonce] = useState(0);
  const onFitRef = useRef(onFit);
  const onAnchoredZoomRef = useRef(onAnchoredZoom);
  useEffect(() => {
    onFitRef.current = onFit;
    onAnchoredZoomRef.current = onAnchoredZoom;
  }, [onFit, onAnchoredZoom]);

  const rememberAnchor = useCallback((origin: ZoomOrigin | undefined, prev: number, next: number) => {
    const scroller = scrollRef?.current;
    if (prev === next || prev <= 0) return;
    if (onAnchoredZoomRef.current) {
      if (!origin || !scroller) {
        onAnchoredZoomRef.current(prev, next, null);
        return;
      }
      const rect = scroller.getBoundingClientRect();
      onAnchoredZoomRef.current(prev, next, { x: origin.x - rect.left, y: origin.y - rect.top });
    }
    if (!origin || !scroller) return;
    const rect = scroller.getBoundingClientRect();
    const inside = origin.x >= rect.left && origin.x <= rect.right && origin.y >= rect.top && origin.y <= rect.bottom;
    if (!inside) return;
    zoomAnchor.current = { x: origin.x, y: origin.y, prev, next };
  }, [scrollRef]);

  // Calculate zoom to fit height (prioritizes vertical fit, width follows)
  // Returns null if container is hidden (0 dimensions) to preserve current zoom
  const calculateZoomToFit = useCallback((): number | null => {
    if (!containerRef.current) return null;

    const containerHeight = containerRef.current.clientHeight;
    // Skip calculation when container is hidden (e.g. tab switch to CMS)
    if (containerHeight === 0) return null;

    // Calculate zoom based on height with padding
    const availableHeight = containerHeight - CANVAS_PADDING;
    const verticalZoom = (availableHeight / contentHeight) * 100;

    // Clamp between min and 100% (never zoom in more than 100%)
    return Math.min(Math.max(verticalZoom, minZoom), 100);
  }, [containerRef, contentHeight, minZoom]);

  // Calculate autofit (fits horizontally)
  // Returns null if container is hidden (0 dimensions) to preserve current zoom
  const calculateAutofit = useCallback((): number | null => {
    if (!containerRef.current) return null;

    const containerWidth = containerRef.current.clientWidth;
    // Skip calculation when container is hidden (e.g. tab switch to CMS)
    if (containerWidth === 0) return null;

    // Calculate zoom that fits content horizontally with padding
    const availableWidth = containerWidth - CANVAS_PADDING;
    const horizontalZoom = (availableWidth / contentWidth) * 100;

    // Clamp between min and 100% (never zoom in more than 100%)
    return Math.min(Math.max(horizontalZoom, minZoom), 100);
  }, [containerRef, contentWidth, minZoom]);

  // Framer doubles or halves the zoom on each keyboard step.
  const zoomIn = useCallback(() => {
    setZoom((current) => Math.min(current * 2, maxZoom));
    setZoomMode('custom');
  }, [maxZoom]);

  const zoomOut = useCallback(() => {
    setZoom((current) => Math.max(current / 2, minZoom));
    setZoomMode('custom');
  }, [minZoom]);

  // Set specific zoom
  const setZoomTo = useCallback((newZoom: number) => {
    setZoom(Math.min(Math.max(newZoom, minZoom), maxZoom));
    setZoomMode('custom');
  }, [minZoom, maxZoom]);

  // Reset to 100%
  const resetZoom = useCallback(() => {
    setZoom(100);
    setZoomMode('custom');
  }, []);

  // Zoom to fit (vertical)
  const zoomToFit = useCallback(() => {
    const newZoom = calculateZoomToFit();
    if (newZoom === null) return; // Container hidden, preserve current zoom
    setZoom(newZoom);
    setZoomMode('fit');
  }, [calculateZoomToFit]);

  // Fit every breakpoint frame in the visible canvas (Shift+1).
  const zoomToBoard = useCallback(() => {
    const viewport = scrollRef?.current ?? containerRef.current;
    if (boardFit && viewport && viewport.clientWidth > 0 && viewport.clientHeight > 0) {
      const next = fitBoardZoom(
        boardFit,
        viewport.clientWidth,
        viewport.clientHeight,
        minZoom,
        maxZoom,
      );
      setZoom(next);
      setZoomMode('custom');
      setBoardFitNonce((nonce) => nonce + 1);
      onFitRef.current?.(next);
      return;
    }
    const heightZoom = calculateZoomToFit();
    const widthZoom = calculateAutofit();
    if (heightZoom === null || widthZoom === null) return;
    setZoom(Math.min(heightZoom, widthZoom));
    setZoomMode('custom');
    setBoardFitNonce((nonce) => nonce + 1);
  }, [boardFit, calculateAutofit, calculateZoomToFit, containerRef, maxZoom, minZoom, scrollRef]);

  // Autofit (horizontal)
  const autofit = useCallback(() => {
    const newZoom = calculateAutofit();
    if (newZoom === null) return; // Container hidden, preserve current zoom
    setZoom(newZoom);
    setZoomMode('autofit');
  }, [calculateAutofit]);

  // Handle zoom gesture (from iframe or external source)
  const handleZoomGesture = useCallback((delta: number, origin?: ZoomOrigin) => {
    // Delta from iframe is already normalized: positive = zoom in, negative = zoom out
    const sensitivity = 0.5;
    const zoomDelta = delta * sensitivity;

    setZoom((current) => {
      const next = Math.min(Math.max(current + zoomDelta, minZoom), maxZoom);
      rememberAnchor(origin, current, next);
      return next;
    });
    setZoomMode('custom');
  }, [minZoom, maxZoom, rememberAnchor]);

  useLayoutEffect(() => {
    const pending = zoomAnchor.current;
    const scroller = scrollRef?.current;
    if (!pending || !scroller || pending.prev === pending.next) return;
    zoomAnchor.current = null;
    scrollZoomAnchor(scroller, pending);
  }, [zoom, scrollRef]);

  // Shift+1 centers the board after the zoomed layout has been measured.
  // The nonce changes even when the zoom value does not, so a second fit
  // still recenters a board the user has panned away from.
  useLayoutEffect(() => {
    if (boardFitNonce === 0) return;
    const scroller = scrollRef?.current;
    if (!scroller) return;
    centerScroller(scroller);
  }, [boardFitNonce, scrollRef]);

  // Lock current zoom to custom mode (prevents auto-recalculation)
  const lockZoomMode = useCallback(() => {
    setZoomMode('custom');
  }, []);

  // Recalculate zoom when mode is fit/autofit and container resizes or content dimensions change
  useEffect(() => {
    if (!containerRef.current || zoomMode === 'custom') return;

    const handleResize = () => {
      // Don't calculate if content dimensions aren't ready yet
      if (contentWidth === 0 || contentHeight === 0) return;

      if (zoomMode === 'fit') {
        const newZoom = calculateZoomToFit();
        if (newZoom !== null) setZoom(newZoom);
      } else if (zoomMode === 'autofit') {
        const newZoom = calculateAutofit();
        if (newZoom !== null) setZoom(newZoom);
      }
    };

    // Recalculate immediately when content dimensions change
    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, zoomMode, calculateZoomToFit, calculateAutofit, contentWidth, contentHeight]);

  // Keyboard shortcuts - capture at window level with high priority
  useEffect(() => {
    if (!shortcutsEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isTyping) return;

      // Shift+1 fits every breakpoint frame. Digit1 with Shift reports key "!".
      if (!e.metaKey && !e.ctrlKey && e.shiftKey && e.code === 'Digit1') {
        e.preventDefault();
        e.stopPropagation();
        zoomToBoard();
        return;
      }

      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (!isCmdOrCtrl) return;

      // Check for zoom shortcuts and prevent default browser behavior
      const isZoomShortcut =
        e.key === '+' ||
        e.key === '=' ||
        e.key === '-' ||
        e.key === '_' ||
        e.key === '0' ||
        e.key === '1' ||
        e.key === '2';

      if (!isZoomShortcut) return;

      // ALWAYS prevent default to stop browser zoom
      e.preventDefault();
      e.stopPropagation();

      switch (e.key) {
        case '+':
        case '=': // Handle both + and = keys
          zoomIn();
          break;
        case '-':
        case '_':
          zoomOut();
          break;
        case '0':
          resetZoom();
          break;
        case '1':
          zoomToFit();
          break;
        case '2':
          autofit();
          break;
      }
    };

    // Add listener with capture phase to intercept before other handlers
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [shortcutsEnabled, zoomIn, zoomOut, resetZoom, zoomToFit, zoomToBoard, autofit]);

  // Ctrl/Cmd + wheel to zoom (includes trackpad pinch) - GLOBAL, works everywhere
  // Also prevents native browser zoom COMPLETELY
  useEffect(() => {
    if (!shortcutsEnabled) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // ALWAYS prevent default browser zoom, everywhere
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Trackpad pinch sends much smaller deltaY values than mouse wheel
        // Scale the delta appropriately for smooth zooming
        const sensitivity = 0.5; // Adjust sensitivity for trackpad pinch
        const zoomDelta = -e.deltaY * sensitivity; // Negative because deltaY is inverted

        setZoom((current) => {
          const next = Math.min(Math.max(current + zoomDelta, minZoom), maxZoom);
          rememberAnchor({ x: e.clientX, y: e.clientY }, current, next);
          return next;
        });
        setZoomMode('custom');

        return false; // Extra prevention
      }
    };

    // Prevent native zoom via gesturestart/gesturechange (Safari/Mac specific)
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleGestureChange = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Attach to document for maximum coverage - works everywhere
    document.addEventListener('wheel', handleWheel, { passive: false, capture: true });

    // Safari gesture events
    document.addEventListener('gesturestart', handleGestureStart, { passive: false, capture: true });
    document.addEventListener('gesturechange', handleGestureChange, { passive: false, capture: true });

    return () => {
      document.removeEventListener('wheel', handleWheel, { capture: true } as EventListenerOptions);
      document.removeEventListener('gesturestart', handleGestureStart, { capture: true } as EventListenerOptions);
      document.removeEventListener('gesturechange', handleGestureChange, { capture: true } as EventListenerOptions);
    };
  }, [shortcutsEnabled, minZoom, maxZoom, rememberAnchor]);

  // Mirror wheel/gesture listeners onto the iframe's contentDocument since
  // events inside an iframe don't bubble to the parent document.
  useEffect(() => {
    if (!shortcutsEnabled || !iframeRef?.current) return;

    const iframe = iframeRef.current;
    let iframeDoc: Document | null = null;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const zoomDelta = -e.deltaY * 0.5;
        setZoom((current) => {
          const next = Math.min(Math.max(current + zoomDelta, minZoom), maxZoom);
          rememberAnchor({ x: e.clientX, y: e.clientY }, current, next);
          return next;
        });
        setZoomMode('custom');
      }
    };

    const preventGesture = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const attach = () => {
      try {
        iframeDoc = iframe.contentDocument;
        if (!iframeDoc) return;
        iframeDoc.addEventListener('wheel', handleWheel, { passive: false, capture: true });
        iframeDoc.addEventListener('gesturestart', preventGesture, { passive: false, capture: true });
        iframeDoc.addEventListener('gesturechange', preventGesture, { passive: false, capture: true });
      } catch {
        // Cross-origin iframe
      }
    };

    const detach = () => {
      if (!iframeDoc) return;
      try {
        iframeDoc.removeEventListener('wheel', handleWheel, { capture: true } as EventListenerOptions);
        iframeDoc.removeEventListener('gesturestart', preventGesture, { capture: true } as EventListenerOptions);
        iframeDoc.removeEventListener('gesturechange', preventGesture, { capture: true } as EventListenerOptions);
      } catch {
        // Ignore
      }
      iframeDoc = null;
    };

    iframe.addEventListener('load', attach);
    if (iframe.contentDocument?.readyState === 'complete') attach();

    return () => {
      detach();
      iframe.removeEventListener('load', attach);
    };
  }, [shortcutsEnabled, iframeRef, minZoom, maxZoom, rememberAnchor]);

  return {
    zoom,
    zoomMode,
    zoomIn,
    zoomOut,
    setZoomTo,
    resetZoom,
    zoomToFit,
    zoomToBoard,
    autofit,
    handleZoomGesture,
    lockZoomMode,
  };
}
