import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Component, Layer } from '@/types';
import { isTextPropertyValue } from '@/lib/component-properties';
import {
  applyCopiedStyleInTree,
  captureLayerStyle,
  layerWithPastedStyle,
  visibleLayerForStyleCopy,
} from '@/lib/style-clipboard';

function layer(partial: Partial<Layer> & Pick<Layer, 'id'>): Layer {
  return {
    name: 'div',
    classes: '',
    ...partial,
  };
}

function cardComponent(): Component {
  return {
    id: 'cmp',
    name: 'Card',
    layers: [],
    is_published: false,
    created_at: '',
    updated_at: '',
    variables: [
      { id: 'fill', name: 'Fill', type: 'color', default_value: { type: 'color', value: '#ffffff' } },
      { id: 'fade', name: 'Opacity', type: 'number', default_value: { type: 'number', value: 100 }, min: 0, max: 100 },
    ],
    variants: [{
      id: 'primary',
      name: 'Default',
      layers: [layer({
        id: 'root',
        classes: 'bg-[#ffffff] w-[200px] opacity-[100%]',
        design: {
          backgrounds: { isActive: true, backgroundColor: '#ffffff' },
          sizing: { isActive: true, width: '200px' },
          effects: { isActive: true, opacity: '100%' },
        },
        controlBindings: { fill: 'fill', opacity: 'fade' },
      })],
    }],
  };
}

test('paste style copies visual properties and leaves position and size', () => {
  const source = layer({
    id: 'source',
    classes: [
      'bg-[#112233]',
      'border',
      'border-[#abcdef]',
      'rounded-[8px]',
      'shadow-md',
      'opacity-[40%]',
      'mix-blend-multiply',
      'blur-sm',
      'backdrop-blur-md',
      'rotate-[12deg]',
      'transition-opacity',
      'w-[80px]',
      'left-[4px]',
      'absolute',
      'max-md:bg-[#445566]',
      'max-md:left-[0px]',
      'hover:bg-[#00ff00]',
    ].join(' '),
    design: {
      backgrounds: { isActive: true, backgroundColor: '#112233' },
      borders: { isActive: true, borderWidth: '1px', borderColor: '#abcdef', borderRadius: '8px' },
      effects: { isActive: true, opacity: '40%', boxShadow: 'md', blur: 'sm', backdropBlur: 'md', mixBlendMode: 'multiply' },
      transforms: { isActive: true, rotate: '12deg' },
      transitions: { isActive: true, transitionProperty: 'opacity' },
      sizing: { isActive: true, width: '80px' },
      positioning: { isActive: true, position: 'absolute', left: '4px' },
    },
    interactions: [{
      id: 'tap',
      trigger: 'click',
      timeline: { breakpoints: ['desktop'], repeat: 0, yoyo: false },
      tweens: [],
    }],
  });

  const target = layer({
    id: 'target',
    classes: 'w-[240px] absolute top-[12px] max-md:w-[100px] bg-[#ffffff] text-[#999999]',
    design: {
      backgrounds: { isActive: true, backgroundColor: '#ffffff' },
      sizing: { isActive: true, width: '240px' },
      positioning: { isActive: true, position: 'absolute', top: '12px' },
      typography: { isActive: true, color: '#999999' },
    },
    interactions: [],
  });

  const copied = captureLayerStyle(source);
  assert.ok(copied.classes.includes('bg-[#112233]'));
  assert.ok(!copied.classes.includes('w-[80px]'));
  assert.ok(!copied.classes.includes('left-[4px]'));
  assert.deepEqual(
    copied.responsiveClasses.filter((token) => token.startsWith('max-md:')),
    ['max-md:bg-[#445566]', 'max-md:left-[0px]'],
  );

  const pasted = layerWithPastedStyle(target, copied, 'styles');
  assert.ok(pasted);
  const classes = String(pasted.classes);
  assert.match(classes, /bg-\[#112233\]/);
  assert.match(classes, /border/);
  assert.match(classes, /rounded-\[8px\]/);
  assert.match(classes, /shadow-md/);
  assert.match(classes, /opacity-\[40%\]/);
  assert.match(classes, /mix-blend-multiply/);
  assert.match(classes, /blur-sm/);
  assert.match(classes, /backdrop-blur-md/);
  assert.match(classes, /rotate-\[12deg\]/);
  assert.match(classes, /transition-opacity/);
  assert.match(classes, /max-md:bg-\[#445566\]/);
  assert.match(classes, /hover:bg-\[#00ff00\]/);
  assert.match(classes, /w-\[240px\]/);
  assert.match(classes, /top-\[12px\]/);
  assert.match(classes, /max-md:w-\[100px\]/);
  assert.doesNotMatch(classes, /w-\[80px\]/);
  assert.doesNotMatch(classes, /left-\[4px\]/);
  assert.doesNotMatch(classes, /max-md:left-/);
  assert.match(classes, /text-\[#999999\]/);
  assert.equal(pasted.design?.sizing?.width, '240px');
  assert.equal(pasted.design?.positioning?.top, '12px');
  assert.equal(pasted.design?.positioning?.left, undefined);
  assert.equal(pasted.design?.backgrounds?.backgroundColor, '#112233');
  assert.equal(pasted.design?.effects?.opacity, '40%');
  assert.equal(pasted.interactions?.length, 0);
});

test('typography pastes onto text and not onto frames', () => {
  const source = layer({
    id: 'label',
    name: 'text',
    classes: 'text-[#111111] text-[20px] font-bold bg-[#eeeeee]',
    design: {
      typography: { isActive: true, color: '#111111', fontSize: '20px', fontWeight: '700' },
      backgrounds: { isActive: true, backgroundColor: '#eeeeee' },
    },
  });
  const copied = captureLayerStyle(source);

  const frame = layerWithPastedStyle(layer({
    id: 'frame',
    classes: 'text-[#abcdef] w-[10px]',
    design: { typography: { isActive: true, color: '#abcdef' }, sizing: { width: '10px' } },
  }), copied, 'styles');
  assert.ok(frame);
  assert.match(String(frame.classes), /bg-\[#eeeeee\]/);
  assert.match(String(frame.classes), /text-\[#abcdef\]/);
  assert.doesNotMatch(String(frame.classes), /text-\[20px\]/);
  assert.equal(frame.design?.typography?.color, '#abcdef');
  assert.equal(frame.design?.sizing?.width, '10px');

  const text = layerWithPastedStyle(layer({
    id: 'copy',
    name: 'text',
    classes: 'text-[#abcdef] text-[12px]',
    design: { typography: { isActive: true, color: '#abcdef', fontSize: '12px' } },
  }), copied, 'styles');
  assert.ok(text);
  assert.match(String(text.classes), /text-\[#111111\]/);
  assert.match(String(text.classes), /text-\[20px\]/);
  assert.match(String(text.classes), /font-bold/);
  assert.equal(text.design?.typography?.color, '#111111');
  assert.equal(text.design?.typography?.fontSize, '20px');
});

test('a text gradient pastes onto text and does not paint a frame fill', () => {
  const source = layer({
    id: 'label',
    name: 'text',
    classes: 'bg-[linear-gradient(90deg,#000,#fff)] bg-clip-text text-transparent',
    design: {
      typography: { isActive: true, color: 'linear-gradient(90deg,#000,#fff)' },
    },
  });
  const copied = captureLayerStyle(source);

  const frame = layerWithPastedStyle(layer({
    id: 'frame',
    classes: 'bg-[#ffffff] w-[20px]',
    design: {
      backgrounds: { isActive: true, backgroundColor: '#ffffff' },
      sizing: { width: '20px' },
    },
  }), copied, 'styles');
  assert.ok(frame);
  assert.doesNotMatch(String(frame.classes), /bg-clip-text/);
  assert.doesNotMatch(String(frame.classes), /gradient/);
  assert.equal(frame.design?.backgrounds, undefined);
  assert.equal(frame.design?.sizing?.width, '20px');

  const text = layerWithPastedStyle(layer({
    id: 'copy',
    name: 'text',
    classes: 'text-[#111111]',
  }), copied, 'styles');
  assert.ok(text);
  assert.match(String(text.classes), /bg-clip-text/);
  assert.match(String(text.classes), /text-transparent/);
  assert.equal(text.design?.typography?.color, 'linear-gradient(90deg,#000,#fff)');
});

test('paste responsive transfers breakpoint overrides and leaves the desktop base', () => {
  const source = layer({
    id: 'source',
    classes: 'w-[320px] bg-[#111111] max-md:w-full max-lg:bg-[#222222] hover:bg-[#333333]',
    design: {
      sizing: { isActive: true, width: '320px' },
      backgrounds: { isActive: true, backgroundColor: '#111111' },
    },
  });
  const target = layer({
    id: 'target',
    classes: 'w-[100px] bg-[#ffffff] max-md:p-[4px]',
    design: {
      sizing: { isActive: true, width: '100px' },
      backgrounds: { isActive: true, backgroundColor: '#ffffff' },
    },
  });
  const copied = captureLayerStyle(source);
  const pasted = layerWithPastedStyle(target, copied, 'responsive');
  assert.ok(pasted);
  const classes = String(pasted.classes);
  assert.match(classes, /w-\[100px\]/);
  assert.match(classes, /bg-\[#ffffff\]/);
  assert.match(classes, /max-md:w-full/);
  assert.match(classes, /max-lg:bg-\[#222222\]/);
  assert.doesNotMatch(classes, /hover:bg-/);
  assert.doesNotMatch(classes, /max-md:p-/);
  assert.equal(pasted.design?.sizing?.width, '100px');
  assert.equal(pasted.design?.backgrounds?.backgroundColor, '#ffffff');
});

test('paste style keeps a shared style link and records the local override', () => {
  const source = layer({
    id: 'source',
    classes: 'bg-[#123456] rounded-[4px]',
    design: {
      backgrounds: { isActive: true, backgroundColor: '#123456' },
      borders: { isActive: true, borderRadius: '4px' },
    },
  });
  const target = layer({
    id: 'target',
    classes: 'bg-[#000000] w-[50px]',
    design: {
      backgrounds: { isActive: true, backgroundColor: '#000000' },
      sizing: { isActive: true, width: '50px' },
    },
    styleIds: ['heading'],
    styleId: 'heading',
    colorStyleIds: { backgroundColor: 'color-1', borderColor: 'color-2' },
  });
  const pasted = layerWithPastedStyle(target, captureLayerStyle(source), 'styles');
  assert.ok(pasted);
  assert.deepEqual(pasted.styleIds, ['heading']);
  assert.match(String(pasted.classes), /bg-\[#123456\]/);
  assert.match(String(pasted.classes), /w-\[50px\]/);
  assert.match(String(pasted.styleOverrides?.classes), /bg-\[#123456\]/);
  assert.equal(pasted.colorStyleIds, undefined);
});

test('copy from an instance uses the master plus fill and opacity overrides', () => {
  const component = cardComponent();
  const instance = layer({
    id: 'inst',
    classes: 'block',
    componentId: 'cmp',
    componentOverrides: {
      color: { fill: { type: 'color', value: '#ff00aa' } },
      number: { fade: { type: 'number', value: 40 } },
    },
  });
  const visible = visibleLayerForStyleCopy(instance, component);
  const copied = captureLayerStyle(visible);
  assert.equal(copied.design.backgrounds?.backgroundColor, '#ff00aa');
  assert.ok(copied.classes.some((token) => token.includes('ff00aa') || token.includes('FF00AA')));
  assert.ok(!copied.classes.includes('w-[200px]'));

  const other = layer({
    id: 'other',
    classes: 'block',
    componentId: 'cmp',
    componentOverrides: {
      text: { title: { type: 'text', value: 'Keep me' } },
    },
  });
  const pasted = layerWithPastedStyle(other, copied, 'styles', component);
  assert.ok(pasted);
  assert.equal(String(pasted.classes), 'block');
  assert.equal(pasted.componentOverrides?.color?.fill?.type === 'color'
    ? pasted.componentOverrides.color.fill.value
    : '', '#ff00aa');
  assert.equal(pasted.componentOverrides?.number?.fade?.type === 'number'
    ? pasted.componentOverrides.number.fade.value
    : -1, 40);
  const title = pasted.componentOverrides?.text?.title;
  assert.equal(isTextPropertyValue(title) ? title.value : '', 'Keep me');
});

test('paste responsive does not rewrite a component instance', () => {
  const component = cardComponent();
  const instance = layer({
    id: 'inst',
    classes: 'block',
    componentId: 'cmp',
  });
  const copied = captureLayerStyle(layer({
    id: 'source',
    classes: 'bg-[#111111] max-md:w-full',
    design: { backgrounds: { isActive: true, backgroundColor: '#111111' } },
  }));
  assert.equal(layerWithPastedStyle(instance, copied, 'responsive', component), null);
});

test('paste style updates every selected layer and skips unbound instances', () => {
  const component = cardComponent();
  const copied = captureLayerStyle(layer({
    id: 'source',
    classes: 'bg-[#010203] opacity-[25%]',
    design: {
      backgrounds: { isActive: true, backgroundColor: '#010203' },
      effects: { isActive: true, opacity: '25%' },
    },
  }));
  const unbound = layer({
    id: 'plain-instance',
    classes: 'block',
    componentId: 'cmp',
  });
  const tree = [
    layer({ id: 'a', classes: 'w-[10px] bg-[#ffffff]', design: { sizing: { width: '10px' } } }),
    layer({ id: 'b', classes: 'w-[20px]', design: { sizing: { width: '20px' } }, children: [unbound] }),
  ];
  const master = {
    ...component,
    variants: [{
      ...component.variants![0],
      layers: [layer({ id: 'root', classes: 'w-[200px]', design: { sizing: { width: '200px' } } })],
    }],
  };
  const next = applyCopiedStyleInTree(tree, ['a', 'plain-instance'], copied, 'styles', () => master);
  assert.match(String(next[0].classes), /bg-\[#010203\]/);
  assert.match(String(next[0].classes), /w-\[10px\]/);
  assert.equal(next[1], tree[1]);
  assert.equal(String(next[1].children?.[0].classes), 'block');
  assert.equal(next[1].children?.[0].componentOverrides, undefined);
});
