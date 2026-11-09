import type { Breakpoint, Layer, TextStyle, VariantStyleOverride } from '@/types';

export interface BreakpointConfig {
  value: Breakpoint;
  label: string;
  prefix: string;
  maxWidth: number | null;
}

/**
 * Built-in breakpoints. Desktop is the cascade base (no prefix). Tablet and
 * phone keep their Tailwind prefixes while their max widths stay at the
 * defaults, so existing projects compile the same CSS.
 */
export const BREAKPOINTS: BreakpointConfig[] = [
  { value: 'mobile', label: 'Phone', prefix: 'max-md:', maxWidth: 767 },
  { value: 'tablet', label: 'Tablet', prefix: 'max-lg:', maxWidth: 1023 },
  { value: 'desktop', label: 'Desktop', prefix: '', maxWidth: null },
];

/** Built-in breakpoint ids, smallest range first. */
export const BREAKPOINT_VALUES: Breakpoint[] = BREAKPOINTS.map(bp => bp.value);

export const SYSTEM_BREAKPOINT_IDS = ['desktop', 'tablet', 'mobile'] as const;
export type SystemBreakpointId = (typeof SYSTEM_BREAKPOINT_IDS)[number];

/** Settings key for the author-defined breakpoint catalog. */
export const BREAKPOINT_CATALOG_SETTING = 'breakpoint_catalog';

/** Settings key for freeform canvas breakpoint frames (builder-only). */
export const CANVAS_BREAKPOINT_FRAMES_SETTING = 'canvas_breakpoint_frames';

export const DEFAULT_TABLET_MAX = 1023;
export const DEFAULT_TABLET_MIN = 768;
export const DEFAULT_MOBILE_MAX = 767;
export const DEFAULT_MOBILE_MIN = 0;
export const DEFAULT_DESKTOP_MIN = 1024;
export const DEFAULT_DESKTOP_WIDTH = 1200;
export const DEFAULT_TABLET_WIDTH = 810;
export const DEFAULT_MOBILE_WIDTH = 390;

const MIN_CANVAS_WIDTH = 320;
const MAX_CANVAS_WIDTH = 1920;
const MIN_RANGE_WIDTH = 0;
const MAX_RANGE_WIDTH = 3840;

/**
 * Responsive + state variant prefix. `max-[900px]:` is a custom range.
 * Group 1 is the whole prefix (empty when the class is a base utility).
 */
export const RESPONSIVE_PREFIX_PATTERN = 'max-lg:|max-md:|lg:|md:|max-\\[\\d+px\\]:';
export const VARIANT_PREFIX_RE = new RegExp(
  `^((?:${RESPONSIVE_PREFIX_PATTERN})?(?:hover:|focus:|active:|disabled:|visited:|current:)?)`,
);
export const RESPONSIVE_PREFIX_RE = new RegExp(`^(?:${RESPONSIVE_PREFIX_PATTERN})`);

export interface CanvasBreakpointFrame {
  id: string;
  label: string;
  width: number;
  /** Built-in frames cannot be deleted. */
  locked?: boolean;
}

/**
 * One breakpoint the author can select on the canvas.
 * Desktop is the only base (maxWidth null). Every other breakpoint stores
 * overrides behind a max-width media query.
 */
export interface BreakpointDefinition {
  id: string;
  name: string;
  /** Artboard width shown on the canvas. */
  width: number;
  /** Inclusive lower bound. Null means no lower bound beyond a narrower sibling. */
  minWidth: number | null;
  /** Inclusive upper bound. Null is the primary breakpoint (no media query). */
  maxWidth: number | null;
  /** Desktop, Tablet, and Phone cannot be deleted. */
  system: boolean;
}

export const DEFAULT_CANVAS_BREAKPOINT_FRAMES: CanvasBreakpointFrame[] = [
  { id: 'desktop', label: 'Desktop', width: DEFAULT_DESKTOP_WIDTH, locked: true },
  { id: 'tablet', label: 'Tablet', width: DEFAULT_TABLET_WIDTH, locked: true },
  { id: 'mobile', label: 'Phone', width: DEFAULT_MOBILE_WIDTH, locked: true },
];

const DEFAULT_BREAKPOINT_CATALOG: BreakpointDefinition[] = [
  {
    id: 'desktop',
    name: 'Desktop',
    width: DEFAULT_DESKTOP_WIDTH,
    minWidth: DEFAULT_DESKTOP_MIN,
    maxWidth: null,
    system: true,
  },
  {
    id: 'tablet',
    name: 'Tablet',
    width: DEFAULT_TABLET_WIDTH,
    minWidth: DEFAULT_TABLET_MIN,
    maxWidth: DEFAULT_TABLET_MAX,
    system: true,
  },
  {
    id: 'mobile',
    name: 'Phone',
    width: DEFAULT_MOBILE_WIDTH,
    minWidth: DEFAULT_MOBILE_MIN,
    maxWidth: DEFAULT_MOBILE_MAX,
    system: true,
  },
];

let clientCatalog: BreakpointDefinition[] = defaultBreakpointCatalog();

export function defaultBreakpointCatalog(): BreakpointDefinition[] {
  return DEFAULT_BREAKPOINT_CATALOG.map((breakpoint) => ({ ...breakpoint }));
}

/** Editor and published pages share this so class prefixes resolve the same way. */
export function setClientBreakpointCatalog(catalog: BreakpointDefinition[]): void {
  clientCatalog = catalog.length > 0 ? catalog : defaultBreakpointCatalog();
}

export function getBreakpointCatalog(): BreakpointDefinition[] {
  return clientCatalog;
}

export function catalogBreakpointIds(catalog: BreakpointDefinition[] = getBreakpointCatalog()): Breakpoint[] {
  const ids = catalog.map((breakpoint) => breakpoint.id);
  const defaults: Breakpoint[] = ['mobile', 'tablet', 'desktop'];
  if (ids.length === defaults.length && defaults.every((id) => ids.includes(id))) {
    return [...BREAKPOINT_VALUES];
  }
  return ids;
}

export function isSystemBreakpointId(id: string): id is SystemBreakpointId {
  return id === 'desktop' || id === 'tablet' || id === 'mobile';
}

export function isBaseBreakpoint(id: string, catalog: BreakpointDefinition[] = getBreakpointCatalog()): boolean {
  const breakpoint = catalog.find((item) => item.id === id);
  if (!breakpoint) return id === 'desktop';
  return breakpoint.maxWidth == null;
}

export function breakpointLabel(id: string, catalog: BreakpointDefinition[] = getBreakpointCatalog()): string {
  const named = catalog.find((item) => item.id === id)?.name;
  if (named) return named;
  if (id === 'mobile') return 'Phone';
  if (id === 'tablet') return 'Tablet';
  if (id === 'desktop') return 'Desktop';
  return id;
}

export function clampFrameWidth(width: number): number {
  return Math.round(Math.min(MAX_CANVAS_WIDTH, Math.max(MIN_CANVAS_WIDTH, width)));
}

export function clampRangeWidth(width: number): number {
  return Math.round(Math.min(MAX_RANGE_WIDTH, Math.max(MIN_RANGE_WIDTH, width)));
}

function isValidBreakpointId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,40}$/.test(id);
}

export function createBreakpointId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let body = '';
  for (let index = 0; index < 8; index += 1) {
    body += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `bp-${body}`;
}

function classPrefixFor(breakpoint: BreakpointDefinition | undefined): string {
  if (!breakpoint || breakpoint.maxWidth == null) return '';
  if (breakpoint.id === 'tablet' && breakpoint.maxWidth === DEFAULT_TABLET_MAX) return 'max-lg:';
  if (breakpoint.id === 'mobile' && breakpoint.maxWidth === DEFAULT_MOBILE_MAX) return 'max-md:';
  return `max-[${breakpoint.maxWidth}px]:`;
}

/**
 * Tailwind prefix written for this breakpoint. Empty for the primary.
 * Tablet and phone keep `max-lg:` / `max-md:` until their max width changes.
 */
export function getBreakpointPrefix(
  breakpoint: Breakpoint,
  catalog: BreakpointDefinition[] = getBreakpointCatalog(),
): string {
  const match = catalog.find((item) => item.id === breakpoint);
  if (match) return classPrefixFor(match);
  if (breakpoint === 'tablet') return 'max-lg:';
  if (breakpoint === 'mobile') return 'max-md:';
  return '';
}

/** Prefixes that belong to this breakpoint, current one first. */
export function prefixesForBreakpoint(
  breakpoint: Breakpoint,
  catalog: BreakpointDefinition[] = getBreakpointCatalog(),
): string[] {
  const primary = getBreakpointPrefix(breakpoint, catalog);
  const extras: string[] = [];
  if (breakpoint === 'tablet' && primary !== 'max-lg:') extras.push('max-lg:');
  if (breakpoint === 'mobile' && primary !== 'max-md:') extras.push('max-md:');
  if (!primary) return extras;
  return [primary, ...extras.filter((prefix) => prefix !== primary)];
}

export function hasResponsivePrefix(className: string): boolean {
  return RESPONSIVE_PREFIX_RE.test(className);
}

export function stripVariantPrefixes(className: string): string {
  const match = className.match(VARIANT_PREFIX_RE);
  if (!match?.[1]) return className;
  return className.slice(match[1].length);
}

export function isVariantClass(className: string): boolean {
  if (hasResponsivePrefix(className)) return true;
  return /^(?:hover:|focus:|active:|disabled:|current:)/.test(className);
}

/**
 * Split a stored class into its breakpoint and the remainder (state prefix kept).
 * `max-lg:` stays tablet and `max-md:` stays phone so existing classes resolve
 * even after a range edit, until they are rewritten to the new prefix.
 */
export function splitResponsivePrefix(
  className: string,
  catalog: BreakpointDefinition[] = getBreakpointCatalog(),
): { breakpoint: Breakpoint; rest: string } {
  if (className.startsWith('max-md:')) {
    return { breakpoint: 'mobile', rest: className.slice(7) };
  }
  if (className.startsWith('max-lg:')) {
    return { breakpoint: 'tablet', rest: className.slice(7) };
  }
  const arbitrary = /^max-\[(\d+)px\]:/.exec(className);
  if (arbitrary) {
    const maxWidth = Number(arbitrary[1]);
    const match = catalog.find((item) => item.maxWidth === maxWidth);
    return {
      breakpoint: match?.id ?? `max-${maxWidth}`,
      rest: className.slice(arbitrary[0].length),
    };
  }
  if (className.startsWith('lg:')) {
    return { breakpoint: 'desktop', rest: className.slice(3) };
  }
  if (className.startsWith('md:')) {
    return { breakpoint: 'tablet', rest: className.slice(3) };
  }
  return { breakpoint: 'desktop', rest: className };
}

/**
 * Most specific breakpoint whose range contains `width`.
 * The primary breakpoint is the fallback when no max-width range matches.
 */
export function breakpointForWidth(
  width: number,
  catalog: BreakpointDefinition[] = getBreakpointCatalog(),
): BreakpointDefinition {
  const source = catalog.length > 0 ? catalog : defaultBreakpointCatalog();
  const matches = source.filter((breakpoint) => {
    if (breakpoint.maxWidth == null) return false;
    if (width > breakpoint.maxWidth) return false;
    if (breakpoint.minWidth != null && width < breakpoint.minWidth) return false;
    return true;
  });
  if (matches.length > 0) {
    return matches.reduce((best, breakpoint) => (
      (breakpoint.maxWidth ?? Infinity) < (best.maxWidth ?? Infinity) ? breakpoint : best
    ));
  }
  return source.find((breakpoint) => breakpoint.maxWidth == null)
    ?? source.find((breakpoint) => breakpoint.id === 'desktop')
    ?? source[0];
}

export function widthToBreakpoint(width: number, catalog?: BreakpointDefinition[]): Breakpoint {
  return breakpointForWidth(width, catalog).id;
}

/**
 * Breakpoints whose styles apply at `breakpointId`, most specific first.
 * Phone inherits a custom 900px breakpoint, which inherits tablet, then desktop.
 */
export function inheritanceChain(
  breakpointId: string,
  catalog: BreakpointDefinition[] = getBreakpointCatalog(),
): Breakpoint[] {
  const source = catalog.length > 0 ? catalog : defaultBreakpointCatalog();
  const current = source.find((item) => item.id === breakpointId);
  const base = source.find((item) => item.maxWidth == null) ?? source.find((item) => item.id === 'desktop');
  if (!current || current.maxWidth == null) {
    return [base?.id ?? 'desktop'];
  }
  const applicable = source
    .filter((item) => item.maxWidth != null && item.maxWidth >= current.maxWidth!)
    .sort((left, right) => left.maxWidth! - right.maxWidth!);
  const chain = applicable.map((item) => item.id);
  if (base && !chain.includes(base.id)) chain.push(base.id);
  return chain;
}

/** Base first, then progressively narrower ranges. Later entries override earlier ones. */
export function cascadeOrder(
  breakpointId: string,
  catalog: BreakpointDefinition[] = getBreakpointCatalog(),
): Breakpoint[] {
  return [...inheritanceChain(breakpointId, catalog)].reverse();
}

/**
 * Min-width points where the active breakpoint changes. Swiper is mobile-first,
 * so the 0 entry is the base and the rest are `breakpoints` keys.
 */
export function swiperMinWidthEntries(
  catalog: BreakpointDefinition[] = getBreakpointCatalog(),
): Array<{ min: number; id: string }> {
  const source = catalog.length > 0 ? catalog : defaultBreakpointCatalog();
  const bounds = new Set<number>([0]);
  for (const breakpoint of source) {
    if (breakpoint.minWidth != null && breakpoint.minWidth > 0) bounds.add(breakpoint.minWidth);
    if (breakpoint.maxWidth != null) bounds.add(breakpoint.maxWidth + 1);
  }
  const widths = [...bounds].sort((left, right) => left - right);
  const entries: Array<{ min: number; id: string }> = [];
  let previous: string | null = null;
  for (const min of widths) {
    const id = breakpointForWidth(min, source).id;
    if (id === previous) continue;
    entries.push({ min, id });
    previous = id;
  }
  return entries;
}

export function formatBreakpointRange(breakpoint: BreakpointDefinition): string {
  if (breakpoint.maxWidth == null) {
    const min = breakpoint.minWidth ?? 0;
    return `${min}+`;
  }
  if (breakpoint.minWidth != null && breakpoint.minWidth > 0) {
    return `${breakpoint.minWidth}–${breakpoint.maxWidth}`;
  }
  return `≤${breakpoint.maxWidth}`;
}

export function getCurrentBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  return breakpointForWidth(window.innerWidth).id;
}

function systemTemplate(id: SystemBreakpointId): BreakpointDefinition {
  const found = DEFAULT_BREAKPOINT_CATALOG.find((item) => item.id === id);
  return { ...found! };
}

function readWidth(value: unknown, fallback: number, clamp: (width: number) => number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clamp(numeric);
}

function readOptionalWidth(value: unknown): number | null {
  if (value == null || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return clampRangeWidth(numeric);
}

function claimUniqueMaxWidths(list: BreakpointDefinition[]): BreakpointDefinition[] {
  const used = new Set<number>();
  const claim = (breakpoint: BreakpointDefinition): BreakpointDefinition => {
    if (breakpoint.maxWidth == null) return breakpoint;
    let maxWidth = breakpoint.maxWidth;
    while (used.has(maxWidth)) maxWidth += 1;
    used.add(maxWidth);
    return maxWidth === breakpoint.maxWidth ? breakpoint : { ...breakpoint, maxWidth };
  };
  const claimed = new Map<string, BreakpointDefinition>();
  for (const breakpoint of list) {
    if (!breakpoint.system) continue;
    claimed.set(breakpoint.id, claim(breakpoint));
  }
  for (const breakpoint of list) {
    if (breakpoint.system) continue;
    claimed.set(breakpoint.id, claim(breakpoint));
  }
  return list.map((breakpoint) => claimed.get(breakpoint.id) ?? breakpoint);
}

/**
 * Accept saved settings, or the previous canvas-frame list, and always keep
 * Desktop, Tablet, and Phone. Unknown shapes fall back to the built-in trio.
 */
export function normalizeBreakpointCatalog(value: unknown): BreakpointDefinition[] {
  if (!Array.isArray(value)) return defaultBreakpointCatalog();

  const parsed: BreakpointDefinition[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Record<string, unknown>;
    const rawId = typeof raw.id === 'string' ? raw.id : '';
    if (!isValidBreakpointId(rawId) || seen.has(rawId)) continue;
    seen.add(rawId);
    const system = isSystemBreakpointId(rawId);
    const template = system ? systemTemplate(rawId) : null;
    const name = typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim().slice(0, 40)
      : (typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim().slice(0, 40) : template?.name ?? 'Breakpoint');
    const width = readWidth(raw.width, template?.width ?? 800, clampFrameWidth);
    let maxWidth = rawId === 'desktop' ? null : readOptionalWidth(raw.maxWidth);
    if (rawId !== 'desktop' && maxWidth == null) {
      maxWidth = template?.maxWidth ?? clampRangeWidth(width);
    }
    let minWidth = readOptionalWidth(raw.minWidth);
    if (minWidth == null && template) minWidth = template.minWidth;
    if (minWidth != null && maxWidth != null && minWidth > maxWidth) minWidth = maxWidth;
    parsed.push({
      id: rawId,
      name,
      width,
      minWidth,
      maxWidth,
      system,
    });
  }

  for (const id of SYSTEM_BREAKPOINT_IDS) {
    if (!seen.has(id)) parsed.push(systemTemplate(id));
  }

  if (!parsed.some((breakpoint) => breakpoint.maxWidth == null)) {
    const desktop = parsed.find((breakpoint) => breakpoint.id === 'desktop');
    if (desktop) desktop.maxWidth = null;
  }

  return claimUniqueMaxWidths(parsed);
}

function legacyFramesToCatalog(frames: CanvasBreakpointFrame[]): BreakpointDefinition[] {
  const ordered: BreakpointDefinition[] = [];
  const seen = new Set<string>();
  for (const frame of frames) {
    if (isSystemBreakpointId(frame.id)) {
      const template = systemTemplate(frame.id);
      ordered.push({
        ...template,
        name: frame.label?.trim().slice(0, 40) || template.name,
        width: clampFrameWidth(frame.width),
      });
      seen.add(frame.id);
      continue;
    }
    if (!isValidBreakpointId(frame.id) || seen.has(frame.id)) continue;
    const maxWidth = clampRangeWidth(frame.width);
    ordered.push({
      id: frame.id,
      name: frame.label?.trim().slice(0, 40) || 'Custom',
      width: clampFrameWidth(frame.width),
      minWidth: null,
      maxWidth,
      system: false,
    });
    seen.add(frame.id);
  }
  for (const id of SYSTEM_BREAKPOINT_IDS) {
    if (!seen.has(id)) ordered.push(systemTemplate(id));
  }
  return ordered;
}

/**
 * Prefer the saved catalog. Projects that only have the older canvas frames
 * keep those artboards, including resized defaults and any custom frame.
 */
export function resolveBreakpointCatalog(saved: unknown, legacyFrames?: unknown): BreakpointDefinition[] {
  if (Array.isArray(saved) && saved.length > 0) return normalizeBreakpointCatalog(saved);
  if (Array.isArray(legacyFrames) && legacyFrames.length > 0) {
    return normalizeBreakpointCatalog(
      legacyFramesToCatalog(normalizeCanvasBreakpointFrames(legacyFrames)),
    );
  }
  return defaultBreakpointCatalog();
}

export function normalizeCanvasBreakpointFrames(value: unknown): CanvasBreakpointFrame[] {
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
      locked: Boolean(raw.locked) || DEFAULT_CANVAS_BREAKPOINT_FRAMES.some((item) => item.id === id),
    });
  }

  return frames.length > 0
    ? frames
    : DEFAULT_CANVAS_BREAKPOINT_FRAMES.map((frame) => ({ ...frame }));
}

export interface BreakpointMutation {
  catalog: BreakpointDefinition[];
  error?: string;
  prefixRewrite?: { from: string; to: string };
  created?: BreakpointDefinition;
}

function uniqueName(catalog: BreakpointDefinition[], base: string): string {
  const names = new Set(catalog.map((breakpoint) => breakpoint.name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  let index = 2;
  while (names.has(`${base} ${index}`.toLowerCase())) index += 1;
  return `${base} ${index}`;
}

function nextFreeMax(catalog: BreakpointDefinition[]): number {
  const used = new Set(
    catalog.map((breakpoint) => breakpoint.maxWidth).filter((width): width is number => width != null),
  );
  for (const candidate of [1440, 1280, 900, 600, 480, 1100, 1600, 2000]) {
    if (!used.has(candidate)) return candidate;
  }
  let width = 500;
  while (used.has(width)) width += 10;
  return width;
}

export function createBreakpoint(
  catalog: BreakpointDefinition[],
  input?: { name?: string; width?: number; minWidth?: number | null; maxWidth?: number | null },
): BreakpointMutation {
  const maxWidth = input?.maxWidth != null ? clampRangeWidth(input.maxWidth) : nextFreeMax(catalog);
  if (catalog.some((breakpoint) => breakpoint.maxWidth === maxWidth)) {
    return { catalog, error: 'Another breakpoint already uses that max width.' };
  }
  let minWidth = input?.minWidth == null ? null : clampRangeWidth(input.minWidth);
  if (minWidth != null && minWidth > maxWidth) minWidth = maxWidth;
  const width = clampFrameWidth(input?.width ?? Math.min(MAX_CANVAS_WIDTH, Math.max(MIN_CANVAS_WIDTH, maxWidth)));
  const name = uniqueName(catalog, (input?.name || 'Breakpoint').trim().slice(0, 40) || 'Breakpoint');
  const created: BreakpointDefinition = {
    id: createBreakpointId(),
    name,
    width,
    minWidth,
    maxWidth,
    system: false,
  };
  return { catalog: [...catalog, created], created };
}

export function renameBreakpoint(
  catalog: BreakpointDefinition[],
  id: string,
  name: string,
): BreakpointMutation {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return { catalog, error: 'Name is required.' };
  if (!catalog.some((breakpoint) => breakpoint.id === id)) {
    return { catalog, error: 'Breakpoint not found.' };
  }
  return {
    catalog: catalog.map((breakpoint) => (
      breakpoint.id === id ? { ...breakpoint, name: trimmed } : breakpoint
    )),
  };
}

export function deleteBreakpoint(catalog: BreakpointDefinition[], id: string): BreakpointMutation {
  const target = catalog.find((breakpoint) => breakpoint.id === id);
  if (!target) return { catalog, error: 'Breakpoint not found.' };
  if (target.system) return { catalog, error: 'Desktop, Tablet, and Phone stay in the project.' };
  if (catalog.length <= 1) return { catalog, error: 'At least one breakpoint is required.' };
  return { catalog: catalog.filter((breakpoint) => breakpoint.id !== id) };
}

export function moveBreakpoint(
  catalog: BreakpointDefinition[],
  id: string,
  direction: -1 | 1,
): BreakpointMutation {
  const index = catalog.findIndex((breakpoint) => breakpoint.id === id);
  if (index < 0) return { catalog, error: 'Breakpoint not found.' };
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= catalog.length) return { catalog };
  const next = [...catalog];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return { catalog: next };
}

export function updateBreakpointRange(
  catalog: BreakpointDefinition[],
  id: string,
  patch: { width?: number; minWidth?: number | null; maxWidth?: number | null },
): BreakpointMutation {
  const current = catalog.find((breakpoint) => breakpoint.id === id);
  if (!current) return { catalog, error: 'Breakpoint not found.' };

  let maxWidth = current.maxWidth;
  if (patch.maxWidth !== undefined) {
    if (current.id === 'desktop' || (current.maxWidth == null && patch.maxWidth == null)) {
      maxWidth = null;
    } else if (patch.maxWidth == null) {
      return { catalog, error: 'Set a max width for this breakpoint.' };
    } else {
      maxWidth = clampRangeWidth(patch.maxWidth);
      if (maxWidth < 1) return { catalog, error: 'Max width must be at least 1.' };
    }
  }
  if (current.id === 'desktop') maxWidth = null;

  let minWidth = patch.minWidth === undefined ? current.minWidth : patch.minWidth;
  if (minWidth != null) minWidth = clampRangeWidth(minWidth);
  if (minWidth != null && maxWidth != null && minWidth > maxWidth) {
    return { catalog, error: 'Min width cannot be greater than max width.' };
  }

  const width = patch.width === undefined ? current.width : clampFrameWidth(patch.width);
  if (maxWidth != null && catalog.some((breakpoint) => breakpoint.id !== id && breakpoint.maxWidth === maxWidth)) {
    return { catalog, error: 'Another breakpoint already uses that max width.' };
  }

  const nextBreakpoint: BreakpointDefinition = { ...current, width, minWidth, maxWidth };
  const from = classPrefixFor(current);
  const to = classPrefixFor(nextBreakpoint);
  return {
    catalog: catalog.map((breakpoint) => (breakpoint.id === id ? nextBreakpoint : breakpoint)),
    prefixRewrite: from !== to ? { from, to } : undefined,
  };
}

export function rewriteClassText(value: string, from: string, to: string): string {
  if (!from || from === to || !value.includes(from)) return value;
  let changed = false;
  const next = value.split(/\s+/).filter(Boolean).map((token) => {
    if (!token.startsWith(from)) return token;
    changed = true;
    return `${to}${token.slice(from.length)}`;
  });
  return changed ? next.join(' ') : value;
}

function rewriteMaybeText(
  value: string | undefined,
  from: string,
  to: string,
): { value: string | undefined; changed: boolean } {
  if (!value) return { value, changed: false };
  const next = rewriteClassText(value, from, to);
  return { value: next, changed: next !== value };
}

function rewriteTextStyle(style: TextStyle, from: string, to: string): { style: TextStyle; changed: boolean } {
  let changed = false;
  let next = style;
  const classes = rewriteMaybeText(style.classes, from, to);
  if (classes.changed) {
    next = { ...next, classes: classes.value };
    changed = true;
  }
  const overrides = rewriteMaybeText(style.styleOverrides?.classes, from, to);
  if (overrides.changed && next.styleOverrides) {
    next = { ...next, styleOverrides: { ...next.styleOverrides, classes: overrides.value } };
    changed = true;
  }
  return { style: changed ? next : style, changed };
}

export function rewriteLayer(layer: Layer, from: string, to: string): { layer: Layer; changed: boolean } {
  if (!from || from === to) return { layer, changed: false };
  let changed = false;
  let next = layer;

  if (Array.isArray(layer.classes)) {
    let classesChanged = false;
    const classes = layer.classes.map((token) => {
      if (typeof token !== 'string' || !token.startsWith(from)) return token;
      classesChanged = true;
      return `${to}${token.slice(from.length)}`;
    });
    if (classesChanged) {
      next = { ...next, classes };
      changed = true;
    }
  } else if (typeof layer.classes === 'string') {
    const classes = rewriteClassText(layer.classes, from, to);
    if (classes !== layer.classes) {
      next = { ...next, classes };
      changed = true;
    }
  }

  const styleOverrides = rewriteMaybeText(layer.styleOverrides?.classes, from, to);
  if (styleOverrides.changed && next.styleOverrides) {
    next = { ...next, styleOverrides: { ...next.styleOverrides, classes: styleOverrides.value } };
    changed = true;
  }

  if (layer.styleOverridesByStyle) {
    let overridesChanged = false;
    const styleOverridesByStyle = { ...layer.styleOverridesByStyle };
    for (const [styleId, override] of Object.entries(layer.styleOverridesByStyle)) {
      const rewritten = rewriteMaybeText(override?.classes, from, to);
      if (!rewritten.changed) continue;
      styleOverridesByStyle[styleId] = { ...override, classes: rewritten.value };
      overridesChanged = true;
    }
    if (overridesChanged) {
      next = { ...next, styleOverridesByStyle };
      changed = true;
    }
  }

  if (layer.textStyles) {
    let textChanged = false;
    const textStyles = { ...layer.textStyles };
    for (const [key, style] of Object.entries(layer.textStyles)) {
      const rewritten = rewriteTextStyle(style, from, to);
      if (!rewritten.changed) continue;
      textStyles[key] = rewritten.style;
      textChanged = true;
    }
    if (textChanged) {
      next = { ...next, textStyles };
      changed = true;
    }
  }

  if (layer.children?.length) {
    const children = rewriteLayers(layer.children, from, to);
    if (children.changed) {
      next = { ...next, children: children.layers };
      changed = true;
    }
  }

  return { layer: changed ? next : layer, changed };
}

export function rewriteLayers(layers: Layer[], from: string, to: string): { layers: Layer[]; changed: boolean } {
  let changed = false;
  const next = layers.map((layer) => {
    const rewritten = rewriteLayer(layer, from, to);
    if (rewritten.changed) changed = true;
    return rewritten.layer;
  });
  return { layers: changed ? next : layers, changed };
}

export function rewriteVariantOverrides(
  overrides: Record<string, VariantStyleOverride> | undefined,
  from: string,
  to: string,
): { overrides: Record<string, VariantStyleOverride> | undefined; changed: boolean } {
  if (!overrides) return { overrides, changed: false };
  let changed = false;
  const next: Record<string, VariantStyleOverride> = { ...overrides };
  for (const [layerId, override] of Object.entries(overrides)) {
    const rewritten = rewriteMaybeText(override?.classes, from, to);
    if (!rewritten.changed) continue;
    next[layerId] = { ...override, classes: rewritten.value };
    changed = true;
  }
  return { overrides: changed ? next : overrides, changed };
}
