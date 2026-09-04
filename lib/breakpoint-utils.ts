import type { Breakpoint } from '@/types';

export interface BreakpointConfig {
  value: Breakpoint;
  label: string;
  prefix: string;
  maxWidth: number | null;
}

/**
 * All available breakpoints with labels and Tailwind config (Desktop-First)
 * Desktop is base (no prefix), tablet and mobile use max-width overrides
 */
export const BREAKPOINTS: BreakpointConfig[] = [
  { value: 'mobile', label: 'Mobile', prefix: 'max-md:', maxWidth: 767 },
  { value: 'tablet', label: 'Tablet', prefix: 'max-lg:', maxWidth: 1023 },
  { value: 'desktop', label: 'Desktop', prefix: '', maxWidth: null },
];

/** All available breakpoint values in order (for backward compatibility) */
export const BREAKPOINT_VALUES: Breakpoint[] = BREAKPOINTS.map(bp => bp.value);

/** Settings key for freeform canvas breakpoint frames (builder-only). */
export const CANVAS_BREAKPOINT_FRAMES_SETTING = 'canvas_breakpoint_frames';

export interface CanvasBreakpointFrame {
  id: string;
  label: string;
  width: number;
  /** Built-in frames cannot be deleted. */
  locked?: boolean;
}

export const DEFAULT_CANVAS_BREAKPOINT_FRAMES: CanvasBreakpointFrame[] = [
  { id: 'desktop', label: 'Desktop', width: 1200, locked: true },
  { id: 'tablet', label: 'Tablet', width: 810, locked: true },
  { id: 'mobile', label: 'Phone', width: 390, locked: true },
];

const MIN_FRAME_WIDTH = 320;
const MAX_FRAME_WIDTH = 1920;

/**
 * Map a canvas frame width to the CSS breakpoint used for design overrides.
 */
export function widthToBreakpoint(width: number): Breakpoint {
  if (width <= 767) return 'mobile';
  if (width <= 1023) return 'tablet';
  return 'desktop';
}

export function clampFrameWidth(width: number): number {
  return Math.round(Math.min(MAX_FRAME_WIDTH, Math.max(MIN_FRAME_WIDTH, width)));
}

export function normalizeCanvasBreakpointFrames(
  value: unknown,
): CanvasBreakpointFrame[] {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_CANVAS_BREAKPOINT_FRAMES.map((frame) => ({ ...frame }));
  }

  const frames: CanvasBreakpointFrame[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Record<string, unknown>;
    const id = typeof raw.id === 'string' ? raw.id : '';
    const label = typeof raw.label === 'string' ? raw.label : '';
    const width = typeof raw.width === 'number' ? raw.width : Number(raw.width);
    if (!id || !label || !Number.isFinite(width)) continue;
    frames.push({
      id,
      label,
      width: clampFrameWidth(width),
      locked: Boolean(raw.locked) || DEFAULT_CANVAS_BREAKPOINT_FRAMES.some((d) => d.id === id),
    });
  }

  return frames.length > 0
    ? frames
    : DEFAULT_CANVAS_BREAKPOINT_FRAMES.map((frame) => ({ ...frame }));
}

/**
 * Convert breakpoint to Tailwind prefix (Desktop-First)
 * desktop → '' (base), tablet → 'max-lg:', mobile → 'max-md:'
 */
export function getBreakpointPrefix(breakpoint: Breakpoint): string {
  const config = BREAKPOINTS.find(bp => bp.value === breakpoint);
  return config?.prefix ?? '';
}

/**
 * Get current breakpoint based on window width
 */
export function getCurrentBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}
