import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Layer } from '@/types';
import {
  applyBreakpointDesign,
  containerLayoutKind,
  isBreakpointOverride,
  layoutModeFromDisplay,
  placeChildInParent,
  resolveSizingMode,
  shouldRemapChildPosition,
  sizingFieldValue,
  sizingValueForMode,
  sizingValueFromInput,
  stripBreakpointOverrides,
} from '@/lib/layout-model';

function layer(partial: Partial<Layer> & Pick<Layer, 'id'>): Layer {
  return {
    name: 'div',
    classes: '',
    ...partial,
  };
}

test('sizing modes use Fit, Fill, Fixed, Relative, and Viewport', () => {
  assert.equal(resolveSizingMode('100%'), 'fill');
  assert.equal(resolveSizingMode('full'), 'fill');
  assert.equal(resolveSizingMode('fit'), 'fit');
  assert.equal(resolveSizingMode('auto'), 'fit');
  assert.equal(resolveSizingMode('100'), 'fixed');
  assert.equal(resolveSizingMode('320px'), 'fixed');
  assert.equal(resolveSizingMode('50%'), 'relative');
  assert.equal(resolveSizingMode('1/2'), 'relative');
  assert.equal(resolveSizingMode('100vw'), 'viewport');
  assert.equal(resolveSizingMode('100svh'), 'viewport');
  assert.equal(resolveSizingMode('screen'), 'viewport');
  assert.equal(resolveSizingMode(''), 'fixed');
});

test('sizing values round-trip through the inspector field', () => {
  assert.equal(sizingFieldValue('100px'), '100');
  assert.equal(sizingFieldValue('50%'), '50');
  assert.equal(sizingFieldValue('100vw'), '100');
  assert.equal(sizingFieldValue('100svh'), '100');
  assert.equal(sizingFieldValue('fit'), '');
  assert.equal(sizingValueForMode('fit', 'width'), 'fit');
  assert.equal(sizingValueForMode('fill', 'height'), '100%');
  assert.equal(sizingValueForMode('viewport', 'height'), '100svh');
  assert.equal(sizingValueForMode('viewport', 'width'), '100vw');
  assert.equal(sizingValueForMode('fixed', 'width', '240px'), '240px');
  assert.equal(sizingValueFromInput('relative', '40', 'width'), '40%');
  assert.equal(sizingValueFromInput('viewport', '80', 'height'), '80svh');
  assert.equal(sizingValueFromInput('fixed', '', 'width'), null);
});

test('layout mode treats flex as stack and everything else as frame', () => {
  assert.equal(layoutModeFromDisplay('flex'), 'stack');
  assert.equal(layoutModeFromDisplay('inline-flex'), 'stack');
  assert.equal(layoutModeFromDisplay('grid'), 'grid');
  assert.equal(layoutModeFromDisplay('hidden'), 'hidden');
  assert.equal(layoutModeFromDisplay(''), 'frame');
  assert.equal(layoutModeFromDisplay('block'), 'frame');
});

test('frame children become absolute and stack children leave absolute', () => {
  const frame = layer({
    id: 'frame',
    classes: 'relative',
    design: { positioning: { isActive: true, position: 'relative' } },
  });
  const stack = layer({
    id: 'stack',
    classes: 'flex flex-col relative',
    design: {
      layout: { isActive: true, display: 'flex', flexDirection: 'column' },
      positioning: { isActive: true, position: 'relative' },
    },
  });
  const loose = layer({ id: 'child', classes: '' });
  const pinned = layer({
    id: 'pinned',
    classes: 'absolute',
    design: { positioning: { isActive: true, position: 'absolute' } },
  });
  const fixed = layer({
    id: 'fixed',
    classes: 'fixed',
    design: { positioning: { isActive: true, position: 'fixed' } },
  });

  assert.equal(containerLayoutKind(frame), 'frame');
  assert.equal(containerLayoutKind(stack), 'stack');
  assert.equal(containerLayoutKind(layer({ id: 'body', name: 'body', classes: '' })), 'flow');

  const inFrame = placeChildInParent(loose, frame);
  assert.match(String(inFrame.classes), /\babsolute\b/);
  assert.equal(inFrame.design?.positioning?.position, 'absolute');

  const inStack = placeChildInParent(pinned, stack);
  assert.match(String(inStack.classes), /\brelative\b/);
  assert.doesNotMatch(String(inStack.classes), /\babsolute\b/);

  assert.equal(placeChildInParent(fixed, frame).design?.positioning?.position, 'fixed');
  assert.equal(shouldRemapChildPosition('sticky', 'absolute'), false);
  assert.equal(shouldRemapChildPosition('relative', 'absolute'), true);
  assert.equal(shouldRemapChildPosition('absolute', 'relative'), true);
});

test('smaller breakpoints store class overrides and leave the base design', () => {
  const box = layer({
    id: 'box',
    classes: 'w-[320px]',
    design: { sizing: { isActive: true, width: '320px' } },
  });

  const phone = applyBreakpointDesign(
    box,
    [{ category: 'sizing', property: 'width', value: '100%' }],
    'mobile',
  );

  assert.equal(phone.design?.sizing?.width, '320px');
  assert.match(String(phone.classes), /max-md:w-full/);
  assert.match(String(phone.classes), /w-\[320px\]/);

  const cleared = stripBreakpointOverrides(String(phone.classes).split(' '), 'mobile');
  assert.deepEqual(cleared, ['w-[320px]']);
  assert.equal(isBreakpointOverride('mobile', 'mobile'), true);
  assert.equal(isBreakpointOverride('desktop', 'mobile'), false);
  assert.equal(isBreakpointOverride('desktop', 'desktop'), false);
});

test('desktop edits write the base design and class', () => {
  const box = layer({ id: 'box', classes: '', design: {} });
  const next = applyBreakpointDesign(
    box,
    [{ category: 'sizing', property: 'width', value: 'fit' }],
    'desktop',
  );
  assert.equal(next.design?.sizing?.width, 'fit');
  assert.match(String(next.classes), /\bw-fit\b/);
});
