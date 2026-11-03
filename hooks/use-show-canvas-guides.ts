'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { syncCanvasSnapGuideVisibility } from '@/lib/canvas-freeform-dom';
import {
  readShowCanvasGuides,
  subscribeShowCanvasGuides,
  writeShowCanvasGuides,
} from '@/lib/canvas-guide-visibility';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

let shortcutInstalled = false;

function installCanvasGuideShortcut() {
  if (shortcutInstalled || typeof window === 'undefined') return;
  shortcutInstalled = true;
  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || !event.shiftKey) return;
    if (event.code !== 'KeyG') return;
    if (isTypingTarget(event.target)) return;
    event.preventDefault();
    writeShowCanvasGuides(!readShowCanvasGuides());
  });
}

/**
 * Show or hide canvas alignment lines. The choice is remembered in localStorage.
 * Shift+G toggles it, including when the canvas iframe forwards the key.
 */
export function useShowCanvasGuides() {
  const show = useSyncExternalStore(subscribeShowCanvasGuides, readShowCanvasGuides, () => true);

  const setShow = useCallback((value: boolean) => {
    writeShowCanvasGuides(value);
  }, []);

  const toggle = useCallback(() => {
    writeShowCanvasGuides(!readShowCanvasGuides());
  }, []);

  useEffect(() => {
    installCanvasGuideShortcut();
  }, []);

  useEffect(() => {
    syncCanvasSnapGuideVisibility();
  }, [show]);

  return { show, setShow, toggle };
}
