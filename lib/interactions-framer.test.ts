import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { InteractionAction, Layer, LayerInteraction } from '@/types';
import {
  EVENT_LABELS,
  actionsForRun,
  actionsOnHoverLeave,
  createAppearTween,
  createNavigateAction,
  createOverlayAction,
  createScrollVariantAction,
  createSetVariantAction,
  dismissOnEscape,
  dismissOnPointer,
  focusAfterClose,
  hrefForPage,
  interactionSummary,
  mergeLayerInteractions,
  nextScrollStop,
  overlayOpenTargets,
  overlayPlacementStyle,
  remapActionTarget,
  remapComponentRootInteraction,
  removeInteractionAction,
  resolveNavigateHref,
  scrollProgressThroughViewport,
  upsertInteractionAction,
  variantForScrollProgress,
  variantTargets,
  withAppearPreset,
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
