import assert from 'node:assert/strict';
import test from 'node:test';

import type { Layer } from '@/types';
import {
  applyStackSelectionAlignment,
  paddingEditPlan,
  resolvePaddingMode,
  resolveStackSelection,
  spacingContainerKind,
  stackAxisFromDirection,
  uniformPaddingValue,
} from '@/lib/stack-spacing';

function layer(partial: Partial<Layer> & Pick<Layer, 'id'>): Layer {
  return { name: 'div', classes: '', ...partial };
}

function stack(
  id: string,
  direction: 'row' | 'column',
  children: Layer[],
  display: 'flex' | 'grid' = 'flex',
): Layer {
  const directionClass = direction === 'column' ? 'flex-col' : 'flex-row';
  const classes = display === 'grid' ? 'grid' : `flex ${directionClass}`;
  return layer({
    id,
    classes,
    design: {
      layout: {
        isActive: true,
        display,
        ...(display === 'flex' ? { flexDirection: direction } : {}),
      },
    },
    children,
  });
}

function flowChild(id: string): Layer {
  return layer({ id, classes: 'relative' });
}

test('stack axis accepts design values and tailwind classes', () => {
  assert.equal(stackAxisFromDirection('column'), 'column');
  assert.equal(stackAxisFromDirection('flex-col'), 'column');
  assert.equal(stackAxisFromDirection('column-reverse'), 'column');
  assert.equal(stackAxisFromDirection('flex-row'), 'row');
  assert.equal(stackAxisFromDirection(undefined), 'row');
});

test('spacing container is a stack or grid', () => {
  assert.equal(spacingContainerKind(stack('s', 'column', [])), 'stack');
  assert.equal(spacingContainerKind(stack('g', 'row', [], 'grid')), 'grid');
  assert.equal(spacingContainerKind(layer({ id: 'frame', classes: 'relative' })), null);
  assert.equal(spacingContainerKind(null), null);
});

test('stack selection requires two in-flow children of one parent', () => {
  const vertical = stack('s1', 'column', [
    flowChild('a'),
    flowChild('b'),
    layer({
      id: 'pin',
      classes: 'absolute',
      design: { positioning: { isActive: true, position: 'absolute' } },
    }),
  ]);
  const horizontal = stack('s2', 'row', [flowChild('c'), flowChild('d')]);
  const frame = layer({
    id: 'frame',
    classes: 'relative',
    design: { positioning: { isActive: true, position: 'relative' } },
    children: [flowChild('e'), flowChild('f')],
  });
  const layers = [vertical, horizontal, frame];

  const column = resolveStackSelection(layers, ['a', 'b', 'pin']);
  assert.equal(column?.parentId, 's1');
  assert.deepEqual(column?.childIds, ['a', 'b']);
  assert.equal(column?.axis, 'column');
  assert.equal(column?.kind, 'stack');

  assert.equal(resolveStackSelection(layers, ['a', 'pin']), null);
  assert.equal(resolveStackSelection(layers, ['a', 'c']), null);
  assert.equal(resolveStackSelection(layers, ['e', 'f']), null);
  assert.equal(resolveStackSelection(layers, ['c', 'd'])?.axis, 'row');

  const grid = resolveStackSelection([
    stack('g', 'row', [flowChild('x'), flowChild('y')], 'grid'),
  ], ['x', 'y']);
  assert.equal(grid?.kind, 'grid');
  assert.equal(grid?.axis, 'row');
});

test('cross alignment sets align-self on the selection only', () => {
  const layers = [stack('s', 'column', [flowChild('a'), flowChild('b'), flowChild('c')])];
  const selection = resolveStackSelection(layers, ['a', 'b']);
  assert.ok(selection);

  const next = applyStackSelectionAlignment(layers, selection, { type: 'cross', value: 'center' });
  const parent = next[0];
  const [a, b, c] = parent.children || [];
  assert.match(String(a.classes), /self-center/);
  assert.equal(a.design?.layout?.alignSelf, 'center');
  assert.match(String(b.classes), /self-center/);
  assert.equal(c.classes, 'relative');
  assert.equal(parent.design?.layout?.justifyContent, undefined);

  assert.equal(
    applyStackSelectionAlignment(next, selection, { type: 'cross', value: 'center' }),
    next,
  );
});

test('main alignment packs the parent and leaves children in place', () => {
  const layers = [stack('s', 'row', [flowChild('a'), flowChild('b')])];
  const selection = resolveStackSelection(layers, ['a', 'b']);
  assert.ok(selection);

  const next = applyStackSelectionAlignment(layers, selection, { type: 'main', value: 'between' });
  assert.match(String(next[0].classes), /justify-between/);
  assert.equal(next[0].design?.layout?.justifyContent, 'between');
  assert.equal(next[0].children?.[0].classes, 'relative');
  assert.equal(next[0].children?.[1].classes, 'relative');
});

test('tablet alignment is a breakpoint class and keeps the desktop value', () => {
  const layers = [stack('s', 'column', [flowChild('a'), flowChild('b')])];
  const selection = resolveStackSelection(layers, ['a', 'b']);
  assert.ok(selection);

  const next = applyStackSelectionAlignment(
    layers,
    selection,
    { type: 'cross', value: 'end' },
    'tablet',
  );
  const child = next[0].children?.[0];
  assert.match(String(child?.classes), /max-lg:self-end/);
  assert.equal(child?.design?.layout?.alignSelf, undefined);
  assert.match(String(next[0].classes), /flex flex-col/);
});

test('padding mode follows a stored choice, then the sides', () => {
  assert.equal(resolvePaddingMode('individual', ['8px', '8px', '8px', '8px']), 'individual');
  assert.equal(resolvePaddingMode(undefined, ['8px', '8px', '8px', '8px']), 'all');
  assert.equal(resolvePaddingMode(undefined, ['8px', '4px', '8px', '8px']), 'individual');
  assert.equal(resolvePaddingMode(undefined, ['8px', '', '', '']), 'all');
  assert.equal(uniformPaddingValue(['8px', '8px', '8px', '8px']), '8px');
  assert.equal(uniformPaddingValue(['8px', '8px', '8px', '']), '');
});

test('padding edit plan fills per-side values and collapses to the common side', () => {
  assert.deepEqual(paddingEditPlan('individual', {
    paddingTop: '12px',
    paddingRight: '',
    paddingBottom: '',
    paddingLeft: '',
  }), [
    { property: 'paddingTop', value: '12px' },
    { property: 'paddingRight', value: '12px' },
    { property: 'paddingBottom', value: '12px' },
    { property: 'paddingLeft', value: '12px' },
    { property: 'paddingMode', value: 'individual' },
  ]);

  const collapsed = paddingEditPlan('all', {
    paddingTop: '4px',
    paddingRight: '16px',
    paddingBottom: '16px',
    paddingLeft: '16px',
  });
  assert.equal(collapsed.find((edit) => edit.property === 'paddingTop')?.value, '16px');
  assert.equal(collapsed.find((edit) => edit.property === 'paddingLeft')?.value, '16px');
  assert.equal(collapsed.find((edit) => edit.property === 'paddingMode')?.value, 'all');
});
