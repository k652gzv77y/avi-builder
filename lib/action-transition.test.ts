import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cssEasing,
  isInstantTransition,
  motionSpec,
  normalizeTransition,
  sampleSpring,
  springTransition,
  transitionForVariantChange,
  tweenTransition,
  withActionTransition,
} from '@/lib/action-transition';
import { playMotion, playOverlayEnter } from '@/lib/action-transition-playback';
import { dragVariantChoices } from '@/lib/drag-gesture';
import {
  playInteraction,
  previewVariantGesture,
  releaseInteraction,
  resetInteractiveVariants,
} from '@/lib/interaction-runtime';
import { createSetVariantAction } from '@/lib/interactions-framer';
import { emptyVariantSession } from '@/lib/interactive-variants';
import { useInteractionPreviewStore } from '@/stores/useInteractionPreviewStore';
import type { ActionTransition, LayerInteraction } from '@/types';

const doc = { querySelector: () => null } as unknown as Document;

function event(trigger: LayerInteraction['trigger'], action: LayerInteraction['actions']): LayerInteraction {
  return {
    id: 'int',
    trigger,
    timeline: { breakpoints: ['desktop'], repeat: 0, yoyo: false },
    tweens: [],
    actions: action,
  };
}

test('a missing transition stays immediate and a spring does not', () => {
  assert.equal(isInstantTransition(undefined), true);
  assert.equal(isInstantTransition(normalizeTransition({ kind: 'instant' })), true);
  assert.equal(motionSpec(undefined), null);

  const tween = tweenTransition();
  tween.duration = 0;
  tween.stagger = 0;
  assert.equal(isInstantTransition(tween), true);
  assert.equal(motionSpec(tween), null);

  tween.stagger = 0.1;
  assert.equal(isInstantTransition(tween), false);
  assert.equal(motionSpec(tween)?.staggerMs, 100);

  const spring = springTransition();
  assert.equal(isInstantTransition(spring), false);
  const spec = motionSpec(spring);
  assert.ok(spec);
  assert.equal(spec.easing, 'linear');
  assert.ok(spec.keyframes && spec.keyframes.length > 2);
  assert.equal(spec.keyframes[0]?.value, 0);
  assert.equal(spec.keyframes[spec.keyframes.length - 1]?.value, 1);
  assert.equal(spec.keyframes[spec.keyframes.length - 1]?.offset, 1);
});

test('easing names and a custom cubic-bezier clamp into a CSS curve', () => {
  const tween = tweenTransition();
  assert.equal(cssEasing(tween), 'ease-out');
  tween.curve = 'linear';
  assert.equal(cssEasing(tween), 'linear');
  tween.curve = 'cubic-bezier';
  tween.bezier = [1.4, 3, -0.2, -3];
  assert.equal(cssEasing(tween), 'cubic-bezier(1, 2, 0, -2)');
  const wild = normalizeTransition({ ...tween, duration: 40, delay: -1, stagger: 9 });
  assert.equal(wild.duration, 10);
  assert.equal(wild.delay, 0);
  assert.equal(wild.stagger, 2);
});

test('a stiffer spring settles before a soft one', () => {
  const stiff = sampleSpring({ stiffness: 400, damping: 30, mass: 1 });
  const soft = sampleSpring({ stiffness: 40, damping: 6, mass: 1 });
  assert.ok(stiff.durationMs < soft.durationMs);
  assert.ok(stiff.durationMs < 1500);
  assert.equal(stiff.frames[0]?.offset, 0);
  assert.equal(stiff.frames[stiff.frames.length - 1]?.value, 1);
  const offsets = stiff.frames.map(frame => frame.offset);
  const sorted = [...offsets].sort((a, b) => a - b);
  assert.deepEqual(offsets, sorted);
});

test('playMotion turns spring progress into opacity keyframes', () => {
  const animations: Array<{ keyframes: Array<{ opacity: number; offset: number }> }> = [];
  const element = {
    animate(keyframes: Array<{ opacity: number; offset: number }>) {
      const record = {
        keyframes,
        onfinish: null as (() => void) | null,
        oncancel: null as (() => void) | null,
        cancel() {
          this.oncancel?.();
        },
      };
      animations.push(record);
      return record;
    },
  };
  const spec = motionSpec(springTransition());
  assert.ok(spec);
  playMotion(element as unknown as HTMLElement, 0, 1, spec);
  const frames = animations[0]?.keyframes ?? [];
  assert.equal(frames[0]?.opacity, 0);
  assert.equal(frames[frames.length - 1]?.opacity, 1);
  assert.equal(frames[frames.length - 1]?.offset, 1);
});

test('overlay enter staggers each direct child after the root', () => {
  const animations: Array<{ options: { delay?: number; duration?: number } }> = [];
  const make = () => {
    const element: {
      nodeType: number;
      children: unknown[];
      ownerDocument: { defaultView: null };
      animate: (keyframes: unknown, options: { delay?: number; duration?: number }) => { onfinish: null; oncancel: null; cancel: () => void };
    } = {
      nodeType: 1,
      children: [],
      ownerDocument: { defaultView: null },
      animate(_keyframes, options) {
        const record = {
          options,
          onfinish: null,
          oncancel: null,
          cancel() {},
        };
        animations.push(record);
        return record;
      },
    };
    return element;
  };
  const child = make();
  const overlay = make();
  overlay.children = [child];
  const spec = motionSpec({ ...tweenTransition(), duration: 0.3, stagger: 0.2 });
  assert.ok(spec);
  playOverlayEnter(overlay as unknown as HTMLElement, null, spec);
  assert.equal(animations[0]?.options.duration, 300);
  assert.equal(animations[0]?.options.delay, 0);
  assert.equal(animations[1]?.options.delay, 200);
});

test('the leaving gesture owns the return, and the same variant does not replay', () => {
  const hover = tweenTransition();
  const press = springTransition();
  const base = { ...tweenTransition(), duration: 0.6 };
  const resting = emptyVariantSession();
  const hovering = { ...resting, hover: 'open' };
  const pressing = { ...hovering, press: 'down' };
  const slots = { hover, press, base };

  assert.equal(transitionForVariantChange(resting, hovering, slots), hover);
  assert.equal(transitionForVariantChange(hovering, resting, slots), hover);
  assert.equal(transitionForVariantChange(hovering, pressing, slots), press);
  assert.equal(transitionForVariantChange(pressing, hovering, slots), press);
  assert.equal(transitionForVariantChange(resting, { ...resting, base: 'open' }, slots)?.duration, 0.6);
  assert.equal(transitionForVariantChange(hovering, hovering, slots), null);
  assert.equal(transitionForVariantChange(resting, hovering, {}), null);
});

test('instant drops the stored transition and a tween keeps it', () => {
  const action = createSetVariantAction('act', 'card', 'open');
  assert.equal(withActionTransition(action, undefined), action);
  const cleared = withActionTransition({ ...action, transition: tweenTransition() }, undefined);
  assert.equal(cleared.transition, undefined);
  const saved = withActionTransition(action, tweenTransition());
  assert.equal(saved.transition?.kind, 'tween');
  assert.equal(saved.transition?.duration, 0.3);
});

test('drag-to-variant keeps the authored transition on the winning threshold', () => {
  const action = createSetVariantAction('act', 'card', 'open', {
    direction: 'right',
    distance: 20,
    release: 'return',
  });
  action.transition = tweenTransition();
  const [choice] = dragVariantChoices({ x: 30, y: 0 }, [action]);
  assert.equal(choice?.variantId, 'open');
  assert.equal(choice?.release, 'return');
  assert.equal(choice?.transition?.curve, 'ease-out');
});

test('hover set-variant publishes the transition and replays it when the pointer leaves', () => {
  resetInteractiveVariants();
  const action = createSetVariantAction('act', 'card', 'open');
  action.transition = tweenTransition();
  const interaction = event('hover', [action]);
  playInteraction(doc, interaction, null, { live: true });
  const entered = useInteractionPreviewStore.getState();
  assert.equal(entered.variantByLayerId.card, 'open');
  assert.equal(entered.playbackByLayerId.card?.transition.duration, 0.3);
  const enterToken = entered.playbackByLayerId.card?.token;

  releaseInteraction(doc, interaction, null, { live: true });
  const left = useInteractionPreviewStore.getState();
  assert.equal(left.variantByLayerId.card, undefined);
  assert.notEqual(left.playbackByLayerId.card?.token, enterToken);
  assert.equal(left.playbackByLayerId.card?.transition.kind, 'tween');
  resetInteractiveVariants();
});

test('an action without a transition does not publish playback', () => {
  resetInteractiveVariants();
  const interaction = event('hover', [createSetVariantAction('act', 'card', 'open')]);
  playInteraction(doc, interaction, null, { live: true });
  assert.equal(useInteractionPreviewStore.getState().variantByLayerId.card, 'open');
  assert.equal(useInteractionPreviewStore.getState().playbackByLayerId.card, undefined);
  releaseInteraction(doc, interaction, null, { live: true });
  assert.equal(useInteractionPreviewStore.getState().variantByLayerId.card, undefined);
  assert.equal(useInteractionPreviewStore.getState().playbackByLayerId.card, undefined);
  resetInteractiveVariants();
});

test('drag return replays the transition and keep does not replay the same variant', () => {
  resetInteractiveVariants();
  const transition: ActionTransition = tweenTransition();
  previewVariantGesture(doc, 'card', { type: 'set', gesture: 'drag', variantId: 'open', transition });
  const entered = useInteractionPreviewStore.getState().playbackByLayerId.card?.token;
  previewVariantGesture(doc, 'card', { type: 'end', gesture: 'drag' });
  const returned = useInteractionPreviewStore.getState();
  assert.equal(returned.variantByLayerId.card, undefined);
  assert.notEqual(returned.playbackByLayerId.card?.token, entered);

  resetInteractiveVariants();
  previewVariantGesture(doc, 'card', { type: 'set', gesture: 'drag', variantId: 'open', transition });
  const shown = useInteractionPreviewStore.getState().playbackByLayerId.card?.token;
  previewVariantGesture(doc, 'card', { type: 'set', gesture: 'sticky', variantId: 'open', transition });
  previewVariantGesture(doc, 'card', { type: 'end', gesture: 'drag' });
  const kept = useInteractionPreviewStore.getState();
  assert.equal(kept.variantByLayerId.card, 'open');
  assert.equal(kept.playbackByLayerId.card?.token, shown);
  resetInteractiveVariants();
});
