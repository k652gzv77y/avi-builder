import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  activeVariantId,
  emptyVariantSession,
  interactionOwnsGesture,
  planInteractivePanes,
  reduceVariantSession,
  type VariantSession,
} from '@/lib/interactive-variants';
import { playInteraction, releaseInteraction, resetInteractiveVariants } from '@/lib/interaction-runtime';
import { createLayerInteraction, createSetVariantAction } from '@/lib/interactions-framer';
import { resolveComponents } from '@/lib/resolve-components';
import { useInteractionPreviewStore } from '@/stores/useInteractionPreviewStore';
import type { Component, ComponentVariable, Layer, LayerInteraction } from '@/types';

function layer(partial: Partial<Layer> & Pick<Layer, 'id'>): Layer {
  return { name: 'div', classes: '', ...partial };
}

function textOf(node: Layer | undefined): string {
  const text = node?.variables?.text;
  if (text && text.type === 'dynamic_text') return text.data.content;
  return '';
}

function apply(session: VariantSession, ...events: Parameters<typeof reduceVariantSession>[1][]): VariantSession {
  return events.reduce((current, event) => reduceVariantSession(current, event), session);
}

const variables: ComponentVariable[] = [
  { id: 'fill', name: 'Fill', type: 'color', default_value: { type: 'color', value: '#ffffff' } },
  {
    id: 'title',
    name: 'Title',
    type: 'text',
    default_value: { type: 'dynamic_text', data: { content: 'Resting' } },
  },
];

function cardComponent(): Component {
  const root = layer({
    id: 'frame',
    classes: 'bg-[#ffffff]',
    design: { backgrounds: { isActive: true, backgroundColor: '#ffffff' } },
    controlBindings: { fill: 'fill' },
    children: [
      layer({
        id: 'label',
        name: 'text',
        variables: { text: { type: 'dynamic_text', id: 'title', data: { content: '' } } },
      }),
    ],
  });
  const openRoot = layer({
    id: 'frame',
    classes: 'bg-[#ffffff]',
    design: { backgrounds: { isActive: true, backgroundColor: '#ffffff' } },
    controlBindings: { fill: 'fill' },
    children: [
      layer({
        id: 'label',
        name: 'text',
        variables: { text: { type: 'dynamic_text', id: 'title', data: { content: '' } } },
      }),
    ],
  });
  return {
    id: 'cmp',
    name: 'Card',
    layers: [root],
    variables,
    variants: [
      { id: 'primary', name: 'Default', layers: [root] },
      {
        id: 'open',
        name: 'Open',
        state: 'open',
        layers: [openRoot],
        propertyDefaults: {
          fill: { type: 'color', value: '#111111' },
          title: { type: 'dynamic_text', data: { content: 'Open title' } },
        },
      },
      {
        id: 'hover',
        name: 'Hover',
        state: 'hover',
        layers: [],
        replicaOf: 'primary',
        propertyDefaults: {
          fill: { type: 'color', value: '#00aa00' },
          title: { type: 'dynamic_text', data: { content: 'Hover title' } },
        },
      },
      {
        id: 'pressed',
        name: 'Pressed',
        state: 'pressed',
        layers: [],
        replicaOf: 'primary',
        propertyDefaults: {
          title: { type: 'dynamic_text', data: { content: 'Pressed title' } },
        },
      },
    ],
    is_published: false,
    created_at: '',
    updated_at: '',
  };
}

test('hover and press return to the previous variant and tap stays', () => {
  let session = emptyVariantSession();
  session = apply(
    session,
    { type: 'set', gesture: 'hover', variantId: 'hover' },
  );
  assert.equal(activeVariantId(session), 'hover');

  session = apply(session, { type: 'set', gesture: 'press', variantId: 'pressed' });
  assert.equal(activeVariantId(session), 'pressed');

  session = apply(session, { type: 'end', gesture: 'press' });
  assert.equal(activeVariantId(session), 'hover');

  session = apply(session, { type: 'end', gesture: 'hover' });
  assert.equal(activeVariantId(session), null);

  session = apply(session, { type: 'set', gesture: 'sticky', variantId: 'open' });
  session = apply(session, { type: 'set', gesture: 'hover', variantId: 'hover' });
  session = apply(session, { type: 'end', gesture: 'hover' });
  assert.equal(activeVariantId(session), 'open');

  const same = reduceVariantSession(session, { type: 'end', gesture: 'press' });
  assert.equal(same, session);
});

test('a resting instance prepares hover and pressed panes with that variant defaults', () => {
  const component = cardComponent();
  const resolved = resolveComponents(
    [layer({ id: 'inst', componentId: 'cmp' })],
    [component],
  )[0];

  assert.equal(textOf(resolved.children?.[0]), 'Resting');
  assert.match(String(resolved.classes), /bg-\[#ffffff\]/);

  const panes = resolved._interactiveVariants;
  assert.equal(panes?.restingVariantId, 'primary');
  assert.equal(panes?.hoverVariantId, 'hover');
  assert.equal(panes?.pressedVariantId, 'pressed');
  assert.equal(textOf(panes?.panes.hover.children?.[0]), 'Hover title');
  assert.match(String(panes?.panes.hover.classes), /bg-\[#00aa00\]/);
  assert.equal(textOf(panes?.panes.pressed.children?.[0]), 'Pressed title');
  assert.equal(panes?.panes.open, undefined);

  const overridden = resolveComponents(
    [layer({
      id: 'inst',
      componentId: 'cmp',
      componentOverrides: { color: { fill: { type: 'color', value: '#ff0000' } } },
    })],
    [component],
  )[0];
  assert.match(String(overridden._interactiveVariants?.panes.hover.classes), /bg-\[#ff0000\]/);
  assert.equal(textOf(overridden._interactiveVariants?.panes.hover.children?.[0]), 'Hover title');
});

test('an authored variant does not grow hover panes, and a set-variant target does', () => {
  const component = cardComponent();
  const openInstance = resolveComponents(
    [layer({ id: 'inst', componentId: 'cmp', componentVariantId: 'open' })],
    [component],
  )[0];
  assert.equal(openInstance._interactiveVariants, undefined);
  assert.equal(textOf(openInstance.children?.[0]), 'Open title');

  const button = layer({
    id: 'btn',
    interactions: [{
      ...createLayerInteraction('int-hover', 'hover'),
      actions: [createSetVariantAction('act', 'card', 'open')],
    }],
  });
  const page = resolveComponents(
    [button, layer({ id: 'card', componentId: 'cmp' })],
    [component],
  );
  const card = page[1];
  assert.ok(card._interactiveVariants?.panes.open);
  assert.equal(textOf(card._interactiveVariants?.panes.open.children?.[0]), 'Open title');
  assert.match(String(card._interactiveVariants?.panes.open.classes), /bg-\[#111111\]/);
});

test('an instance hover action owns the gesture and still renders its target', () => {
  const component = cardComponent();
  const owned = layer({
    id: 'inst',
    interactions: [{
      ...createLayerInteraction('int-hover', 'hover'),
      actions: [createSetVariantAction('act', 'inst', 'open')],
    }],
  });
  assert.equal(interactionOwnsGesture({ ...owned, componentId: 'cmp' }, 'hover'), true);
  const resolved = resolveComponents([{ ...owned, componentId: 'cmp' }], [component])[0];
  assert.equal(resolved._interactiveVariants?.hoverVariantId, undefined);
  assert.equal(textOf(resolved._interactiveVariants?.panes.open.children?.[0]), 'Open title');

  const plan = planInteractivePanes(component, 'primary', ['missing', 'primary', 'open'], {
    hover: true,
    press: false,
  });
  assert.equal(plan.hoverVariantId, undefined);
  assert.equal(plan.pressedVariantId, 'pressed');
  assert.deepEqual(plan.paneIds.filter((id) => id === 'open'), ['open']);
  assert.equal(plan.paneIds.includes('missing'), false);
  assert.equal(plan.paneIds.includes('primary'), false);
});

test('variant actions that point at each other finish resolving', () => {
  const toOpen = layer({
    id: 'frame',
    classes: 'bg-[#ffffff]',
    interactions: [{
      ...createLayerInteraction('to-open', 'click'),
      actions: [createSetVariantAction('act-open', 'frame', 'open')],
    }],
  });
  const toPrimary = layer({
    id: 'frame',
    classes: 'bg-[#111111]',
    interactions: [{
      ...createLayerInteraction('to-primary', 'click'),
      actions: [createSetVariantAction('act-primary', 'frame', 'primary')],
    }],
  });
  const component: Component = {
    id: 'cmp',
    name: 'Cycle',
    layers: [toOpen],
    variants: [
      { id: 'primary', name: 'Default', layers: [toOpen] },
      { id: 'open', name: 'Open', layers: [toPrimary] },
    ],
    is_published: false,
    created_at: '',
    updated_at: '',
  };
  const resolved = resolveComponents(
    [layer({ id: 'inst', componentId: 'cmp' })],
    [component],
  )[0];
  assert.equal(resolved._interactiveVariants?.panes.open.classes, 'bg-[#111111]');
  assert.equal(resolved._interactiveVariants?.panes.open._interactiveVariants, undefined);
});

test('play and release keep tap and restore hover', () => {
  resetInteractiveVariants();
  const doc = { querySelector: () => null } as unknown as Document;
  const hover = {
    ...createLayerInteraction('int-hover', 'hover'),
    actions: [createSetVariantAction('act-hover', 'card', 'hover')],
  } satisfies LayerInteraction;
  const press = {
    ...createLayerInteraction('int-press', 'press'),
    actions: [createSetVariantAction('act-press', 'card', 'pressed')],
  } satisfies LayerInteraction;
  const tap = {
    ...createLayerInteraction('int-tap', 'click'),
    actions: [createSetVariantAction('act-tap', 'card', 'open')],
  } satisfies LayerInteraction;

  playInteraction(doc, tap, null, { live: true });
  playInteraction(doc, hover, null, { live: true });
  playInteraction(doc, press, null, { live: true });
  assert.equal(useInteractionPreviewStore.getState().variantByLayerId.card, 'pressed');

  releaseInteraction(doc, press, null, { live: true });
  assert.equal(useInteractionPreviewStore.getState().variantByLayerId.card, 'hover');

  releaseInteraction(doc, hover, null, { live: true });
  assert.equal(useInteractionPreviewStore.getState().variantByLayerId.card, 'open');

  releaseInteraction(doc, tap, null, { live: true });
  assert.equal(useInteractionPreviewStore.getState().variantByLayerId.card, 'open');
  resetInteractiveVariants();
});
