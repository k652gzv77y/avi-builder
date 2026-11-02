import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Component, ComponentVariant, Layer } from '@/types';
import {
  applyReplicaOverrides,
  bakeGestureClasses,
  collectGestureCandidateClasses,
  getComponentVariantLayers,
  isRestingVariant,
  prepareVariantLayersForPublish,
  reconcileReplicaEdit,
} from '@/lib/component-variant-utils';

function layer(partial: Partial<Layer> & Pick<Layer, 'id'>): Layer {
  return { name: 'div', classes: '', ...partial };
}

function component(variants: ComponentVariant[]): Component {
  return {
    id: 'cmp',
    name: 'Button',
    layers: variants[0]?.layers ?? [],
    variants,
    is_published: false,
    created_at: '',
    updated_at: '',
  };
}

test('hover edits keep layout on the primary and store style overrides', () => {
  const primary = [
    layer({
      id: 'root',
      classes: 'flex w-full bg-[#111111] text-[#eeeeee]',
      design: {
        layout: { isActive: true, display: 'flex' },
        sizing: { isActive: true, width: '100%' },
        backgrounds: { isActive: true, backgroundColor: '#111111' },
        typography: { isActive: true, color: '#eeeeee' },
      },
      children: [layer({ id: 'label', name: 'text', classes: 'text-[16px]' })],
    }),
  ];
  const edited = [
    layer({
      id: 'root',
      classes: 'flex w-[240px] bg-[#ff0000] text-[#eeeeee] opacity-80',
      design: {
        layout: { isActive: true, display: 'flex' },
        sizing: { isActive: true, width: '240px' },
        backgrounds: { isActive: true, backgroundColor: '#ff0000' },
        typography: { isActive: true, color: '#eeeeee' },
        effects: { isActive: true, opacity: '80' },
      },
      children: [layer({ id: 'label', name: 'text', classes: 'text-[16px]' })],
    }),
  ];

  const reconciled = reconcileReplicaEdit(primary, edited);
  assert.match(String(reconciled.primary[0].classes), /w-\[240px\]/);
  assert.match(String(reconciled.primary[0].classes), /bg-\[#111111\]/);
  assert.doesNotMatch(String(reconciled.primary[0].classes), /bg-\[#ff0000\]/);
  assert.match(reconciled.overrides.root.classes || '', /bg-\[#ff0000\]/);
  assert.match(reconciled.overrides.root.classes || '', /opacity-80/);
  assert.equal(reconciled.overrides.label, undefined);

  const hover = applyReplicaOverrides(reconciled.primary, reconciled.overrides);
  assert.match(String(hover[0].classes), /w-\[240px\]/);
  assert.match(String(hover[0].classes), /bg-\[#ff0000\]/);
  assert.equal(hover[0].id, 'root');
  assert.equal(hover[0].children?.[0].id, 'label');

  const cmp = component([
    { id: 'primary', name: 'Default', layers: reconciled.primary },
    {
      id: 'hover',
      name: 'Hover',
      state: 'hover',
      layers: [],
      replicaOf: 'primary',
      overrides: reconciled.overrides,
    },
    { id: 'open', name: 'Open', state: 'open', layers: [layer({ id: 'open-root', classes: 'hidden' })] },
  ]);

  const resolvedHover = getComponentVariantLayers(cmp, 'hover');
  assert.equal(resolvedHover[0].id, 'root');
  assert.match(String(resolvedHover[0].classes), /bg-\[#ff0000\]/);

  const resolvedOpen = getComponentVariantLayers(cmp, 'open');
  assert.equal(resolvedOpen[0].id, 'open-root');

  assert.equal(isRestingVariant(cmp, 'primary'), true);
  assert.equal(isRestingVariant(cmp, 'hover'), false);

  const published = prepareVariantLayersForPublish(cmp, 'primary');
  assert.match(String(published[0].classes), /hover:bg-\[#ff0000\]/);
  assert.match(String(published[0].classes), /hover:opacity-80/);
  assert.match(String(published[0].classes), /bg-\[#111111\]/);

  const candidates = collectGestureCandidateClasses(cmp);
  assert.ok(candidates.some(classes => classes.includes('hover:bg-[#ff0000]')));

  const baked = bakeGestureClasses(getComponentVariantLayers(cmp, 'primary'), cmp);
  assert.equal(baked[0].children?.[0].id, 'label');
});

test('pressed replicas prefix active classes once', () => {
  const cmp = component([
    { id: 'primary', name: 'Default', layers: [layer({ id: 'root', classes: 'bg-[#111111]' })] },
    {
      id: 'pressed',
      name: 'Pressed',
      state: 'pressed',
      layers: [],
      replicaOf: 'primary',
      overrides: { root: { classes: 'bg-[#000000]' } },
    },
  ]);
  const published = prepareVariantLayersForPublish(cmp, 'primary');
  assert.match(String(published[0].classes), /active:bg-\[#000000\]/);
  assert.doesNotMatch(String(published[0].classes), /active:active:/);
  const shown = prepareVariantLayersForPublish(cmp, 'pressed');
  assert.match(String(shown[0].classes), /bg-\[#000000\]/);
  assert.doesNotMatch(String(shown[0].classes), /active:bg-/);
});
