'use client';

/**
 * SelectionOverlay Component
 *
 * Renders selection, hover, and parent outlines on top of the canvas iframe.
 * Uses direct DOM manipulation for instant updates during scrolling.
 *
 * Note: Drag initiation for sibling reordering and free-form moves is handled
 * by useCanvasSiblingReorder, which listens to iframe mousedown events.
 * Resize handles on this overlay commit absolute/fixed box edits.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { findLayerById, findLayerWithParent } from '@/lib/layer-utils';
import { stableList } from '@/lib/stable-list';
import { getLayerName } from '@/lib/layer-display-utils';
import { readLayerPosition } from '@/lib/layout-model';
import {
  applyFreeformBox,
  isFreeformDraggable,
  resizedBox,
  type ResizeHandle,
} from '@/lib/canvas-freeform';
import {
  cancelFreeformPreview,
  previewFreeformBox,
  readFreeformBox,
  scheduleFreeformRelease,
} from '@/lib/canvas-freeform-dom';
import type { Layer } from '@/types';

interface HandleFrame {
  left: number;
  top: number;
  width: number;
  height: number;
  visible: boolean;
}

const HIDDEN_HANDLE_FRAME: HandleFrame = { left: 0, top: 0, width: 0, height: 0, visible: false };

const RESIZE_HANDLES: { id: ResizeHandle; x: number; y: number; cursor: string; label: string }[] = [
  { id: 'nw', x: 0, y: 0, cursor: 'nwse-resize', label: 'top left' },
  { id: 'n', x: 0.5, y: 0, cursor: 'ns-resize', label: 'top' },
  { id: 'ne', x: 1, y: 0, cursor: 'nesw-resize', label: 'top right' },
  { id: 'e', x: 1, y: 0.5, cursor: 'ew-resize', label: 'right' },
  { id: 'se', x: 1, y: 1, cursor: 'nwse-resize', label: 'bottom right' },
  { id: 's', x: 0.5, y: 1, cursor: 'ns-resize', label: 'bottom' },
  { id: 'sw', x: 0, y: 1, cursor: 'nesw-resize', label: 'bottom left' },
  { id: 'w', x: 0, y: 0.5, cursor: 'ew-resize', label: 'left' },
];

function currentEditorLayers(): Layer[] {
  const editor = useEditorStore.getState();
  if (editor.editingComponentId && editor.editingComponentVariantId) {
    return stableList(
      useComponentsStore.getState().componentDrafts[editor.editingComponentId]?.[editor.editingComponentVariantId],
    );
  }
  if (editor.currentPageId) {
    return stableList(usePagesStore.getState().draftsByPageId[editor.currentPageId]?.layers);
  }
  return stableList<Layer>(undefined);
}

function editableLayer(layerId: string | null) {
  if (!layerId) return null;
  return findLayerWithParent(currentEditorLayers(), layerId);
}

function outlineRect(container: HTMLDivElement | null): HandleFrame | null {
  const first = container?.firstElementChild as HTMLElement | null;
  if (!container || container.style.display === 'none' || !first || first.style.display === 'none') return null;
  const left = Math.round(parseFloat(first.style.left));
  const top = Math.round(parseFloat(first.style.top));
  const width = Math.round(parseFloat(first.style.width));
  const height = Math.round(parseFloat(first.style.height));
  if (![left, top, width, height].every(Number.isFinite) || width < 1 || height < 1) return null;
  return { left, top, width, height, visible: true };
}
function selectionLayerLabel(layerId: string | null): string {
  if (!layerId) return '';
  if (layerId === 'body') return 'Body';

  const layer = findLayerById(currentEditorLayers(), layerId);
  return layer ? getLayerName(layer) : '';
}

function placeSelectionLabel(container: HTMLDivElement | null, label: HTMLDivElement | null, text: string) {
  if (!label) return;
  const first = container?.firstElementChild as HTMLElement | null;
  if (!text || !container || container.style.display === 'none' || !first || first.style.display === 'none') {
    label.style.display = 'none';
    return;
  }
  label.textContent = text;
  label.style.display = 'block';
  label.style.left = first.style.left;
  label.style.top = `calc(${first.style.top} - 16px)`;
}

interface SelectionOverlayProps {
  /** Reference to the canvas iframe element */
  iframeElement: HTMLIFrameElement | null;
  /** Reference to the container element for positioning */
  containerElement: HTMLElement | null;
  /** Currently selected layer ID */
  selectedLayerId: string | null;
  /** Parent layer ID (one level up from selected) */
  parentLayerId: string | null;
  /** Current zoom level (percentage) */
  zoom: number;
  /** Active sublayer index within a richText element (null = highlight whole layer) */
  activeSublayerIndex?: number | null;
  /** Active list item index within a list (null = highlight whole list block) */
  activeListItemIndex?: number | null;
  /** Persist a resize. Stack children do not show handles. */
  onLayerUpdate?: (layerId: string, updates: Partial<Layer>) => void;
}

export function SelectionOverlay({
  iframeElement,
  containerElement,
  selectedLayerId,
  parentLayerId,
  zoom,
  activeSublayerIndex,
  activeListItemIndex,
  onLayerUpdate,
}: SelectionOverlayProps) {
  const hoveredLayerIdRef = useRef(useEditorStore.getState().hoveredLayerId);
  const activeUIState = useEditorStore((state) => state.activeUIState);
  const isStateActive = activeUIState !== 'neutral';
  // While the AI composer is in "reference a layer" mode, outlines turn teal to
  // signal the click will attach the layer to the chat rather than just select it.
  const isAiLayerPicking = useEditorStore((state) => state.isAiLayerPicking);

  // Pick-mode uses a brighter, slightly thicker teal so the outline keeps
  // contrast over both light and dark page content (the muted badge teal washes
  // out on dark backgrounds). A faint dark ring (box-shadow) is added for extra
  // separation on light backgrounds.
  const SELECTED_OUTLINE_CLASS = isAiLayerPicking
    ? 'outline outline-1 outline-[#22c1de] shadow-[0_0_0_1px_rgba(0,0,0,0.25)]'
    : isStateActive
      ? 'outline outline-1 outline-[#8dd92f]'
      : 'outline outline-2 outline-[#0099ff]';
  const HOVERED_OUTLINE_CLASS = isAiLayerPicking
    ? 'outline outline-1 outline-[#22c1de] shadow-[0_0_0_1px_rgba(0,0,0,0.25)]'
    : isStateActive
      ? 'outline outline-1 outline-[#8dd92f]/50'
      : 'outline outline-1 outline-[#0099ff]/45';
  const PARENT_OUTLINE_CLASS = isAiLayerPicking
    ? 'outline outline-1 outline-dashed outline-[#22c1de]'
    : isStateActive
      ? 'outline outline-1 outline-dashed outline-[#8dd92f]'
      : 'outline outline-1 outline-dashed outline-[#0099ff]/70';
  // Container refs for outline groups (supports multiple instances per layer ID)
  const selectedContainerRef = useRef<HTMLDivElement>(null);
  const hoveredContainerRef = useRef<HTMLDivElement>(null);
  const parentContainerRef = useRef<HTMLDivElement>(null);
  const selectionLabelRef = useRef<HTMLDivElement>(null);
  const [handleFrame, setHandleFrame] = useState<HandleFrame>(HIDDEN_HANDLE_FRAME);
  const handleFrameRef = useRef(handleFrame);
  const onLayerUpdateRef = useRef(onLayerUpdate);
  onLayerUpdateRef.current = onLayerUpdate;
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  const publishHandleFrame = useCallback((next: HandleFrame | null) => {
    const frame = next && next.width > 0 && next.height > 0 ? next : HIDDEN_HANDLE_FRAME;
    const prev = handleFrameRef.current;
    if (
      prev.visible === frame.visible
      && prev.left === frame.left
      && prev.top === frame.top
      && prev.width === frame.width
      && prev.height === frame.height
    ) return;
    handleFrameRef.current = frame;
    setHandleFrame(frame);
  }, []);

  // Track drag/animation/resize state for scroll/mutation handlers
  const isDraggingRef = useRef(false);
  const isSliderAnimatingRef = useRef(false);
  const isSidebarResizingRef = useRef(false);

  const hideAllOutlines = useCallback(() => {
    if (selectedContainerRef.current) selectedContainerRef.current.style.display = 'none';
    if (hoveredContainerRef.current) hoveredContainerRef.current.style.display = 'none';
    if (parentContainerRef.current) parentContainerRef.current.style.display = 'none';
    if (selectionLabelRef.current) selectionLabelRef.current.style.display = 'none';
    publishHandleFrame(null);
  }, [publishHandleFrame]);

  // Update outline(s) for all elements matching a layer ID
  const updateOutline = useCallback((
    container: HTMLDivElement | null,
    layerId: string | null,
    iframeDoc: Document,
    iframeElement: HTMLIFrameElement,
    containerElement: HTMLElement,
    scale: number,
    outlineClass: string,
    blockIndex?: number | null,
    listItemIndex?: number | null,
  ) => {
    if (!container) return;

    if (!layerId) {
      container.style.display = 'none';
      return;
    }

    const isBody = layerId === 'body';
    let targetElements: Element[];
    if (isBody) {
      // The Body layer's wrapper (#canvas-body) uses display:contents and has
      // no box. Its visible representation on the canvas is the entire iframe
      // surface. We render a single outline using the iframe element's rect
      // below, but we still need a non-empty list to drive the loop.
      targetElements = [iframeElement];
    } else if (blockIndex !== undefined && blockIndex !== null && listItemIndex !== undefined && listItemIndex !== null) {
      targetElements = Array.from(iframeDoc.querySelectorAll(
        `[data-layer-id="${layerId}"] [data-block-index="${blockIndex}"] [data-list-item-index="${listItemIndex}"]`
      ));
    } else if (blockIndex !== undefined && blockIndex !== null) {
      targetElements = Array.from(iframeDoc.querySelectorAll(`[data-layer-id="${layerId}"] [data-block-index="${blockIndex}"]`));
    } else {
      targetElements = Array.from(iframeDoc.querySelectorAll(`[data-layer-id="${layerId}"]`));
    }
    if (targetElements.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';

    const iframeRect = iframeElement.getBoundingClientRect();
    const containerRect = containerElement.getBoundingClientRect();

    // The canvas is scaled with `transform: scale()` on a wrapper, so inner
    // element rects (measured via getBoundingClientRect inside the iframe) are
    // reported in the iframe's own unscaled layout coordinates in every browser.
    // Multiplying by the scale factor (`scale` = zoom/100) maps them to on-screen
    // pixels. NOTE: do NOT derive the multiplier from iframeRect.width /
    // innerRootWidth — the iframe element width (canvas width) and the content
    // layout width can differ, which over-scaled outlines on Safari.

    // Ensure we have the right number of child outline divs
    while (container.children.length < targetElements.length) {
      const div = document.createElement('div');
      div.className = `absolute ${outlineClass}`;
      container.appendChild(div);
    }
    // Hide excess children
    for (let i = targetElements.length; i < container.children.length; i++) {
      (container.children[i] as HTMLElement).style.display = 'none';
    }

    targetElements.forEach((targetElement, idx) => {
      const child = container.children[idx] as HTMLElement;

      let top: number;
      let left: number;
      let width: number;
      let height: number;
      if (isBody) {
        // Body outline always covers the full visible canvas (iframe area).
        top = iframeRect.top - containerRect.top;
        left = iframeRect.left - containerRect.left;
        width = iframeRect.width;
        height = iframeRect.height;
      } else {
        const elementRect = targetElement.getBoundingClientRect();
        top = iframeRect.top - containerRect.top + (elementRect.top * scale);
        left = iframeRect.left - containerRect.left + (elementRect.left * scale);
        width = elementRect.width * scale;
        height = elementRect.height * scale;
      }

      child.className = `absolute ${outlineClass}`;
      child.style.display = 'block';
      child.style.top = `${top}px`;
      child.style.left = `${left}px`;
      child.style.width = `${width}px`;
      child.style.height = `${height}px`;
    });
  }, []);

  /** Resolve iframe state needed to position an outline. Returns null when
   * outlines must be hidden (during slider animation, sidebar resize, or when
   * the iframe isn't ready). */
  const getOutlineContext = useCallback(() => {
    if (isSliderAnimatingRef.current || isSidebarResizingRef.current) return null;
    if (!iframeElement || !containerElement) return null;
    const iframeDoc = iframeElement.contentDocument;
    if (!iframeDoc) return null;
    return { iframeDoc, iframeElement, containerElement, scale: zoom / 100 };
  }, [iframeElement, containerElement, zoom]);

  // Update just the hovered outline. Used on every hover store change so the
  // outline tracks the cursor at the full RAF rate without the ~3× DOM work
  // of refreshing selected/parent outlines that haven't moved.
  const updateHoveredOutline = useCallback(() => {
    const ctx = getOutlineContext();
    if (!ctx) {
      hideAllOutlines();
      return;
    }
    const hovered = hoveredLayerIdRef.current;
    // In pick mode the selection outline is hidden, so highlight whatever is
    // hovered — even the already-selected layer — for a focused picking cursor.
    const effectiveHoveredId = isAiLayerPicking
      ? hovered
      : hovered !== selectedLayerId ? hovered : null;
    updateOutline(hoveredContainerRef.current, effectiveHoveredId, ctx.iframeDoc, ctx.iframeElement, ctx.containerElement, ctx.scale, HOVERED_OUTLINE_CLASS);
  }, [getOutlineContext, hideAllOutlines, selectedLayerId, updateOutline, HOVERED_OUTLINE_CLASS, isAiLayerPicking]);

  // Update all outlines. Called whenever selection/parent change, on scroll,
  // viewport switches, drag start/end, and on iframe layout shifts (image
  // loads, font swaps, etc.) detected by the ResizeObserver below.
  const updateAllOutlines = useCallback((skipSolidBorders = false) => {
    const ctx = getOutlineContext();
    if (!ctx) {
      hideAllOutlines();
      return;
    }

    // Pick mode: strip selection/parent outlines for a focused picking UX and
    // show only the layer currently under the cursor.
    if (isAiLayerPicking) {
      if (selectedContainerRef.current) selectedContainerRef.current.style.display = 'none';
      if (parentContainerRef.current) parentContainerRef.current.style.display = 'none';
      if (selectionLabelRef.current) selectionLabelRef.current.style.display = 'none';
      publishHandleFrame(null);
      updateOutline(hoveredContainerRef.current, hoveredLayerIdRef.current, ctx.iframeDoc, ctx.iframeElement, ctx.containerElement, ctx.scale, HOVERED_OUTLINE_CLASS);
      return;
    }

    // Update selected outline (skip during drag)
    if (!skipSolidBorders) {
      updateOutline(selectedContainerRef.current, selectedLayerId, ctx.iframeDoc, ctx.iframeElement, ctx.containerElement, ctx.scale, SELECTED_OUTLINE_CLASS, activeSublayerIndex, activeListItemIndex);
      placeSelectionLabel(selectedContainerRef.current, selectionLabelRef.current, selectionLayerLabel(selectedLayerId));

      const hovered = hoveredLayerIdRef.current;
      const effectiveHoveredId = hovered !== selectedLayerId ? hovered : null;
      updateOutline(hoveredContainerRef.current, effectiveHoveredId, ctx.iframeDoc, ctx.iframeElement, ctx.containerElement, ctx.scale, HOVERED_OUTLINE_CLASS);
    } else if (selectionLabelRef.current) {
      selectionLabelRef.current.style.display = 'none';
    }

    // When a sublayer is active, show the parent richText layer with parent outline
    const effectiveParentId = activeSublayerIndex !== null && activeSublayerIndex !== undefined
      ? selectedLayerId
      : (parentLayerId !== selectedLayerId ? parentLayerId : null);
    updateOutline(parentContainerRef.current, effectiveParentId, ctx.iframeDoc, ctx.iframeElement, ctx.containerElement, ctx.scale, PARENT_OUTLINE_CLASS);

    const found = !skipSolidBorders && onLayerUpdateRef.current && !isDraggingRef.current
      ? editableLayer(selectedLayerId)
      : null;
    if (
      found
      && isFreeformDraggable(found.layer, found.parent)
      && (activeSublayerIndex === null || activeSublayerIndex === undefined)
    ) {
      publishHandleFrame(outlineRect(selectedContainerRef.current));
    } else {
      publishHandleFrame(null);
    }
  }, [getOutlineContext, hideAllOutlines, selectedLayerId, parentLayerId, updateOutline, activeSublayerIndex, activeListItemIndex, SELECTED_OUTLINE_CLASS, HOVERED_OUTLINE_CLASS, PARENT_OUTLINE_CLASS, isAiLayerPicking, publishHandleFrame]);

  // Initial update and updates when IDs change. Selecting a layer can reveal a
  // previously hidden ancestor (display:none → visible) in the iframe's separate
  // React root, which commits a frame or two after this effect runs — so the
  // first measurement would land on the element's stale (hidden) rect. Re-run on
  // the next frame and once more shortly after so the outline tracks the revealed
  // element.
  useEffect(() => {
    updateAllOutlines();
    const rafId = requestAnimationFrame(() => updateAllOutlines());
    const timeoutId = setTimeout(() => updateAllOutlines(), 120);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [updateAllOutlines]);

  // Subscribe to hoveredLayerId changes without re-rendering. Uses a
  // leading + trailing throttle around `updateHoveredOutline` (the cheap
  // single-outline path): the first hover after an idle period runs
  // synchronously so the outline lands in the same frame as the mouse event,
  // and rapid cursor sweeps coalesce into one trailing update per RAF.
  // Selected/parent outlines stay accurate because the ResizeObserver below
  // catches layout shifts (image loads etc.) and triggers `updateAllOutlines`.
  useEffect(() => {
    let rafId: number | null = null;
    let lastDrawnId: string | null = hoveredLayerIdRef.current;
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (state.hoveredLayerId === hoveredLayerIdRef.current) return;
      hoveredLayerIdRef.current = state.hoveredLayerId;

      if (rafId !== null) return;

      lastDrawnId = state.hoveredLayerId;
      updateHoveredOutline();

      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (hoveredLayerIdRef.current !== lastDrawnId) {
          lastDrawnId = hoveredLayerIdRef.current;
          updateHoveredOutline();
        }
      });
    });
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      unsubscribe();
    };
  }, [updateHoveredOutline]);

  // Set up scroll/resize/mutation listeners
  useEffect(() => {
    if (!iframeElement || !containerElement) return;

    const iframeDoc = iframeElement.contentDocument;
    if (!iframeDoc) return;

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    // Hide outlines during scroll, show after scroll ends
    const handleScroll = () => {
      hideAllOutlines();

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Show outlines after scrolling stops (150ms delay)
      scrollTimeout = setTimeout(() => {
        // Skip solid borders if dragging
        updateAllOutlines(isDraggingRef.current);
      }, 150);
    };

    // MutationObserver for DOM changes inside iframe
    let mutationTimeout: ReturnType<typeof setTimeout> | null = null;
    let mutationRafId: number | null = null;
    const mutationObserver = new MutationObserver((mutations) => {
      const hasStructuralChange = mutations.some(m => m.type === 'childList');

      // Cancel any pending updates to avoid double-firing
      if (mutationTimeout) clearTimeout(mutationTimeout);
      if (mutationRafId) {
        cancelAnimationFrame(mutationRafId);
        mutationRafId = null;
      }

      if (hasStructuralChange) {
        // Structural DOM changes: defer update to let DOM settle
        // Don't hide outlines first — avoids blinking on re-selection
        mutationTimeout = setTimeout(() => {
          updateAllOutlines(isDraggingRef.current);
        }, 50);
      } else {
        // Attribute-only changes (class/style) - defer to next frame so
        // Tailwind Browser CDN has time to generate CSS for new classes
        // and the browser can reflow before we measure dimensions
        mutationRafId = requestAnimationFrame(() => {
          mutationRafId = requestAnimationFrame(() => {
            updateAllOutlines(isDraggingRef.current);
            mutationRafId = null;
          });
        });
      }
    });

    // Observe the iframe body for changes
    if (iframeDoc.body) {
      mutationObserver.observe(iframeDoc.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
    }

    // ResizeObserver catches async layout shifts that MutationObserver misses
    // (image loads, font swaps, transitions). Coalesced into a RAF so a burst
    // of images loading at once only triggers one full outline refresh.
    let resizeRafId: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeRafId !== null) return;
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        updateAllOutlines(isDraggingRef.current);
      });
    });
    if (iframeDoc.body) {
      resizeObserver.observe(iframeDoc.body);
    }
    // Also observe the iframe element itself. In component-edit mode the canvas
    // is vertically centered and its height tracks content, so revealing/hiding
    // a block resizes and re-centers the iframe — shifting every element's
    // on-screen position. Observing the element catches that move so outlines
    // re-measure to the new position (not just the body's internal size).
    resizeObserver.observe(iframeElement);

    // Hide outlines during viewport switch, show after transition settles
    let viewportTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleViewportChange = () => {
      hideAllOutlines();

      if (viewportTimeout) clearTimeout(viewportTimeout);

      // Show outlines after viewport transition settles
      viewportTimeout = setTimeout(() => {
        updateAllOutlines(isDraggingRef.current);
      }, 150);
    };

    // Add event listeners
    containerElement.addEventListener('scroll', handleScroll, { passive: true });
    iframeDoc.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    window.addEventListener('viewportChange', handleViewportChange);

    // Cleanup
    return () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      if (viewportTimeout) clearTimeout(viewportTimeout);
      if (mutationTimeout) clearTimeout(mutationTimeout);
      if (mutationRafId) cancelAnimationFrame(mutationRafId);
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      containerElement.removeEventListener('scroll', handleScroll);
      iframeDoc.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('viewportChange', handleViewportChange);
    };
  }, [iframeElement, containerElement, updateAllOutlines, hideAllOutlines]);

  // Check if layer dragging is active (to hide selection during drag)
  const isDraggingLayerOnCanvas = useEditorStore((state) => state.isDraggingLayerOnCanvas);

  // Hide solid selection/hover outlines during drag, but keep dashed parent outline
  useEffect(() => {
    isDraggingRef.current = isDraggingLayerOnCanvas;

    if (isDraggingLayerOnCanvas) {
      hideAllOutlines();
      updateAllOutlines(true); // skipSolidBorders = true, re-shows parent outline
    } else {
      // Re-show all outlines when drag ends
      updateAllOutlines(false);
    }
  }, [isDraggingLayerOnCanvas, updateAllOutlines, hideAllOutlines]);

  // Hide outlines during slider transitions
  const isSliderAnimating = useEditorStore((state) => state.isSliderAnimating);
  const isCanvasContextMenuOpen = useEditorStore((state) => state.isCanvasContextMenuOpen);

  useEffect(() => {
    isSliderAnimatingRef.current = isSliderAnimating;
    if (isSliderAnimating) {
      hideAllOutlines();
    } else {
      updateAllOutlines();
    }
  }, [isSliderAnimating, updateAllOutlines, hideAllOutlines]);

  // Hide outlines during sidebar resize
  const isSidebarResizing = useEditorStore((state) => state.isSidebarResizing);

  useEffect(() => {
    isSidebarResizingRef.current = isSidebarResizing;
    if (isSidebarResizing) {
      hideAllOutlines();
    } else {
      updateAllOutlines();
    }
  }, [isSidebarResizing, hideAllOutlines, updateAllOutlines]);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  const handleColor = isStateActive ? '#8dd92f' : '#0099ff';

  const handleResizePointerDown = (event: React.PointerEvent<HTMLButtonElement>, handle: ResizeHandle) => {
    if (event.button !== 0 || !iframeElement || !onLayerUpdate || !selectedLayerId) return;
    const found = editableLayer(selectedLayerId);
    if (!found || !isFreeformDraggable(found.layer, found.parent)) return;
    const doc = iframeElement.contentDocument;
    if (!doc) return;
    const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(selectedLayerId) : selectedLayerId;
    const nodes = Array.from(doc.querySelectorAll(`[data-layer-id="${escaped}"]`)) as HTMLElement[];
    const target = nodes[0];
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();

    const box = readFreeformBox(target);
    // Match the selection outline: iframe layout pixels are unscaled, and the
    // editor zoom (not the measured iframe ratio) maps them to the screen.
    const scale = (zoom || 100) / 100 || 1;
    const startX = event.clientX;
    const startY = event.clientY;
    const position = readLayerPosition(found.layer) === 'fixed' ? 'fixed' : 'absolute';
    nodes.forEach((node) => {
      node.dataset.freeformGesture = '1';
    });

    const applyDelta = (clientX: number, clientY: number) => {
      const dx = (clientX - startX) / scale;
      const dy = (clientY - startY) / scale;
      const next = resizedBox(box, handle, dx, dy);
      nodes.forEach((node) => previewFreeformBox(node, next, position));
      return { dx, dy, next };
    };

    const detach = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('keydown', onKey);
      resizeCleanupRef.current = null;
    };
    const move = (pointerEvent: PointerEvent) => {
      applyDelta(pointerEvent.clientX, pointerEvent.clientY);
    };
    const end = (pointerEvent: PointerEvent) => {
      detach();
      const { dx, dy, next } = applyDelta(pointerEvent.clientX, pointerEvent.clientY);
      if (Math.round(dx) === 0 && Math.round(dy) === 0) {
        nodes.forEach((node) => cancelFreeformPreview(node));
        return;
      }
      onLayerUpdate(found.layer.id, applyFreeformBox(found.layer, next, 'resize'));
      nodes.forEach((node) => scheduleFreeformRelease(node));
    };
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== 'Escape') return;
      keyEvent.preventDefault();
      detach();
      nodes.forEach((node) => cancelFreeformPreview(node));
    };

    resizeCleanupRef.current = () => {
      detach();
      nodes.forEach((node) => cancelFreeformPreview(node));
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('keydown', onKey);
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-40"
      style={isCanvasContextMenuOpen ? { display: 'none' } : undefined}
    >
      {/* Parent outline container (dashed) - visible during drag */}
      <div ref={parentContainerRef} style={{ display: 'none' }} />

      {/* Hover outline container - hidden during drag */}
      <div ref={hoveredContainerRef} style={{ display: 'none' }} />

      {/* Selection outline container - hidden during drag */}
      <div ref={selectedContainerRef} style={{ display: 'none' }} />

      <div
        ref={selectionLabelRef}
        className="absolute rounded-sm bg-[#0099ff] px-1 py-px text-[10px] font-medium leading-none text-white"
        style={{ display: 'none' }}
      />

      {handleFrame.visible && (
        <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
          {RESIZE_HANDLES.map((handle) => (
            <button
              key={handle.id}
              type="button"
              aria-label={`Resize from the ${handle.label}`}
              data-resize-handle={handle.id}
              className="absolute size-2 rounded-[1px] border bg-white p-0"
              style={{
                left: handleFrame.left + handleFrame.width * handle.x,
                top: handleFrame.top + handleFrame.height * handle.y,
                marginLeft: -4,
                marginTop: -4,
                cursor: handle.cursor,
                pointerEvents: 'auto',
                borderColor: handleColor,
                boxSizing: 'border-box',
              }}
              onPointerDown={(event) => handleResizePointerDown(event, handle.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(SelectionOverlay);
