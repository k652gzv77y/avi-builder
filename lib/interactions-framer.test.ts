import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { InteractionAction, Layer, LayerInteraction } from '@/types';
import {
  EVENT_LABELS,
  actionEffects,
  actionsForRun,
  actionsOnHoverLeave,
  authorLayerInteraction,
  canonicalKey,
  createAppearTween,
  createLayerInteraction,
  createNavigateAction,
  createOverlayAction,
  createScrollToAction,
  createScrollVariantAction,
  createSetVariableAction,
  createSetVariantAction,
  dismissOnEscape,
  dismissOnPointer,
  focusAfterClose,
  formatKeyboardCombo,
  formatKeyLabel,
  hrefForPage,
  interactionSummary,
  keyFromKeyboardEvent,
  keyboardEventMatches,
  keyboardShouldFire,
  mergeLayerInteractions,
  nextScrollStop,
  overlayOpenTargets,
  overlayPlacementStyle,
  parseLayerInteractions,
  remapActionTarget,
  remapComponentRootInteraction,
  removeInteractionAction,
  removeLayerInteraction,
  resolveNavigateHref,
  scrollToPlan,
  scrollProgressThroughViewport,
  timerSchedule,
  serializeLayerInteractions,
  upsertInteractionAction,
  upsertLayerInteraction,
  variableAssignment,
  variantForScrollProgress,
  variantTargets,
  withAppearPreset,
  withKeyboard,
  withScrollPreset,
  withTimer,
} from '@/lib/interactions-framer';

function interaction(partial: Partial<LayerInteraction> = {}): LayerInteraction {
  return {
    id: 'int-1',
    trigger: 'click',
    timeline: { breakpoints: ['desktop'], repeat: 0, yoyo: false },
    tweens: [],
    ...partial,
  };
}

test('events use Framer labels and stay on the existing trigger ids', () => {
  assert.equal(EVENT_LABELS.click, 'Tap');
  assert.equal(EVENT_LABELS.hover, 'Hover');
  assert.equal(EVENT_LABELS.press, 'Press');
  assert.equal(EVENT_LABELS['scroll-into-view'], 'Appear');
  assert.equal(EVENT_LABELS['while-scrolling'], 'Scroll');
  assert.equal(EVENT_LABELS.load, 'Load');
  assert.equal(interactionSummary(interaction({
    actions: [createSetVariantAction('a1', 'lyr', 'var')],
  })), 'Tap → Set Variant');
});

test('actions can be added and removed without touching tweens', () => {
  const tween = {
    id: 'tw',
    layer_id: 'lyr',
    position: 0,
    duration: 0.3,
    ease: 'power1.out',
    from: {},
    to: {},
    apply_styles: {},
  };
  const base = interaction({ tweens: [tween] });
  const withAction = upsertInteractionAction(base, createNavigateAction('nav', 'url'));
  assert.equal(withAction.tweens.length, 1);
  assert.equal(withAction.actions?.length, 1);
  const replaced = upsertInteractionAction(withAction, {
    ...createNavigateAction('nav', 'url'),
    href: 'https://example.com',
  });
  assert.equal(replaced.actions?.length, 1);
  assert.equal(removeInteractionAction(replaced, 'nav').actions?.length, 0);
  assert.equal(removeInteractionAction(replaced, 'nav').tweens[0].id, 'tw');
});

test('scroll presets scrub a tween and replace the previous one', () => {
  const first = withScrollPreset(interaction({ trigger: 'while-scrolling' }), 'hero', 'fade', 'tw-1');
  assert.equal(first.scrollPreset, 'fade');
  assert.equal(first.timeline.scrub, 1);
  assert.equal(first.timeline.scrollStart, 'top bottom');
  assert.equal(first.tweens[0].from.autoAlpha, '0');
  assert.equal(interactionSummary(first), 'Scroll → Fade');

  const next = withScrollPreset(first, 'hero', 'parallax', 'tw-2');
  assert.equal(next.tweens.length, 1);
  assert.equal(next.tweens[0].id, 'tw-2');
  assert.equal(next.tweens[0].from.y, '64px');
  assert.equal(next.tweens[0].to.y, '-64px');
  assert.equal(next.timeline.scrub, 1);
});

test('appear presets write an on-load tween and replace the previous one', () => {
  const first = withAppearPreset(interaction({ trigger: 'scroll-into-view' }), 'hero', 'fade', 'tw-1');
  assert.equal(first.appearPreset, 'fade');
  assert.equal(first.tweens[0].from.autoAlpha, '0');
  assert.equal(first.tweens[0].to.autoAlpha, '1');
  assert.equal(first.tweens[0].apply_styles.autoAlpha, 'on-load');

  const other = {
    id: 'other',
    layer_id: 'caption',
    position: 0,
    duration: 0.2,
    ease: 'none',
    from: {},
    to: {},
    apply_styles: {},
  };
  const next = withAppearPreset(
    { ...first, tweens: [...first.tweens, other] },
    'hero',
    'slide-up',
    'tw-2',
  );
  assert.equal(next.tweens.length, 2);
  assert.equal(next.tweens.find(tween => tween.layer_id === 'hero')?.from.y, '24px');
  assert.equal(next.tweens.find(tween => tween.layer_id === 'caption')?.id, 'other');
  const scale = createAppearTween('hero', 'scale', 'tw-3');
  assert.equal(scale.from.scale, '0.92');
  assert.equal(scale.to.scale, '1');
});

test('scroll progress picks the active variant stop', () => {
  const stops = [
    { at: 0, variantId: 'closed' },
    { at: 0.5, variantId: '' },
    { at: 1, variantId: 'open' },
  ];
  assert.equal(variantForScrollProgress(stops, 0), 'closed');
  assert.equal(variantForScrollProgress(stops, 0.6), 'closed');
  assert.equal(variantForScrollProgress(stops, 1), 'open');
  assert.equal(variantForScrollProgress([], 0.4), undefined);
  assert.equal(scrollProgressThroughViewport(800, 200, 800), 0);
  assert.equal(scrollProgressThroughViewport(-200, 200, 800), 1);
  assert.ok(scrollProgressThroughViewport(300, 200, 800) > 0);
  assert.ok(scrollProgressThroughViewport(300, 200, 800) < 1);
});

test('scroll stops fill the largest gap', () => {
  assert.equal(nextScrollStop([]), 0);
  assert.equal(nextScrollStop([{ at: 0 }, { at: 1 }]), 0.5);
  assert.equal(nextScrollStop([{ at: 0 }, { at: 0.2 }]), 0.6);
});

test('navigate resolves a page path or a typed URL', () => {
  assert.equal(hrefForPage({ slug: 'about', is_index: false }), '/about');
  assert.equal(hrefForPage({ slug: 'home', is_index: true }), '/');
  assert.equal(hrefForPage({ slug: '' }), '/');
  const page = createNavigateAction('n1', 'page');
  assert.equal(resolveNavigateHref({ ...page, href: '/about' }), '/about');
  const url = createNavigateAction('n2', 'url');
  assert.equal(resolveNavigateHref({ ...url, href: '  https://avi.test  ' }), 'https://avi.test');
  assert.equal(resolveNavigateHref(url), null);
});

test('overlay dismiss honors escape, outside click, and focus return', () => {
  const dismiss = { escape: true, outside: true, restoreFocus: true };
  assert.equal(dismissOnEscape(dismiss, 'Escape'), true);
  assert.equal(dismissOnEscape({ ...dismiss, escape: false }, 'Escape'), false);
  assert.equal(dismissOnPointer(dismiss, 'outside'), true);
  assert.equal(dismissOnPointer(dismiss, 'overlay'), false);
  assert.equal(dismissOnPointer(dismiss, 'trigger'), false);
  assert.equal(dismissOnPointer({ ...dismiss, outside: false }, 'outside'), false);
  assert.equal(focusAfterClose(dismiss), true);
  assert.equal(focusAfterClose({ ...dismiss, restoreFocus: false }), false);

  assert.equal(overlayPlacementStyle('fixed').position, 'fixed');
  assert.equal(overlayPlacementStyle('fixed').display, 'flex');
  assert.equal(overlayPlacementStyle('fixed').top, '0px');
  const relative = overlayPlacementStyle('relative', { bottom: 40, left: 12 });
  assert.equal(relative.position, 'fixed');
  assert.equal(relative.top, '40px');
  assert.equal(relative.left, '12px');
  assert.equal(relative.display, 'block');
});

test('hover leave only closes overlays that the event opened', () => {
  const actions: InteractionAction[] = [
    createOverlayAction('o1', 'open', 'menu', 'relative'),
    createSetVariantAction('v1', 'card', 'open'),
    createNavigateAction('n1', 'page'),
  ];
  const leave = actionsOnHoverLeave(actions);
  assert.equal(leave.length, 1);
  assert.equal(leave[0].type, 'overlay');
  if (leave[0].type === 'overlay') assert.equal(leave[0].operation, 'close');
  assert.equal(actionsForRun(actions, 'event').some(action => action.type === 'scroll-variant'), false);
  assert.equal(actionsForRun([
    createScrollVariantAction('s1', 'card'),
    createSetVariantAction('v1', 'card', 'open'),
  ], 'scroll').length, 1);
});

test('component resolution keeps instance actions and remaps component targets', () => {
  const componentInteraction = interaction({
    id: 'root-int',
    actions: [createSetVariantAction('a1', 'root', 'open'), createOverlayAction('o1', 'open', 'panel')],
    tweens: [{
      id: 'tw',
      layer_id: 'panel',
      position: 0,
      duration: 0.2,
      ease: 'none',
      from: {},
      to: {},
      apply_styles: {},
    }],
  });
  const remapped = remapComponentRootInteraction(componentInteraction, 'inst', 'root');
  assert.equal(remapped.id, 'inst-root-int');
  assert.equal(remapped.tweens[0].layer_id, 'inst-panel');
  const setVariant = remapped.actions?.[0];
  const overlay = remapped.actions?.[1];
  assert.equal(setVariant && setVariant.type === 'set-variant' && setVariant.targetLayerId, 'inst');
  assert.equal(overlay && overlay.type === 'overlay' && overlay.targetLayerId, 'inst-panel');

  const navigate = remapActionTarget(createNavigateAction('n', 'url'), () => 'changed');
  assert.equal(navigate.type, 'navigate');

  const instance = interaction({
    id: 'page-int',
    actions: [createNavigateAction('go', 'page')],
  });
  const merged = mergeLayerInteractions([remapped], [instance]);
  assert.deepEqual(merged?.map(item => item.id), ['inst-root-int', 'page-int']);
  assert.equal(mergeLayerInteractions([remapped], undefined)?.[0].id, 'inst-root-int');
  assert.equal(mergeLayerInteractions(undefined, [instance])?.[0].id, 'page-int');
});

test('overlay targets and variant choices come from the layer tree', () => {
  const layers: Layer[] = [{
    id: 'body',
    name: 'body',
    classes: '',
    children: [{
      id: 'btn',
      name: 'button',
      classes: '',
      interactions: [interaction({
        actions: [
          createOverlayAction('o', 'open', 'sheet', 'fixed'),
          createOverlayAction('c', 'close', 'sheet'),
          createOverlayAction('bad', 'open', 'body'),
        ],
      })],
    }, {
      id: 'card',
      name: 'div',
      classes: '',
      componentId: 'comp-1',
    }],
  }];
  assert.deepEqual(overlayOpenTargets(layers), ['sheet']);
  const targets = variantTargets(layers, [{
    id: 'comp-1',
    name: 'Card',
    variants: [{ id: 'v1', name: 'Default' }, { id: 'v2', name: 'Open' }],
  }]);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].layerId, 'card');
  assert.deepEqual(targets[0].variants.map(variant => variant.name), ['Default', 'Open']);
});

test('tap navigate serializes on the layer and resolves the href', () => {
  const layer: Layer = { id: 'btn', name: 'button', classes: '' };
  const action: InteractionAction = {
    id: 'act-1',
    type: 'navigate',
    destination: 'page',
    pageId: 'page-2',
    href: '/about',
  };
  const next = authorLayerInteraction(layer, {
    interactionId: 'int-1',
    trigger: 'click',
    action,
  });

  assert.equal(layer.interactions, undefined);
  assert.equal(interactionSummary(next.interactions![0]), 'Tap → Navigate');
  assert.deepEqual(next.interactions![0].timeline.breakpoints, ['mobile', 'tablet', 'desktop']);

  const stored = parseLayerInteractions(serializeLayerInteractions(next.interactions));
  assert.equal(stored[0].trigger, 'click');
  assert.deepEqual(actionEffects(stored[0]), [{ type: 'navigate', href: '/about' }]);
  assert.equal(resolveNavigateHref(action), '/about');

  const edited = authorLayerInteraction(next, {
    interactionId: 'int-1',
    trigger: 'click',
    action: {
      id: 'act-1',
      type: 'navigate',
      destination: 'url',
      href: 'https://example.com',
    },
  });
  assert.equal(edited.interactions?.length, 1);
  assert.deepEqual(actionEffects(edited.interactions![0]), [{ type: 'navigate', href: 'https://example.com' }]);

  const cleared = upsertLayerInteraction(
    edited,
    removeInteractionAction(edited.interactions![0], 'act-1'),
  );
  assert.equal(cleared.interactions?.[0].actions?.length, 0);
  assert.deepEqual(actionEffects(cleared.interactions![0]), []);

  const removed = removeLayerInteraction(edited, 'int-1');
  assert.deepEqual(removed.interactions, []);
  assert.equal(edited.interactions?.length, 1);
});

test('hover set-variant and open-overlay round-trip, and hover leave closes the overlay', () => {
  const layer: Layer = { id: 'card', name: 'div', classes: '' };
  const withVariant = authorLayerInteraction(layer, {
    interactionId: 'int-hover',
    trigger: 'hover',
    action: createSetVariantAction('act-var', 'card', 'open'),
  });
  const withOverlay = authorLayerInteraction(withVariant, {
    interactionId: 'int-hover',
    trigger: 'hover',
    action: createOverlayAction('act-over', 'open', 'sheet', 'fixed'),
  });

  const stored = parseLayerInteractions(serializeLayerInteractions(withOverlay.interactions));
  assert.equal(stored.length, 1);
  assert.equal(interactionSummary(stored[0]), 'Hover → Set Variant');
  assert.deepEqual(actionEffects(stored[0]), [
    { type: 'set-variant', targetLayerId: 'card', variantId: 'open' },
    { type: 'overlay', operation: 'open', targetLayerId: 'sheet' },
  ]);

  const leave = actionEffects({
    ...stored[0],
    actions: actionsOnHoverLeave(stored[0].actions),
  });
  assert.deepEqual(leave, [{ type: 'overlay', operation: 'close', targetLayerId: 'sheet' }]);

  const empty = createLayerInteraction('int-empty', 'click');
  assert.equal(empty.actions, undefined);
  assert.deepEqual(actionEffects(empty), []);
  assert.throws(() => parseLayerInteractions('{"trigger":"click"}'), /array/);
});

test('press set-variable and tap scroll-to serialize on the layer', () => {
  const layer: Layer = { id: 'btn', name: 'button', classes: '' };
  const withVariable = authorLayerInteraction(layer, {
    interactionId: 'int-press',
    trigger: 'press',
    action: createSetVariableAction('act-var', 'var-theme', 'dark'),
  });

  assert.equal(layer.interactions, undefined);
  const storedVariable = parseLayerInteractions(serializeLayerInteractions(withVariable.interactions));
  assert.equal(storedVariable[0].trigger, 'press');
  assert.equal(interactionSummary(storedVariable[0]), 'Press → Set Variable');
  assert.deepEqual(actionEffects(storedVariable[0]), [
    { type: 'set-variable', variableId: 'var-theme', value: 'dark' },
  ]);
  assert.deepEqual(
    variableAssignment(createSetVariableAction('act-var', 'var-theme', 'dark')),
    { variableId: 'var-theme', value: 'dark' },
  );
  assert.equal(variableAssignment(createSetVariableAction('empty')), null);

  const edited = authorLayerInteraction(withVariable, {
    interactionId: 'int-press',
    trigger: 'press',
    action: createSetVariableAction('act-var', 'var-theme', 'light'),
  });
  assert.equal(edited.interactions?.length, 1);
  const editedEffect = actionEffects(edited.interactions![0])[0];
  assert.equal(editedEffect.type, 'set-variable');
  if (editedEffect.type === 'set-variable') assert.equal(editedEffect.value, 'light');
  assert.equal(removeLayerInteraction(edited, 'int-press').interactions?.length, 0);

  const scrollAction: InteractionAction = {
    id: 'act-scroll',
    type: 'scroll-to',
    target: 'layer',
    targetLayerId: 'pricing',
    position: 'top',
  };
  const withScroll = authorLayerInteraction(layer, {
    interactionId: 'int-scroll',
    trigger: 'click',
    action: scrollAction,
  });
  const storedScroll = parseLayerInteractions(serializeLayerInteractions(withScroll.interactions));
  assert.equal(interactionSummary(storedScroll[0]), 'Tap → Scroll to');
  assert.deepEqual(actionEffects(storedScroll[0]), [
    { type: 'scroll-to', target: 'layer', targetLayerId: 'pricing', position: 'top' },
  ]);
  assert.deepEqual(scrollToPlan({
    id: 'act-scroll',
    type: 'scroll-to',
    target: 'layer',
    targetLayerId: 'pricing',
  }), { target: 'layer', layerId: 'pricing' });
  assert.equal(scrollToPlan(createScrollToAction('missing')), null);

  const pageScroll = authorLayerInteraction(withScroll, {
    interactionId: 'int-scroll',
    trigger: 'click',
    action: {
      id: 'act-scroll',
      type: 'scroll-to',
      target: 'page',
      position: 'bottom',
    },
  });
  assert.equal(pageScroll.interactions?.[0].actions?.length, 1);
  assert.deepEqual(actionEffects(pageScroll.interactions![0]), [
    { type: 'scroll-to', target: 'page', targetLayerId: '', position: 'bottom' },
  ]);
  assert.deepEqual(scrollToPlan({
    id: 'act-scroll',
    type: 'scroll-to',
    target: 'page',
    position: 'bottom',
  }), { target: 'page', position: 'bottom' });

  const leave = actionsOnHoverLeave([
    createSetVariableAction('act-var', 'var-theme', 'dark'),
    createScrollToAction('act-scroll', 'layer'),
    createOverlayAction('act-over', 'open', 'sheet'),
  ]);
  assert.equal(leave.length, 1);
  assert.equal(leave[0].type, 'overlay');
});

test('keyboard shortcuts match key, modifiers, and phase', () => {
  const plain = { key: 'k', phase: 'down' as const };
  assert.equal(keyboardEventMatches(plain, { key: 'k', code: 'KeyK' }, 'down'), true);
  assert.equal(keyboardEventMatches(plain, { key: 'K', code: 'KeyK', shiftKey: true }, 'down'), false);
  assert.equal(keyboardEventMatches(plain, { key: 'k' }, 'up'), false);
  assert.equal(keyboardEventMatches(plain, { key: 'k', repeat: true }, 'down'), false);
  assert.equal(keyboardEventMatches({ key: 'k', phase: 'up' }, { key: 'K' }, 'up'), true);
  assert.equal(keyFromKeyboardEvent({ key: 'Shift', code: 'ShiftLeft' }), null);
  assert.equal(canonicalKey('Cmd'), '');
  assert.equal(keyboardEventMatches({ key: '' }, { key: 'k' }, 'down'), false);

  const combo = { key: 'k', meta: true, shift: true, phase: 'down' as const };
  assert.equal(keyboardEventMatches(combo, { key: 'k', code: 'KeyK', metaKey: true, shiftKey: true }, 'down'), true);
  assert.equal(keyboardEventMatches(combo, { key: 'k', code: 'KeyK', metaKey: true }, 'down'), false);
  assert.equal(keyboardEventMatches(combo, {
    key: 'k',
    code: 'KeyK',
    metaKey: true,
    shiftKey: true,
    ctrlKey: true,
  }, 'down'), false);
  assert.equal(keyboardEventMatches({ key: 'k', ctrl: true }, { key: 'k', metaKey: true }, 'down'), false);
  assert.equal(keyboardEventMatches({ key: 'k', alt: true }, { key: 'k', altKey: true }, 'down'), true);

  assert.equal(keyFromKeyboardEvent({ key: '!', code: 'Digit1' }), '1');
  assert.equal(keyboardEventMatches(
    { key: '1', shift: true },
    { key: '!', code: 'Digit1', shiftKey: true },
    'down',
  ), true);
  assert.equal(keyboardEventMatches(
    { key: '1' },
    { key: '!', code: 'Digit1', shiftKey: true },
    'down',
  ), false);

  assert.equal(keyFromKeyboardEvent({ key: 'Enter' }), 'enter');
  assert.equal(keyboardEventMatches({ key: 'enter' }, { key: 'Enter', code: 'Enter' }, 'down'), true);
  assert.equal(keyboardEventMatches({ key: 'space' }, { key: ' ', code: 'Space' }, 'down'), true);
  assert.equal(formatKeyLabel('k'), 'K');
  assert.equal(formatKeyLabel('escape'), 'Esc');
  assert.equal(formatKeyboardCombo({ key: 'k', ctrl: true, shift: true, meta: true }), 'Ctrl+Shift+⌘+K');
  assert.equal(formatKeyboardCombo({ key: '' }), '');

  assert.equal(keyboardShouldFire(plain, { key: 'k' }, 'down', true), false);
  assert.equal(keyboardShouldFire(
    { key: 'k', shift: true },
    { key: 'K', shiftKey: true },
    'down',
    true,
  ), false);
  assert.equal(keyboardShouldFire(
    { key: 'k', meta: true },
    { key: 'k', metaKey: true },
    'down',
    true,
  ), true);
});

test('timer schedule waits, then repeats on an interval', () => {
  assert.equal(timerSchedule(undefined), null);
  assert.deepEqual(timerSchedule({ delay: 1000 }), { delay: 1000, interval: null });
  assert.deepEqual(timerSchedule({ delay: 250.4, repeat: false, interval: 50 }), {
    delay: 250,
    interval: null,
  });
  assert.deepEqual(timerSchedule({ delay: -20, repeat: true }), { delay: 0, interval: 1 });
  assert.deepEqual(timerSchedule({ delay: 500, repeat: true, interval: 1200 }), {
    delay: 500,
    interval: 1200,
  });
  assert.deepEqual(timerSchedule({ delay: 800, repeat: true }), { delay: 800, interval: 800 });
  assert.deepEqual(timerSchedule({ delay: 800, repeat: true, interval: 0 }), { delay: 800, interval: 1 });
  assert.equal(timerSchedule({ delay: Number.NaN }), null);
});

test('keyboard and timer events round-trip with the existing actions', () => {
  const layer: Layer = { id: 'btn', name: 'button', classes: '' };
  const keyEvent = withKeyboard(createLayerInteraction('int-key', 'key'), {
    key: 'K',
    meta: true,
    phase: 'down',
  });
  const withNavigate = authorLayerInteraction(
    { ...layer, interactions: [keyEvent] },
    {
      interactionId: 'int-key',
      trigger: 'key',
      action: createNavigateAction('act-go', 'url'),
    },
  );
  const edited = {
    ...withNavigate,
    interactions: withNavigate.interactions?.map(item => (
      item.id === 'int-key' ? withKeyboard(item, { key: 'K', meta: true, phase: 'down' }) : item
    )),
  };
  const storedKey = parseLayerInteractions(serializeLayerInteractions(edited.interactions));
  assert.equal(storedKey[0].trigger, 'key');
  assert.equal(storedKey[0].keyboard?.key, 'k');
  assert.equal(storedKey[0].keyboard?.meta, true);
  assert.equal(storedKey[0].keyboard?.phase, 'down');
  assert.equal(interactionSummary(storedKey[0]), 'Keyboard ⌘+K → Navigate');
  assert.deepEqual(actionEffects(storedKey[0]), [{ type: 'navigate', href: null }]);

  const keyUp = withKeyboard(storedKey[0], { phase: 'up' });
  assert.equal(interactionSummary(keyUp), 'Keyboard up ⌘+K → Navigate');

  const timerEvent = withTimer(createLayerInteraction('int-timer', 'timer'), {
    delay: 1500,
    repeat: true,
    interval: 400,
  });
  const withVariable = authorLayerInteraction(
    { ...layer, interactions: [timerEvent] },
    {
      interactionId: 'int-timer',
      trigger: 'timer',
      action: createSetVariableAction('act-var', 'var-theme', 'dark'),
    },
  );
  const keptTimer = {
    ...withVariable,
    interactions: withVariable.interactions?.map(item => (
      item.id === 'int-timer'
        ? withTimer(item, { delay: 1500, repeat: true, interval: 400 })
        : item
    )),
  };
  const storedTimer = parseLayerInteractions(serializeLayerInteractions(keptTimer.interactions));
  assert.equal(storedTimer[0].trigger, 'timer');
  assert.deepEqual(timerSchedule(storedTimer[0].timer), { delay: 1500, interval: 400 });
  assert.equal(interactionSummary(storedTimer[0]), 'Timer 1500ms every 400ms → Set Variable');
  assert.deepEqual(actionEffects(storedTimer[0]), [
    { type: 'set-variable', variableId: 'var-theme', value: 'dark' },
  ]);

  assert.throws(
    () => parseLayerInteractions(JSON.stringify([{
      id: 'bad',
      trigger: 'key',
      timeline: { breakpoints: ['desktop'], repeat: 0, yoyo: false },
      tweens: [],
      keyboard: { key: 'k', phase: 'sideways' },
    }])),
    /phase/,
  );
  assert.throws(
    () => parseLayerInteractions(JSON.stringify([{
      id: 'bad',
      trigger: 'timer',
      timeline: { breakpoints: ['desktop'], repeat: 0, yoyo: false },
      tweens: [],
      timer: { delay: 'soon' },
    }])),
    /delay/,
  );

  const createdKey = createLayerInteraction('fresh-key', 'key');
  assert.equal(createdKey.keyboard?.key, '');
  assert.equal(createdKey.keyboard?.phase, 'down');
  const createdTimer = createLayerInteraction('fresh-timer', 'timer');
  assert.equal(createdTimer.timer?.delay, 1000);
  assert.equal(createdTimer.timer?.repeat, false);
});
