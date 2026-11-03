/**
 * Framer-style interaction model for Sprint 4.
 *
 * Events stay on the existing trigger field (tap, hover, press, keyboard, timer, appear, scroll, load).
 * Actions are a separate list on that event: set variant, overlay, navigate,
 * scroll to, set variable, and scroll-to-variant. Tweens remain the animation track, including Appear
 * presets. Effects (opacity, shadow, blur) are not part of this model.
 *
 * Code overrides (lib/code-components.ts) only add a class or a data/aria
 * attribute. They do not add events, actions, or effects.
 */

import { BREAKPOINT_VALUES } from '@/lib/breakpoint-utils';
import type {
  AppearPresetId,
  InteractionAction,
  InteractionTween,
  KeyboardTrigger,
  Layer,
  LayerInteraction,
  OverlayDismiss,
  OverlayPlacement,
  ScrollPresetId,
  TimerTrigger,
  TweenProperties,
} from '@/types';

export type InteractionEvent = LayerInteraction['trigger'];

/** Labels shown in the Interactions tab. Values stay the stored trigger ids. */
export const EVENT_LABELS: Record<InteractionEvent, string> = {
  click: 'Tap',
  hover: 'Hover',
  press: 'Press',
  key: 'Keyboard',
  timer: 'Timer',
  'scroll-into-view': 'Appear',
  'while-scrolling': 'Scroll',
  load: 'Load',
};

export const INTERACTION_EVENTS: InteractionEvent[] = [
  'click',
  'hover',
  'press',
  'key',
  'timer',
  'scroll-into-view',
  'while-scrolling',
  'load',
];

/** First run of a new Timer event. */
export const DEFAULT_TIMER_DELAY_MS = 1000;

/** Repeat gap never schedules a zero-delay loop. */
export const MIN_TIMER_INTERVAL_MS = 1;

export const KEYBOARD_MODIFIERS: ReadonlyArray<{
  key: 'ctrl' | 'alt' | 'shift' | 'meta';
  label: string;
}> = [
  { key: 'ctrl', label: 'Ctrl' },
  { key: 'alt', label: 'Alt' },
  { key: 'shift', label: 'Shift' },
  { key: 'meta', label: 'Cmd' },
];

export const DEFAULT_OVERLAY_DISMISS: OverlayDismiss = {
  escape: true,
  outside: true,
  restoreFocus: true,
};

export const OVERLAY_DISMISS_ROWS: ReadonlyArray<{ key: keyof OverlayDismiss; label: string }> = [
  { key: 'escape', label: 'Escape' },
  { key: 'outside', label: 'Outside click' },
  { key: 'restoreFocus', label: 'Return focus' },
];

export interface AppearPreset {
  id: AppearPresetId;
  label: string;
  from: TweenProperties;
  to: TweenProperties;
  duration: number;
  ease: string;
}

export const APPEAR_PRESETS: readonly AppearPreset[] = [
  {
    id: 'fade',
    label: 'Fade',
    from: { autoAlpha: '0' },
    to: { autoAlpha: '1' },
    duration: 0.6,
    ease: 'power2.out',
  },
  {
    id: 'slide-up',
    label: 'Slide up',
    from: { autoAlpha: '0', y: '24px' },
    to: { autoAlpha: '1', y: '0px' },
    duration: 0.6,
    ease: 'power2.out',
  },
  {
    id: 'slide-down',
    label: 'Slide down',
    from: { autoAlpha: '0', y: '-24px' },
    to: { autoAlpha: '1', y: '0px' },
    duration: 0.6,
    ease: 'power2.out',
  },
  {
    id: 'scale',
    label: 'Scale',
    from: { autoAlpha: '0', scale: '0.92' },
    to: { autoAlpha: '1', scale: '1' },
    duration: 0.45,
    ease: 'power2.out',
  },
];

export function eventLabel(trigger: InteractionEvent): string {
  return EVENT_LABELS[trigger];
}

export function defaultKeyboardTrigger(): KeyboardTrigger {
  return { key: '', phase: 'down', shift: false, meta: false, alt: false, ctrl: false };
}

export function defaultTimerTrigger(): TimerTrigger {
  return {
    delay: DEFAULT_TIMER_DELAY_MS,
    repeat: false,
    interval: DEFAULT_TIMER_DELAY_MS,
  };
}

export function withKeyboard(
  interaction: LayerInteraction,
  patch: Partial<KeyboardTrigger>,
): LayerInteraction {
  return {
    ...interaction,
    keyboard: { ...defaultKeyboardTrigger(), ...interaction.keyboard, ...patch },
  };
}

export function withTimer(
  interaction: LayerInteraction,
  patch: Partial<TimerTrigger>,
): LayerInteraction {
  return {
    ...interaction,
    timer: { ...defaultTimerTrigger(), ...interaction.timer, ...patch },
  };
}

const MODIFIER_KEY_NAMES = new Set([
  'shift',
  'control',
  'ctrl',
  'alt',
  'option',
  'meta',
  'cmd',
  'command',
  'os',
  'altgraph',
  'capslock',
  'hyper',
  'super',
  'fn',
]);

const KEY_ALIASES: Record<string, string> = {
  ' ': 'space',
  spacebar: 'space',
  esc: 'escape',
  return: 'enter',
  del: 'delete',
  'arrow up': 'arrowup',
  'arrow down': 'arrowdown',
  'arrow left': 'arrowleft',
  'arrow right': 'arrowright',
  'page up': 'pageup',
  'page down': 'pagedown',
};

const NAMED_KEY_CODES: Record<string, string> = {
  Space: 'space',
  Enter: 'enter',
  NumpadEnter: 'enter',
  Escape: 'escape',
  Tab: 'tab',
  Backspace: 'backspace',
  Delete: 'delete',
  ArrowUp: 'arrowup',
  ArrowDown: 'arrowdown',
  ArrowLeft: 'arrowleft',
  ArrowRight: 'arrowright',
  Home: 'home',
  End: 'end',
  PageUp: 'pageup',
  PageDown: 'pagedown',
};

const KEY_LABELS: Record<string, string> = {
  space: 'Space',
  enter: 'Enter',
  escape: 'Esc',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  arrowup: 'Arrow up',
  arrowdown: 'Arrow down',
  arrowleft: 'Arrow left',
  arrowright: 'Arrow right',
  home: 'Home',
  end: 'End',
  pageup: 'Page up',
  pagedown: 'Page down',
};

/** Stored key id. Letters and digits are lowercase. Modifier names are empty. */
export function canonicalKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (MODIFIER_KEY_NAMES.has(lower)) return '';
  if (KEY_ALIASES[lower]) return KEY_ALIASES[lower];
  if (/^[a-z0-9]$/.test(lower)) return lower;
  if (/^f(?:[1-9]|1[0-2])$/.test(lower)) return lower;
  return lower;
}

export interface KeyboardEventLike {
  key: string;
  code?: string;
  shiftKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  repeat?: boolean;
}

/**
 * Physical key from a keyboard event. Letter and digit codes win over
 * `event.key` so Shift+1 stays "1" instead of "!".
 */
export function keyFromKeyboardEvent(event: Pick<KeyboardEventLike, 'key' | 'code'>): string | null {
  const code = event.code ?? '';
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1].toLowerCase();
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) return digit[1];
  const numpad = /^Numpad([0-9])$/.exec(code);
  if (numpad) return numpad[1];
  const fn = /^F([1-9]|1[0-2])$/.exec(code);
  if (fn) return `f${fn[1]}`;
  if (NAMED_KEY_CODES[code]) return NAMED_KEY_CODES[code];
  const key = canonicalKey(event.key || '');
  return key || null;
}

/** Exact shortcut match. A held key repeat does not fire key down again. */
export function keyboardEventMatches(
  keyboard: KeyboardTrigger | undefined,
  event: KeyboardEventLike,
  phase: 'down' | 'up',
): boolean {
  if (!keyboard?.key) return false;
  if ((keyboard.phase ?? 'down') !== phase) return false;
  if (phase === 'down' && event.repeat) return false;
  const pressed = keyFromKeyboardEvent(event);
  if (!pressed || pressed !== canonicalKey(keyboard.key)) return false;
  if (!!event.shiftKey !== !!keyboard.shift) return false;
  if (!!event.metaKey !== !!keyboard.meta) return false;
  if (!!event.altKey !== !!keyboard.alt) return false;
  if (!!event.ctrlKey !== !!keyboard.ctrl) return false;
  return true;
}

/** Ctrl, Alt, and Cmd still run while a text field is focused. Shift does not. */
export function keyboardBypassesTyping(keyboard: KeyboardTrigger | undefined): boolean {
  return !!(keyboard?.meta || keyboard?.ctrl || keyboard?.alt);
}

export function keyboardShouldFire(
  keyboard: KeyboardTrigger | undefined,
  event: KeyboardEventLike,
  phase: 'down' | 'up',
  typing = false,
): boolean {
  if (!keyboardEventMatches(keyboard, event, phase)) return false;
  if (typing && !keyboardBypassesTyping(keyboard)) return false;
  return true;
}

export function formatKeyLabel(key: string): string {
  const canonical = canonicalKey(key);
  if (!canonical) return '';
  if (KEY_LABELS[canonical]) return KEY_LABELS[canonical];
  if (/^[a-z]$/.test(canonical)) return canonical.toUpperCase();
  if (/^f\d+$/.test(canonical)) return canonical.toUpperCase();
  return canonical;
}

/** "Ctrl+Shift+⌘+K". Empty when no key is chosen. */
export function formatKeyboardCombo(keyboard: KeyboardTrigger | undefined): string {
  if (!keyboard?.key) return '';
  const label = formatKeyLabel(keyboard.key);
  if (!label) return '';
  const modifiers: string[] = [];
  if (keyboard.ctrl) modifiers.push('Ctrl');
  if (keyboard.alt) modifiers.push('Alt');
  if (keyboard.shift) modifiers.push('Shift');
  if (keyboard.meta) modifiers.push('⌘');
  return [...modifiers, label].join('+');
}

export function sanitizeMilliseconds(value: unknown, minimum = 0): number | null {
  let numeric: number;
  if (typeof value === 'number') numeric = value;
  else if (typeof value === 'string' && value.trim() !== '') numeric = Number(value);
  else return null;
  if (!Number.isFinite(numeric)) return null;
  return Math.max(minimum, Math.round(numeric));
}

export interface TimerSchedule {
  delay: number;
  /** Null fires once. A repeat uses at least {@link MIN_TIMER_INTERVAL_MS}. */
  interval: number | null;
}

/** When a Timer event runs. Missing or non-numeric delay does not run. */
export function timerSchedule(timer: TimerTrigger | undefined): TimerSchedule | null {
  if (!timer) return null;
  const delay = sanitizeMilliseconds(timer.delay, 0);
  if (delay === null) return null;
  if (!timer.repeat) return { delay, interval: null };
  const raw = timer.interval === undefined ? delay : timer.interval;
  const interval = sanitizeMilliseconds(raw, MIN_TIMER_INTERVAL_MS);
  if (interval === null) return { delay, interval: MIN_TIMER_INTERVAL_MS };
  return { delay, interval };
}

const ACTION_TYPES = new Set<InteractionAction['type']>([
  'set-variant',
  'overlay',
  'navigate',
  'scroll-to',
  'set-variable',
  'scroll-variant',
]);

export type AuthorableActionKind =
  | 'navigate'
  | 'set-variant'
  | 'open-overlay'
  | 'close-overlay'
  | 'scroll-to'
  | 'set-variable'
  | 'scroll-variant';

/** Empty event document. Appear and scroll presets are applied by the caller. */
export function createLayerInteraction(
  id: string,
  trigger: InteractionEvent,
): LayerInteraction {
  return {
    id,
    trigger,
    timeline: {
      breakpoints: [...BREAKPOINT_VALUES],
      repeat: 0,
      yoyo: false,
      ...(trigger === 'scroll-into-view' ? {
        scrollStart: 'top 80%',
        toggleActions: 'play none none none',
      } : {}),
      ...(trigger === 'while-scrolling' ? {
        scrollStart: 'top bottom',
        scrollEnd: 'bottom top',
        scrub: 1,
      } : {}),
    },
    tweens: [],
    ...(trigger === 'key' ? { keyboard: defaultKeyboardTrigger() } : {}),
    ...(trigger === 'timer' ? { timer: defaultTimerTrigger() } : {}),
  };
}

export function createEventAction(id: string, kind: AuthorableActionKind): InteractionAction {
  switch (kind) {
    case 'navigate':
      return createNavigateAction(id);
    case 'set-variant':
      return createSetVariantAction(id);
    case 'open-overlay':
      return createOverlayAction(id, 'open');
    case 'close-overlay':
      return createOverlayAction(id, 'close');
    case 'scroll-to':
      return createScrollToAction(id);
    case 'set-variable':
      return createSetVariableAction(id);
    case 'scroll-variant':
      return createScrollVariantAction(id);
    default:
      return createNavigateAction(id);
  }
}

/** Replace one interaction on a layer, or append it. Does not mutate the layer. */
export function upsertLayerInteraction(
  layer: Layer,
  interaction: LayerInteraction,
): Layer {
  const interactions = layer.interactions ?? [];
  const exists = interactions.some(item => item.id === interaction.id);
  return {
    ...layer,
    interactions: exists
      ? interactions.map(item => (item.id === interaction.id ? interaction : item))
      : [...interactions, interaction],
  };
}

export function removeLayerInteraction(layer: Layer, interactionId: string): Layer {
  return {
    ...layer,
    interactions: (layer.interactions ?? []).filter(item => item.id !== interactionId),
  };
}

/**
 * Write one event and one action onto the layer document.
 * An existing interaction with the same id keeps its tweens.
 */
export function authorLayerInteraction(
  layer: Layer,
  spec: {
    interactionId: string;
    trigger: InteractionEvent;
    action: InteractionAction;
  },
): Layer {
  const existing = (layer.interactions ?? []).find(item => item.id === spec.interactionId);
  const base = existing
    ? { ...existing, trigger: spec.trigger }
    : createLayerInteraction(spec.interactionId, spec.trigger);
  return upsertLayerInteraction(layer, upsertInteractionAction(base, spec.action));
}

export function serializeLayerInteractions(
  interactions: LayerInteraction[] | undefined,
): string {
  return JSON.stringify(interactions ?? []);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readInteraction(value: unknown): LayerInteraction {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new Error('Interaction is missing an id');
  }
  if (!INTERACTION_EVENTS.includes(value.trigger as InteractionEvent)) {
    throw new Error('Interaction trigger is not supported');
  }
  if (!isRecord(value.timeline) || !Array.isArray(value.timeline.breakpoints)) {
    throw new Error('Interaction timeline is missing');
  }
  if (!Array.isArray(value.tweens)) {
    throw new Error('Interaction tweens must be an array');
  }
  const actions = value.actions;
  if (actions !== undefined) {
    if (!Array.isArray(actions)) throw new Error('Interaction actions must be an array');
    for (const action of actions) {
      if (!isRecord(action) || typeof action.id !== 'string' || !ACTION_TYPES.has(action.type as InteractionAction['type'])) {
        throw new Error('Interaction action is not supported');
      }
    }
  }
  if (value.keyboard !== undefined) value.keyboard = readKeyboard(value.keyboard);
  if (value.timer !== undefined) value.timer = readTimer(value.timer);
  return value as unknown as LayerInteraction;
}

function readFlag(record: Record<string, unknown>, key: string, label: string): boolean {
  const flag = record[key];
  if (flag === undefined) return false;
  if (typeof flag !== 'boolean') throw new Error(`${label} is not supported`);
  return flag;
}

function readKeyboard(value: unknown): KeyboardTrigger {
  if (!isRecord(value)) throw new Error('Keyboard trigger is not supported');
  if (value.key !== undefined && typeof value.key !== 'string') {
    throw new Error('Keyboard key is not supported');
  }
  if (value.phase !== undefined && value.phase !== 'down' && value.phase !== 'up') {
    throw new Error('Keyboard phase is not supported');
  }
  return {
    key: canonicalKey(typeof value.key === 'string' ? value.key : ''),
    phase: value.phase === 'up' ? 'up' : 'down',
    shift: readFlag(value, 'shift', 'Keyboard shift'),
    meta: readFlag(value, 'meta', 'Keyboard command'),
    alt: readFlag(value, 'alt', 'Keyboard alt'),
    ctrl: readFlag(value, 'ctrl', 'Keyboard control'),
  };
}

function readTimer(value: unknown): TimerTrigger {
  if (!isRecord(value)) throw new Error('Timer trigger is not supported');
  const delay = sanitizeMilliseconds(value.delay, 0);
  if (delay === null) throw new Error('Timer delay is not supported');
  if (value.repeat !== undefined && typeof value.repeat !== 'boolean') {
    throw new Error('Timer repeat is not supported');
  }
  const timer: TimerTrigger = { delay, repeat: value.repeat === true };
  if (value.interval !== undefined) {
    const interval = sanitizeMilliseconds(value.interval, 0);
    if (interval === null) throw new Error('Timer interval is not supported');
    timer.interval = interval;
  }
  return timer;
}

/** Read a stored interactions array. Throws when the document is not the event model. */
export function parseLayerInteractions(serialized: string): LayerInteraction[] {
  const parsed: unknown = JSON.parse(serialized);
  if (!Array.isArray(parsed)) throw new Error('Interactions must be an array');
  return parsed.map(readInteraction);
}

export type ActionEffect =
  | { type: 'navigate'; href: string | null }
  | { type: 'set-variant'; targetLayerId: string; variantId: string }
  | { type: 'overlay'; operation: 'open' | 'close'; targetLayerId: string }
  | { type: 'scroll-to'; target: 'layer' | 'page'; targetLayerId: string; position: 'top' | 'bottom' }
  | { type: 'set-variable'; variableId: string; value: string }
  | { type: 'scroll-variant'; targetLayerId: string; variantId: string };

/** What a saved event will do when preview runs it. No DOM. */
export function actionEffects(
  interaction: LayerInteraction,
  mode: 'event' | 'scroll' = 'event',
): ActionEffect[] {
  return actionsForRun(interaction.actions, mode).map((action) => {
    switch (action.type) {
      case 'navigate':
        return { type: 'navigate', href: resolveNavigateHref(action) };
      case 'set-variant':
        return {
          type: 'set-variant',
          targetLayerId: action.targetLayerId,
          variantId: action.variantId,
        };
      case 'overlay':
        return {
          type: 'overlay',
          operation: action.operation,
          targetLayerId: action.targetLayerId,
        };
      case 'scroll-to':
        return {
          type: 'scroll-to',
          target: action.target,
          targetLayerId: action.targetLayerId ?? '',
          position: action.position === 'bottom' ? 'bottom' : 'top',
        };
      case 'set-variable':
        return {
          type: 'set-variable',
          variableId: action.variableId,
          value: action.value,
        };
      case 'scroll-variant':
        return {
          type: 'scroll-variant',
          targetLayerId: action.targetLayerId,
          variantId: variantForScrollProgress(action.stops, 1) ?? '',
        };
      default:
        return { type: 'navigate', href: null };
    }
  });
}

export function appearPresetById(id: AppearPresetId): AppearPreset {
  return APPEAR_PRESETS.find(preset => preset.id === id) ?? APPEAR_PRESETS[0];
}

export function actionLabel(action: InteractionAction): string {
  switch (action.type) {
    case 'set-variant':
      return 'Set Variant';
    case 'overlay':
      return action.operation === 'open' ? 'Open Overlay' : 'Close Overlay';
    case 'navigate':
      return 'Navigate';
    case 'scroll-to':
      return 'Scroll to';
    case 'set-variable':
      return 'Set Variable';
    case 'scroll-variant':
      return 'Scroll to Variant';
    default:
      return 'Action';
  }
}

function eventHeading(interaction: LayerInteraction): string {
  const label = eventLabel(interaction.trigger);
  if (interaction.trigger === 'key') {
    const combo = formatKeyboardCombo(interaction.keyboard);
    const phase = interaction.keyboard?.phase === 'up' ? 'up' : '';
    const detail = [phase, combo].filter(Boolean).join(' ');
    return detail ? `${label} ${detail}` : label;
  }
  if (interaction.trigger === 'timer') {
    const schedule = timerSchedule(interaction.timer);
    if (!schedule) return label;
    if (schedule.interval == null) return `${label} ${schedule.delay}ms`;
    return `${label} ${schedule.delay}ms every ${schedule.interval}ms`;
  }
  return label;
}

/** "Tap → Set Variant" for the event list. */
export function interactionSummary(interaction: LayerInteraction): string {
  const event = eventHeading(interaction);
  const action = interaction.actions?.[0];
  if (action) return `${event} → ${actionLabel(action)}`;
  if (interaction.appearPreset) {
    return `${event} → ${appearPresetById(interaction.appearPreset).label}`;
  }
  if (interaction.scrollPreset) {
    return `${event} → ${scrollPresetById(interaction.scrollPreset).label}`;
  }
  return event;
}

export function createSetVariantAction(
  id: string,
  targetLayerId = '',
  variantId = '',
): Extract<InteractionAction, { type: 'set-variant' }> {
  return { id, type: 'set-variant', targetLayerId, variantId };
}

export function createOverlayAction(
  id: string,
  operation: 'open' | 'close',
  targetLayerId = '',
  placement: OverlayPlacement = 'fixed',
): Extract<InteractionAction, { type: 'overlay' }> {
  return {
    id,
    type: 'overlay',
    operation,
    targetLayerId,
    placement,
    dismiss: { ...DEFAULT_OVERLAY_DISMISS },
  };
}

export function createNavigateAction(
  id: string,
  destination: 'page' | 'url' = 'page',
): Extract<InteractionAction, { type: 'navigate' }> {
  return { id, type: 'navigate', destination, openInNewTab: false };
}

export function createScrollToAction(
  id: string,
  target: 'layer' | 'page' = 'layer',
): Extract<InteractionAction, { type: 'scroll-to' }> {
  return {
    id,
    type: 'scroll-to',
    target,
    targetLayerId: '',
    position: 'top',
  };
}

export function createSetVariableAction(
  id: string,
  variableId = '',
  value = '',
): Extract<InteractionAction, { type: 'set-variable' }> {
  return { id, type: 'set-variable', variableId, value };
}

/** Where a Scroll to action should move. A layer with no id does not scroll. */
export function scrollToPlan(
  action: Extract<InteractionAction, { type: 'scroll-to' }>,
): { target: 'layer'; layerId: string } | { target: 'page'; position: 'top' | 'bottom' } | null {
  if (action.target === 'page') {
    return { target: 'page', position: action.position === 'bottom' ? 'bottom' : 'top' };
  }
  if (!action.targetLayerId || action.targetLayerId === 'body') return null;
  return { target: 'layer', layerId: action.targetLayerId };
}

/** Project variable write. Missing id is a no-op. */
export function variableAssignment(
  action: Extract<InteractionAction, { type: 'set-variable' }>,
): { variableId: string; value: string } | null {
  if (!action.variableId) return null;
  return { variableId: action.variableId, value: action.value ?? '' };
}

export function createScrollVariantAction(
  id: string,
  targetLayerId = '',
): Extract<InteractionAction, { type: 'scroll-variant' }> {
  return {
    id,
    type: 'scroll-variant',
    targetLayerId,
    stops: [
      { at: 0, variantId: '' },
      { at: 1, variantId: '' },
    ],
  };
}

export function upsertInteractionAction(
  interaction: LayerInteraction,
  action: InteractionAction,
): LayerInteraction {
  const actions = interaction.actions ?? [];
  const exists = actions.some(item => item.id === action.id);
  return {
    ...interaction,
    actions: exists
      ? actions.map(item => (item.id === action.id ? action : item))
      : [...actions, action],
  };
}

export function removeInteractionAction(
  interaction: LayerInteraction,
  actionId: string,
): LayerInteraction {
  return {
    ...interaction,
    actions: (interaction.actions ?? []).filter(action => action.id !== actionId),
  };
}

const APPEAR_ON_LOAD: InteractionTween['apply_styles'] = {
  autoAlpha: 'on-load',
  y: 'on-load',
  scale: 'on-load',
};

export function createAppearTween(
  layerId: string,
  presetId: AppearPresetId,
  tweenId: string,
): InteractionTween {
  const preset = appearPresetById(presetId);
  return {
    id: tweenId,
    layer_id: layerId,
    position: 0,
    duration: preset.duration,
    ease: preset.ease,
    from: { ...preset.from },
    to: { ...preset.to },
    apply_styles: { ...APPEAR_ON_LOAD },
  };
}

/**
 * Apply an Appear preset to the trigger layer. Tweens on other layers stay.
 * The preset tween is what the existing GSAP track plays.
 */
export function withAppearPreset(
  interaction: LayerInteraction,
  layerId: string,
  presetId: AppearPresetId,
  tweenId: string,
): LayerInteraction {
  const kept = (interaction.tweens || []).filter(tween => tween.layer_id !== layerId);
  return {
    ...interaction,
    appearPreset: presetId,
    tweens: [...kept, createAppearTween(layerId, presetId, tweenId)],
  };
}

export interface ScrollPreset {
  id: ScrollPresetId;
  label: string;
  from: TweenProperties;
  to: TweenProperties;
  duration: number;
  ease: string;
}

/** Presets for a Scroll event. The tween scrubs with the viewport. */
export const SCROLL_PRESETS: readonly ScrollPreset[] = [
  {
    id: 'fade',
    label: 'Fade',
    from: { autoAlpha: '0' },
    to: { autoAlpha: '1' },
    duration: 0.6,
    ease: 'none',
  },
  {
    id: 'slide-up',
    label: 'Slide up',
    from: { autoAlpha: '0', y: '48px' },
    to: { autoAlpha: '1', y: '0px' },
    duration: 0.6,
    ease: 'none',
  },
  {
    id: 'scale',
    label: 'Scale',
    from: { autoAlpha: '0', scale: '0.94' },
    to: { autoAlpha: '1', scale: '1' },
    duration: 0.6,
    ease: 'none',
  },
  {
    id: 'parallax',
    label: 'Parallax',
    from: { y: '64px' },
    to: { y: '-64px' },
    duration: 1,
    ease: 'none',
  },
];

export function scrollPresetById(id: ScrollPresetId): ScrollPreset {
  return SCROLL_PRESETS.find(preset => preset.id === id) ?? SCROLL_PRESETS[0];
}

/**
 * Apply a Scroll preset to the trigger layer. Other layers' tweens stay.
 * Scrub stays on when the event already has one.
 */
export function withScrollPreset(
  interaction: LayerInteraction,
  layerId: string,
  presetId: ScrollPresetId,
  tweenId: string,
): LayerInteraction {
  const preset = scrollPresetById(presetId);
  const kept = (interaction.tweens || []).filter(tween => tween.layer_id !== layerId);
  return {
    ...interaction,
    scrollPreset: presetId,
    timeline: {
      ...interaction.timeline,
      scrub: interaction.timeline?.scrub ?? 1,
      scrollStart: interaction.timeline?.scrollStart ?? 'top bottom',
      scrollEnd: interaction.timeline?.scrollEnd ?? 'bottom top',
    },
    tweens: [...kept, {
      id: tweenId,
      layer_id: layerId,
      position: 0,
      duration: preset.duration,
      ease: preset.ease,
      from: { ...preset.from },
      to: { ...preset.to },
      apply_styles: { autoAlpha: 'on-load', y: 'on-load', scale: 'on-load' },
    }],
  };
}

/**
 * Variant active at a scroll progress in 0–1. The latest stop at or before
 * the progress wins. Stops without a variant are skipped.
 */
export function variantForScrollProgress(
  stops: Array<{ at: number; variantId: string }>,
  progress: number,
): string | undefined {
  if (!stops.length) return undefined;
  const clamped = Math.min(1, Math.max(0, progress));
  const sorted = [...stops].sort((a, b) => a.at - b.at);
  let chosen: string | undefined;
  for (const stop of sorted) {
    if (!stop.variantId) continue;
    if (clamped + 1e-9 >= stop.at) chosen = stop.variantId;
  }
  return chosen;
}

/**
 * Progress of an element moving through the viewport.
 * 0 when its top meets the bottom edge, 1 when its bottom meets the top edge.
 */
export function scrollProgressThroughViewport(
  top: number,
  height: number,
  viewportHeight: number,
): number {
  if (viewportHeight <= 0) return 0;
  const start = viewportHeight;
  const end = -Math.max(0, height);
  const span = start - end;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (start - top) / span));
}

/** Insert a stop in the largest gap, including the gaps before 0 and after 1. */
export function nextScrollStop(stops: Array<{ at: number }>): number {
  if (stops.length === 0) return 0;
  const sorted = [...stops].map(stop => stop.at).sort((a, b) => a - b);
  let bestGap = sorted[0] - 0;
  let at = sorted[0] / 2;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const gap = sorted[index + 1] - sorted[index];
    if (gap > bestGap) {
      bestGap = gap;
      at = (sorted[index] + sorted[index + 1]) / 2;
    }
  }
  const tail = 1 - sorted[sorted.length - 1];
  if (tail > bestGap) at = (sorted[sorted.length - 1] + 1) / 2;
  return Math.round(at * 100) / 100;
}

export function hrefForPage(page: { slug: string; is_index?: boolean }): string {
  if (page.is_index || page.slug === '' || page.slug === '/') return '/';
  const slug = page.slug.replace(/^\/+/, '');
  return slug ? `/${slug}` : '/';
}

export function resolveNavigateHref(
  action: Extract<InteractionAction, { type: 'navigate' }>,
): string | null {
  const href = action.href?.trim();
  return href ? href : null;
}

export function dismissOnEscape(dismiss: OverlayDismiss, key: string): boolean {
  return dismiss.escape && (key === 'Escape' || key === 'Esc');
}

export function dismissOnPointer(
  dismiss: OverlayDismiss,
  hit: 'overlay' | 'trigger' | 'outside',
): boolean {
  return dismiss.outside && hit === 'outside';
}

export function focusAfterClose(dismiss: OverlayDismiss): boolean {
  return dismiss.restoreFocus;
}

/** Fixed covers the viewport and centers the layer. Relative sits under the trigger. */
export function overlayPlacementStyle(
  placement: OverlayPlacement,
  anchor?: { bottom: number; left: number },
): Record<string, string> {
  if (placement === 'fixed') {
    return {
      display: 'flex',
      position: 'fixed',
      top: '0px',
      right: '0px',
      bottom: '0px',
      left: '0px',
      zIndex: '60',
      alignItems: 'center',
      justifyContent: 'center',
    };
  }
  return {
    display: 'block',
    position: 'fixed',
    top: `${anchor?.bottom ?? 0}px`,
    left: `${anchor?.left ?? 0}px`,
    zIndex: '60',
  };
}

/** Hover end closes overlays that this event opened. Other actions stay put. */
export function actionsOnHoverLeave(actions: InteractionAction[] | undefined): InteractionAction[] {
  if (!actions) return [];
  return actions
    .filter((action): action is Extract<InteractionAction, { type: 'overlay' }> => (
      action.type === 'overlay' && action.operation === 'open'
    ))
    .map(action => ({ ...action, operation: 'close' }));
}

export function actionsForRun(
  actions: InteractionAction[] | undefined,
  mode: 'event' | 'scroll',
): InteractionAction[] {
  const list = actions ?? [];
  if (mode === 'scroll') return list.filter(action => action.type === 'scroll-variant');
  return list.filter(action => action.type !== 'scroll-variant');
}

export function remapActionTarget(
  action: InteractionAction,
  mapId: (id: string) => string,
): InteractionAction {
  switch (action.type) {
    case 'set-variant':
    case 'overlay':
    case 'scroll-variant':
      return { ...action, targetLayerId: mapId(action.targetLayerId) };
    case 'scroll-to':
      return action.targetLayerId
        ? { ...action, targetLayerId: mapId(action.targetLayerId) }
        : action;
    case 'set-variable':
    case 'navigate':
      return action;
    default:
      return action;
  }
}

/** Remap tween and action targets. The interaction id is left unchanged. */
export function remapInteractionTargets(
  interaction: LayerInteraction,
  mapId: (id: string) => string,
): LayerInteraction {
  return {
    ...interaction,
    tweens: (interaction.tweens || []).map(tween => ({
      ...tween,
      layer_id: mapId(tween.layer_id),
    })),
    actions: interaction.actions?.map(action => remapActionTarget(action, mapId)),
  };
}

/**
 * Component-root interactions are copied onto the instance. Targets inside
 * the component are namespaced with the instance id. The root layer itself
 * keeps the instance id.
 */
export function remapComponentRootInteraction(
  interaction: LayerInteraction,
  instanceId: string,
  rootId: string,
): LayerInteraction {
  const mapId = (id: string) => (id === rootId ? instanceId : `${instanceId}-${id}`);
  return {
    ...remapInteractionTargets(interaction, mapId),
    id: `${instanceId}-${interaction.id}`,
  };
}

/**
 * Page-level actions on a component instance survive resolution.
 * Component-authored interactions stay when the instance has none.
 */
export function mergeLayerInteractions(
  componentInteractions: LayerInteraction[] | undefined,
  instanceInteractions: LayerInteraction[] | undefined,
): LayerInteraction[] | undefined {
  const instance = instanceInteractions ?? [];
  if (instance.length === 0) return componentInteractions;
  const component = componentInteractions ?? [];
  if (component.length === 0) return instanceInteractions;
  return [...component, ...instance];
}

export function overlayOpenTargets(layers: Layer[]): string[] {
  const ids: string[] = [];
  const walk = (list: Layer[]) => {
    for (const layer of list) {
      for (const interaction of layer.interactions ?? []) {
        for (const action of interaction.actions ?? []) {
          if (
            action.type === 'overlay'
            && action.operation === 'open'
            && action.targetLayerId
            && action.targetLayerId !== 'body'
          ) {
            ids.push(action.targetLayerId);
          }
        }
      }
      if (layer.children?.length) walk(layer.children);
    }
  };
  walk(layers);
  return ids;
}

export function flattenLayers(layers: Layer[]): Layer[] {
  const list: Layer[] = [];
  const walk = (nodes: Layer[]) => {
    for (const layer of nodes) {
      list.push(layer);
      if (layer.children?.length) walk(layer.children);
    }
  };
  walk(layers);
  return list;
}

export interface VariantTarget {
  layerId: string;
  componentId: string;
  componentName: string;
  variants: Array<{ id: string; name: string }>;
}

export function variantTargets(
  layers: Layer[],
  components: Array<{ id: string; name: string; variants?: Array<{ id: string; name: string }> }>,
): VariantTarget[] {
  const byId = new Map(components.map(component => [component.id, component]));
  const targets: VariantTarget[] = [];
  for (const layer of flattenLayers(layers)) {
    if (!layer.componentId) continue;
    const component = byId.get(layer.componentId);
    if (!component) continue;
    targets.push({
      layerId: layer.id,
      componentId: component.id,
      componentName: component.name,
      variants: (component.variants ?? []).map(variant => ({ id: variant.id, name: variant.name })),
    });
  }
  return targets;
}
