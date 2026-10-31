import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Component, Layer } from '@/types';
import {
  applyStackBindings,
  applyStackValueToBoundLayers,
  defaultBindingSources,
  readStackBreakpoint,
  writeStackBreakpoint,
} from '@/lib/component-bindings';
import { resolvePointerVariantId } from '@/lib/component-variant-utils';
import { applyComponentOverrides } from '@/lib/resolve-components';

function layer(partial: Partial<Layer> & Pick<Layer, 'id'>): Layer {
  return {
    name: 'div',
    classes: 'flex flex-row gap-[8px] items-start justify-start',
    design: {
      layout: {
        isActive: true,
        display: 'flex',
        flexDirection: 'row',
        gap: '8',
        alignItems: 'start',
        justifyContent: 'start',
      },
    },
    ...partial,
  };
}

test('stack values cascade from desktop to phone', () => {
  const value = writeStackBreakpoint({ value: '8' }, 'tablet', '16');
  const withPhone = writeStackBreakpoint(value, 'mobile', '24');
  assert.deepEqual(readStackBreakpoint(withPhone, 'desktop'), { value: '8', isOverride: false });
  assert.deepEqual(readStackBreakpoint(withPhone, 'tablet'), { value: '16', isOverride: true });
  assert.deepEqual(readStackBreakpoint(withPhone, 'mobile'), { value: '24', isOverride: true });

  const cleared = writeStackBreakpoint(withPhone, 'mobile', '');
  assert.equal(cleared.breakpoints?.mobile, undefined);
  assert.deepEqual(readStackBreakpoint(cleared, 'mobile'), { value: '16', isOverride: false });
});

test('stack variables write direction, gap, padding, distribute, and align', () => {
  const source = layer({
    id: 'stack',
    stackBindings: {
      direction: 'dir',
      gap: 'gap',
      padding: 'pad',
      distribute: 'dist',
      align: 'align',
    },
  });
  const variables = [
    { id: 'dir', name: 'Direction', type: 'stack' as const, stack_key: 'direction' as const, default_value: { value: 'column' } },
    { id: 'gap', name: 'Gap', type: 'stack' as const, stack_key: 'gap' as const, default_value: { value: '12', breakpoints: { tablet: '20' } } },
    { id: 'pad', name: 'Padding', type: 'stack' as const, stack_key: 'padding' as const, default_value: { value: '8' } },
    { id: 'dist', name: 'Distribute', type: 'stack' as const, stack_key: 'distribute' as const, default_value: { value: 'between' } },
    { id: 'align', name: 'Align', type: 'stack' as const, stack_key: 'align' as const, default_value: { value: 'center' } },
  ];

  const applied = applyStackBindings(source, undefined, variables);
  const classes = String(applied.classes);
  assert.match(classes, /\bflex-col\b/);
  assert.match(classes, /gap-\[12px\]/);
  assert.match(classes, /max-lg:gap-\[20px\]/);
  assert.match(classes, /pt-\[8px\]/);
  assert.match(classes, /justify-between/);
  assert.match(classes, /items-center/);
});

test('one stack variable updates every bound layer and instance overrides win', () => {
  const layers = [
    layer({ id: 'a', stackBindings: { gap: 'gap' } }),
    layer({ id: 'b', children: [layer({ id: 'c', stackBindings: { gap: 'gap' } })] }),
  ];
  const updated = applyStackValueToBoundLayers(layers, 'gap', 'gap', { value: '32' });
  assert.match(String(updated[0].classes), /gap-\[32px\]/);
  assert.match(String(updated[1].children?.[0].classes), /gap-\[32px\]/);

  const overridden = applyComponentOverrides(
    [layer({ id: 'a', stackBindings: { gap: 'gap' } })],
    { stack: { gap: { value: '4', breakpoints: { mobile: '2' } } } },
    [{ id: 'gap', name: 'Gap', type: 'stack', stack_key: 'gap', default_value: { value: '32' } }],
  );
  const classes = String(overridden[0].classes);
  assert.match(classes, /gap-\[4px\]/);
  assert.match(classes, /max-md:gap-\[2px\]/);
  assert.doesNotMatch(classes, /gap-\[32px\]/);
});

test('bindings picker keeps CMS and Fetch slots beside Variables', () => {
  const sources = defaultBindingSources({
    items: [{ id: 'gap', name: 'Gap' }],
    onCreate: () => undefined,
    onSelect: () => undefined,
  });
  assert.deepEqual(sources.map(source => source.kind), ['variable', 'cms', 'fetch']);
  assert.equal(sources[0].enabled, true);
  assert.equal(sources[0].label, 'Variables');
  assert.equal(sources[1].enabled, false);
  assert.equal(sources[2].enabled, false);
  assert.equal(sources[1].unavailableReason?.length ? true : false, true);

  const live = defaultBindingSources({
    items: [{ id: 'gap', name: 'Gap' }],
    onSelect: () => undefined,
  }, {
    cms: { items: [{ id: 'cms:collection::title', name: 'Title' }], onSelect: () => undefined },
    fetch: { items: [{ id: 'fetch-1', name: 'Title' }], onSelect: () => undefined, onCreate: () => undefined },
  });
  assert.equal(live[1].enabled, true);
  assert.equal(live[1].label, 'CMS');
  assert.equal(live[2].enabled, true);
  assert.equal(live[2].label, 'Fetch');
});

test('hover and pressed variants preview only from the resting state', () => {
  const component = {
    id: 'cmp',
    name: 'Disclosure',
    layers: [],
    is_published: false,
    created_at: '',
    updated_at: '',
    variants: [
      { id: 'rest', name: 'Default', layers: [] },
      { id: 'open', name: 'Open', state: 'open' as const, layers: [] },
      { id: 'closed', name: 'Closed', state: 'closed' as const, layers: [] },
      { id: 'hover', name: 'Hover', state: 'hover' as const, layers: [] },
      { id: 'pressed', name: 'Pressed', state: 'pressed' as const, layers: [] },
      { id: 'custom', name: 'Compact', layers: [] },
    ],
  } satisfies Component;

  assert.equal(resolvePointerVariantId(component, 'rest', 'hover'), 'hover');
  assert.equal(resolvePointerVariantId(component, 'rest', 'pressed'), 'pressed');
  assert.equal(resolvePointerVariantId(component, 'open', 'hover'), 'open');
  assert.equal(resolvePointerVariantId(component, 'closed', null), 'closed');
  assert.equal(resolvePointerVariantId(component, 'custom', 'hover'), 'custom');
});
