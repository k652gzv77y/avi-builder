import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Layer } from '@/types';
import { DEFAULT_OVERLAY_DISMISS } from '@/lib/interactions-framer';
import {
  applyInteractionChange,
  applyOverlaySetup,
  createMenuItemLayer,
  createOverlayLayer,
  overlayCanvasHidden,
  overlayDismissSummary,
  syncOverlaySettings,
} from '@/lib/overlay-setup';

function trigger(id = 'button'): Layer {
  return { id, name: 'button', classes: [], customName: 'Button' };
}

test('create overlay inserts a sibling and a Tap open action', () => {
  const layers = [{ id: 'body', name: 'body', classes: [], children: [trigger()] }];
  const overlay = createOverlayLayer('sheet', 'fixed');
  const next = applyOverlaySetup(layers, 'button', overlay, {
    interactionId: 'int-1',
    actionId: 'act-1',
  });

  assert.ok(next);
  const children = next?.[0].children ?? [];
  assert.deepEqual(children.map(layer => layer.id), ['button', 'sheet']);
  assert.equal(children[1].overlay?.placement, 'fixed');
  assert.equal(children[1].overlay?.kind, 'modal');
  assert.equal(children[1].customName, 'Modal');
  assert.deepEqual(children[1].overlay?.dismiss, DEFAULT_OVERLAY_DISMISS);

  const action = children[0].interactions?.[0].actions?.[0];
  assert.equal(children[0].interactions?.[0].trigger, 'click');
  assert.equal(action?.type, 'overlay');
  if (action?.type === 'overlay') {
    assert.equal(action.operation, 'open');
    assert.equal(action.targetLayerId, 'sheet');
    assert.equal(action.placement, 'fixed');
    assert.equal(action.dismiss.escape, true);
    assert.equal(action.dismiss.outside, true);
    assert.equal(action.dismiss.restoreFocus, true);
  }
  assert.equal(layers[0].children?.length, 1);
});

test('relative overlay keeps an existing Tap action', () => {
  const button = trigger();
  button.interactions = [{
    id: 'int-0',
    trigger: 'click',
    timeline: { breakpoints: ['desktop'], repeat: 0, yoyo: false },
    tweens: [],
    actions: [{
      id: 'nav',
      type: 'navigate',
      destination: 'url',
      href: '/pricing',
    }],
  }];
  const overlay = createOverlayLayer('menu', 'relative');
  const next = applyOverlaySetup([button], 'button', overlay, {
    interactionId: 'int-new',
    actionId: 'act-open',
  });
  const actions = next?.[0].interactions?.[0].actions ?? [];
  assert.equal(actions.length, 2);
  assert.equal(actions[1].type, 'overlay');
  assert.equal(next?.[1].overlay?.placement, 'relative');
  assert.equal(next?.[1].overlay?.kind, 'popover');
  assert.equal(next?.[1].overlay?.anchor, 'bottom');
  assert.equal(next?.[1].customName, 'Popover');
});

test('dismiss edits stay on the overlay and the action that opens it', () => {
  const overlay = createOverlayLayer('sheet', 'fixed');
  const setup = applyOverlaySetup([trigger()], 'button', overlay, {
    interactionId: 'int-1',
    actionId: 'act-1',
  });
  assert.ok(setup);
  const updated = syncOverlaySettings(setup, 'sheet', {
    placement: 'relative',
    dismiss: { escape: false, outside: true, restoreFocus: false },
  });
  assert.equal(updated[1].overlay?.placement, 'relative');
  assert.equal(updated[1].overlay?.kind, 'popover');
  assert.equal(updated[1].overlay?.dismiss.escape, false);
  const action = updated[0].interactions?.[0].actions?.[0];
  if (action?.type === 'overlay') {
    assert.equal(action.placement, 'relative');
    assert.equal(action.dismiss.restoreFocus, false);
  }
  assert.equal(overlayDismissSummary(updated[1].overlay!.dismiss), 'Outside click');
});

test('editing the open action writes the same dismiss options back to the overlay', () => {
  const overlay = createOverlayLayer('sheet', 'fixed');
  const setup = applyOverlaySetup([trigger()], 'button', overlay, {
    interactionId: 'int-1',
    actionId: 'act-1',
  });
  assert.ok(setup);
  const interaction = setup[0].interactions?.[0];
  assert.ok(interaction);
  const action = interaction.actions?.[0];
  assert.ok(action && action.type === 'overlay');
  const next = applyInteractionChange(setup, 'button', {
    ...interaction,
    actions: [{
      ...action,
      placement: 'relative',
      kind: 'popover',
      anchor: 'top',
      dismiss: { escape: true, outside: false, restoreFocus: true },
    }],
  });
  assert.equal(next[1].overlay?.placement, 'relative');
  assert.equal(next[1].overlay?.kind, 'popover');
  assert.equal(next[1].overlay?.anchor, 'top');
  assert.equal(next[1].overlay?.dismiss.outside, false);
});

test('tooltip overlay keeps its anchor layer and does not return focus by default', () => {
  const overlay = createOverlayLayer('tip', 'tooltip');
  const setup = applyOverlaySetup([trigger()], 'button', overlay, {
    interactionId: 'int-1',
    actionId: 'act-1',
  });
  assert.ok(setup);
  assert.equal(setup[1].customName, 'Tooltip');
  assert.equal(setup[1].overlay?.dismiss.restoreFocus, false);
  const interaction = setup[0].interactions?.[0];
  assert.ok(interaction);
  const action = interaction.actions?.[0];
  assert.ok(action && action.type === 'overlay');
  const next = applyInteractionChange(setup, 'button', {
    ...interaction,
    actions: [{ ...action, anchor: 'left', anchorLayerId: 'card' }],
  });
  assert.equal(next[1].overlay?.kind, 'tooltip');
  assert.equal(next[1].overlay?.placement, 'relative');
  assert.equal(next[1].overlay?.anchor, 'left');
  assert.equal(next[1].overlay?.anchorLayerId, 'card');
  const saved = next[0].interactions?.[0].actions?.[0];
  if (saved?.type === 'overlay') {
    assert.equal(saved.anchorLayerId, 'card');
    assert.equal(saved.kind, 'tooltip');
  }
});

test('a sheet keeps author height, max height, and padding and anchors to the bottom', () => {
  const overlay = createOverlayLayer('sheet', 'sheet');
  assert.equal(overlay.overlay?.kind, 'sheet');
  assert.equal(overlay.overlay?.placement, 'fixed');
  assert.equal(overlay.customName, 'Sheet');
  assert.equal(overlay.design?.sizing?.width, '100%');
  assert.equal(overlay.design?.sizing?.minHeight, '160px');
  assert.equal(overlay.design?.sizing?.maxHeight, '85vh');
  assert.equal(overlay.design?.spacing?.paddingTop, '24px');
  assert.equal(overlay.design?.borders?.borderTopLeftRadius, '16px');
  assert.equal(overlay.design?.borders?.borderBottomLeftRadius, '0px');
  const classes = overlay.classes;
  assert.ok(Array.isArray(classes));
  assert.ok(classes.includes('w-[100%]'));
  assert.ok(classes.includes('max-h-[85vh]'));
  assert.ok(classes.includes('overflow-y-auto'));
  assert.ok(classes.includes('rounded-tl-[16px]'));
  assert.ok(classes.includes('rounded-bl-[0px]'));
});

test('a menu is an anchored list whose children are the items', () => {
  const overlay = createOverlayLayer('menu-1', 'menu');
  assert.equal(overlay.overlay?.kind, 'menu');
  assert.equal(overlay.overlay?.placement, 'relative');
  assert.equal(overlay.overlay?.anchor, 'bottom');
  assert.equal(overlay.customName, 'Menu');
  assert.equal(overlay.attributes?.['data-overlay-slot'], 'items');
  assert.equal(overlay.design?.sizing?.width, '220px');
  assert.equal(overlay.design?.spacing?.paddingTop, '4px');
  const items = overlay.children ?? [];
  assert.deepEqual(items.map(item => item.customName), ['Edit', 'Duplicate', 'Delete']);
  assert.ok(items.every(item => item.attributes?.role === 'menuitem' && item.name === 'button'));
  assert.equal(items[0].children?.[0].settings?.tag, 'span');

  const row = createMenuItemLayer('row', 'Archive');
  assert.equal(row.attributes?.role, 'menuitem');
  assert.equal(row.id, 'row');

  const setup = applyOverlaySetup([trigger()], 'button', overlay, {
    interactionId: 'int-1',
    actionId: 'act-1',
  });
  assert.ok(setup);
  const action = setup[0].interactions?.[0].actions?.[0];
  assert.equal(action?.type, 'overlay');
  if (action?.type === 'overlay') {
    assert.equal(action.kind, 'menu');
    assert.equal(action.placement, 'relative');
    assert.equal(action.anchor, 'bottom');
    assert.equal(action.dismiss.restoreFocus, true);
  }
  const kept = syncOverlaySettings(setup, 'menu-1', {
    placement: 'relative',
    kind: 'menu',
    anchor: 'top',
    dismiss: { escape: true, outside: true, restoreFocus: true },
  });
  assert.equal(kept[1].overlay?.kind, 'menu');
  assert.equal(kept[1].overlay?.anchor, 'top');
  assert.equal(kept[1].children?.length, 3);
});

test('canvas hides overlays until the layer is selected', () => {
  assert.equal(overlayCanvasHidden(false, true, false), false);
  assert.equal(overlayCanvasHidden(true, true, false), true);
  assert.equal(overlayCanvasHidden(true, true, true), false);
  assert.equal(overlayCanvasHidden(true, false, true), true);
});
