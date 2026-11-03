/**
 * Show or hide the temporary alignment lines on the canvas.
 * The inspector still lists the active snap when the lines are hidden.
 */

const STORAGE_KEY = 'avi.showCanvasGuides';
const listeners = new Set<() => void>();
let cached: boolean | null = null;

export function readShowCanvasGuides(): boolean {
  if (typeof window === 'undefined') return true;
  if (cached !== null) return cached;
  try {
    cached = window.localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    cached = true;
  }
  return cached;
}

export function writeShowCanvasGuides(show: boolean) {
  cached = show;
  try {
    window.localStorage.setItem(STORAGE_KEY, show ? '1' : '0');
  } catch {
    // Private mode and blocked storage still update listeners below.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeShowCanvasGuides(listener: () => void) {
  listeners.add(listener);
  if (typeof window === 'undefined') {
    return () => {
      listeners.delete(listener);
    };
  }
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cached = event.newValue !== '0';
    listener();
  };
  window.addEventListener('storage', handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}
