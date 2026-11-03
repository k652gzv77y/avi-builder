/**
 * Author-facing motion for Set Variant and overlay actions.
 * Omitted transitions stay immediate, so existing projects do not move
 * until someone edits one. Springs sample a damped oscillator. Tweens
 * map onto CSS easing, including a custom cubic-bezier.
 */

import { activeVariantId, type VariantSession } from '@/lib/interactive-variants';
import type {
  ActionTransition,
  TransitionCurve,
  TransitionKind,
  TransitionSpring,
} from '@/types';

export const DEFAULT_TWEEN_DURATION = 0.3;

export const DEFAULT_SPRING: TransitionSpring = {
  stiffness: 400,
  damping: 30,
  mass: 1,
};

/** A soft ease-out curve for the custom bezier control. */
export const DEFAULT_BEZIER: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const TRANSITION_CURVES: ReadonlyArray<{ value: TransitionCurve; label: string }> = [
  { value: 'ease', label: 'Ease' },
  { value: 'ease-in', label: 'Ease in' },
  { value: 'ease-out', label: 'Ease out' },
  { value: 'ease-in-out', label: 'Ease in out' },
  { value: 'linear', label: 'Linear' },
  { value: 'cubic-bezier', label: 'Cubic bezier' },
];

const CURVE_EASING: Record<Exclude<TransitionCurve, 'cubic-bezier'>, string> = {
  ease: 'ease',
  'ease-in': 'ease-in',
  'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out',
  linear: 'linear',
};

const MAX_DELAY_SECONDS = 10;
const MAX_DURATION_SECONDS = 10;
const MAX_STAGGER_SECONDS = 2;
const SPRING_STEP_SECONDS = 1 / 240;
const SPRING_FRAME_SECONDS = 1 / 60;
const SPRING_MAX_SECONDS = 4;

export type VariantMotionSlot = 'base' | 'hover' | 'press' | 'drag';

export type VariantMotionSlots = Partial<Record<VariantMotionSlot, ActionTransition | null | undefined>>;

/** Progress samples for a spring, from 0 at rest toward 1. */
export interface SpringSamples {
  durationMs: number;
  frames: ReadonlyArray<{ offset: number; value: number }>;
}

/**
 * Playback description. `keyframes` is set for a spring (easing stays linear
 * between samples). Tweens leave it empty and use `easing`.
 */
export interface MotionSpec {
  durationMs: number;
  delayMs: number;
  staggerMs: number;
  easing: string;
  keyframes: ReadonlyArray<{ offset: number; value: number }> | null;
}

export function tweenTransition(): ActionTransition {
  return {
    kind: 'tween',
    duration: DEFAULT_TWEEN_DURATION,
    delay: 0,
    curve: 'ease-out',
    bezier: [...DEFAULT_BEZIER],
    spring: { ...DEFAULT_SPRING },
    stagger: 0,
  };
}

export function springTransition(): ActionTransition {
  return {
    kind: 'spring',
    duration: DEFAULT_TWEEN_DURATION,
    delay: 0,
    curve: 'ease-out',
    bezier: [...DEFAULT_BEZIER],
    spring: { ...DEFAULT_SPRING },
    stagger: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return clamp(number, min, max);
}

function readCurve(value: unknown): TransitionCurve {
  if (value === 'ease' || value === 'ease-in' || value === 'ease-out' || value === 'ease-in-out' || value === 'linear' || value === 'cubic-bezier') {
    return value;
  }
  return 'ease-out';
}

function readBezier(value: unknown): [number, number, number, number] {
  const source = Array.isArray(value) ? value : DEFAULT_BEZIER;
  const x1 = readNumber(source[0], DEFAULT_BEZIER[0], 0, 1);
  const y1 = readNumber(source[1], DEFAULT_BEZIER[1], -2, 2);
  const x2 = readNumber(source[2], DEFAULT_BEZIER[2], 0, 1);
  const y2 = readNumber(source[3], DEFAULT_BEZIER[3], -2, 2);
  return [x1, y1, x2, y2];
}

function readSpring(value: unknown): TransitionSpring {
  const source = value && typeof value === 'object' ? value as Partial<TransitionSpring> : DEFAULT_SPRING;
  return {
    stiffness: readNumber(source.stiffness, DEFAULT_SPRING.stiffness, 1, 10000),
    damping: readNumber(source.damping, DEFAULT_SPRING.damping, 0, 1000),
    mass: readNumber(source.mass, DEFAULT_SPRING.mass, 0.01, 100),
  };
}

function readKind(value: unknown, fallback: TransitionKind): TransitionKind {
  if (value === 'instant' || value === 'tween' || value === 'spring') return value;
  return fallback;
}

/** Fill missing fields and clamp numbers so a stored transition cannot run away. */
export function normalizeTransition(
  value: Partial<ActionTransition> | null | undefined,
  kind?: TransitionKind,
): ActionTransition {
  const resolvedKind = readKind(kind ?? value?.kind, 'tween');
  const fallback = resolvedKind === 'spring' ? springTransition() : tweenTransition();
  return {
    kind: resolvedKind,
    duration: readNumber(value?.duration, fallback.duration, 0, MAX_DURATION_SECONDS),
    delay: readNumber(value?.delay, fallback.delay, 0, MAX_DELAY_SECONDS),
    curve: readCurve(value?.curve ?? fallback.curve),
    bezier: readBezier(value?.bezier ?? fallback.bezier),
    spring: readSpring(value?.spring ?? fallback.spring),
    stagger: readNumber(value?.stagger, fallback.stagger, 0, MAX_STAGGER_SECONDS),
  };
}

/**
 * A missing transition, Instant, or a tween with no duration and no stagger
 * plays nothing. A spring always moves, because its duration comes from physics.
 */
export function isInstantTransition(transition: ActionTransition | null | undefined): boolean {
  if (!transition || transition.kind === 'instant') return true;
  if (transition.kind === 'spring') return false;
  if (transition.kind !== 'tween') return true;
  return !(transition.duration > 0) && !(transition.stagger > 0);
}

/** Keep a tween or spring on the action. Instant removes the field. */
export function withActionTransition<T extends { transition?: ActionTransition }>(
  action: T,
  transition: ActionTransition | undefined,
): T {
  if (!transition || transition.kind === 'instant') {
    if (action.transition === undefined) return action;
    const next = { ...action };
    delete next.transition;
    return next;
  }
  return { ...action, transition: normalizeTransition(transition, transition.kind) };
}

export function readSeconds(raw: string, max = MAX_DURATION_SECONDS): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return clamp(Math.round(value * 1000) / 1000, 0, max);
}

export function readBezierComponent(raw: string, axis: 'x' | 'y'): number | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 1000) / 1000;
  return axis === 'x' ? clamp(rounded, 0, 1) : clamp(rounded, -2, 2);
}

export function cssEasing(transition: ActionTransition): string {
  if (transition.curve === 'cubic-bezier') {
    const [x1, y1, x2, y2] = readBezier(transition.bezier);
    const format = (value: number) => String(Math.round(value * 1000) / 1000);
    return `cubic-bezier(${format(x1)}, ${format(y1)}, ${format(x2)}, ${format(y2)})`;
  }
  return CURVE_EASING[transition.curve] ?? 'ease';
}

/**
 * Integrate a damped spring from 0 toward 1.
 * Samples are clamped for opacity. A stiffer spring settles sooner.
 */
export function sampleSpring(spring: TransitionSpring): SpringSamples {
  const stiffness = readNumber(spring.stiffness, DEFAULT_SPRING.stiffness, 1, 10000);
  const damping = readNumber(spring.damping, DEFAULT_SPRING.damping, 0, 1000);
  const mass = readNumber(spring.mass, DEFAULT_SPRING.mass, 0.01, 100);
  let position = 0;
  let velocity = 0;
  let time = 0;
  let sinceFrame = 0;
  const samples: Array<{ time: number; value: number }> = [{ time: 0, value: 0 }];

  while (time < SPRING_MAX_SECONDS) {
    const acceleration = (-stiffness * (position - 1) - damping * velocity) / mass;
    velocity += acceleration * SPRING_STEP_SECONDS;
    position += velocity * SPRING_STEP_SECONDS;
    time += SPRING_STEP_SECONDS;
    sinceFrame += SPRING_STEP_SECONDS;
    const settled = Math.abs(1 - position) < 0.002 && Math.abs(velocity) < 0.02;
    if (sinceFrame < SPRING_FRAME_SECONDS - 1e-8 && !settled) continue;
    samples.push({ time, value: clamp(position, 0, 1) });
    sinceFrame = 0;
    if (settled) break;
  }

  const duration = Math.max(samples[samples.length - 1]?.time ?? SPRING_FRAME_SECONDS, SPRING_FRAME_SECONDS);
  const frames: Array<{ offset: number; value: number }> = [];
  for (const sample of samples) {
    const offset = Math.min(1, sample.time / duration);
    const last = frames[frames.length - 1];
    if (last && Math.abs(last.offset - offset) < 0.0001) {
      last.value = sample.value;
      continue;
    }
    frames.push({ offset, value: sample.value });
  }
  const last = frames[frames.length - 1];
  if (last) {
    last.offset = 1;
    last.value = 1;
  } else {
    frames.push({ offset: 0, value: 0 }, { offset: 1, value: 1 });
  }
  if (frames[0] && frames[0].offset !== 0) frames.unshift({ offset: 0, value: 0 });

  return {
    durationMs: Math.max(16, Math.round(duration * 1000)),
    frames,
  };
}

/** Null when the change should stay immediate. */
export function motionSpec(transition: ActionTransition | null | undefined): MotionSpec | null {
  if (isInstantTransition(transition) || !transition) return null;
  const normalized = normalizeTransition(transition, transition.kind);
  const delayMs = Math.round(normalized.delay * 1000);
  const staggerMs = Math.round(normalized.stagger * 1000);
  if (normalized.kind === 'spring') {
    const spring = sampleSpring(normalized.spring);
    return {
      durationMs: spring.durationMs,
      delayMs,
      staggerMs,
      easing: 'linear',
      keyframes: spring.frames,
    };
  }
  const durationMs = Math.max(16, Math.round(normalized.duration * 1000));
  return {
    durationMs,
    delayMs,
    staggerMs,
    easing: cssEasing(normalized),
    keyframes: null,
  };
}

function winningSlot(session: VariantSession): VariantMotionSlot | null {
  if (session.press) return 'press';
  if (session.drag) return 'drag';
  if (session.hover) return 'hover';
  if (session.base) return 'base';
  return null;
}

/**
 * Which stored transition should play for this variant change.
 * The gesture that was showing plays when it leaves. A new gesture plays
 * its own. The same visible variant plays nothing, so a drag that keeps
 * the variant does not replay on release.
 */
export function transitionForVariantChange(
  before: VariantSession,
  after: VariantSession,
  slots: VariantMotionSlots,
): ActionTransition | null {
  if (activeVariantId(before) === activeVariantId(after)) return null;
  const from = winningSlot(before);
  const to = winningSlot(after);
  const fromChanged = from != null && before[from] !== after[from];
  const candidate = fromChanged ? from : to;
  if (!candidate) return null;
  const transition = slots[candidate] ?? null;
  if (!transition || isInstantTransition(transition)) return null;
  return transition;
}

export function variantMotionSlot(gesture: 'hover' | 'press' | 'drag' | 'sticky'): VariantMotionSlot {
  if (gesture === 'sticky') return 'base';
  return gesture;
}
