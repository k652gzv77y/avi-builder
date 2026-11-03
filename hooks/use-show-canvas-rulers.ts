'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'avi.showCanvasRulers';
const listeners = new Set<() => void>();

function readStoredShowRulers(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeStoredShowRulers(show: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, show ? '1' : '0');
  } catch {
    // Private mode and blocked storage still update listeners below.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}

function getServerSnapshot() {
  return true;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Show or hide canvas rulers. The choice is remembered in localStorage.
 * Shift+R toggles it, including when the canvas iframe forwards the key.
 */
export function useShowCanvasRulers() {
  const show = useSyncExternalStore(subscribe, readStoredShowRulers, getServerSnapshot);

  const setShow = useCallback((value: boolean) => {
    writeStoredShowRulers(value);
  }, []);

  const toggle = useCallback(() => {
    writeStoredShowRulers(!readStoredShowRulers());
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || !event.shiftKey) return;
      if (event.code !== 'KeyR') return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      toggle();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return { show, setShow, toggle };
}
