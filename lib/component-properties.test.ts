import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ComponentVariable, Layer } from '@/types';
import { applyComponentOverrides } from '@/lib/resolve-components';
import { hasOverrideValues } from '@/lib/variable-utils';
import {
  applyControlBindings,
  applyControlValueToBoundLayers,
  clearPropertyOverride,
  isPropertyOverridden,
  propertyValuesEqual,
  readPropertyValue,
} from '@/lib/component-properties';

function layer(partial: Partial<Layer> & Pick<Layer, 'id'>): Layer {
  return {
    name: 'div',
    classes: 'flex p-4',
    design: {
      backgrounds: { isActive: true, backgroundColor: '#ffffff' },
      effects: { isActive: true, opacity: '100' },
    },
    ...partial,
  };
}

const variables: ComponentVariable[] = [
  { id: 'show', name: 'Visible', type: 'boolean', default_value: { type: 'boolean', value: true } },
  { id: 'fill', name: 'Fill', type: 'color', default_value: { type: 'color', value: '#ffffff' } },
  { id: 'fade', name: 'Opacity', type: 'number', default_value: { type: 'number', value: 100 }, min: 0, max: 100 },
  {
    id: 'tone',
    name: 'Tone',
    type: 'enum',
    options: [
      { id: 'calm', label: 'Calm' },
      { id: 'bold', label: 'Bold' },
    ],
    default_value: { type: 'enum', value: 'calm' },
  },
];

test('property controls use the component default until an instance overrides them', () => {
  const source = layer({
    id: 'card',
    name: 'text',
    controlBindings: { visible: 'show', fill: 'fill', opacity: 'fade', text: 'tone' },
    variables: { text: { type: 'dynamic_text', data: { content: 'Placeholder' } } },
  });

  const withDefaults = applyControlBindings(source, undefined, variables, { ephemeral: false });
  assert.equal(withDefaults.settings?.hidden, undefined);
  assert.equal(withDefaults.design?.backgrounds?.backgroundColor, '#ffffff');
  assert.equal(withDefaults.variables?.text?.type === 'dynamic_text' ? withDefaults.variables.text.data.content : '', 'Calm');
  assert.equal(withDefaults._dynamicStyles, undefined);

  const overridden = applyComponentOverrides(
    [source],
    {
      boolean: { show: { type: 'boolean', value: false } },
      color: { fill: { type: 'color', value: '#ff0000' } },
      number: { fade: { type: 'number', value: 40 } },
      enum: { tone: { type: 'enum', value: 'bold' } },
    },
    variables,
  )[0];

  assert.equal(overridden.settings?.hidden, true);
  assert.equal(overridden._dynamicStyles?.display, 'none');
  assert.equal(overridden._dynamicStyles?.backgroundColor, '#ff0000');
  assert.equal(overridden._dynamicStyles?.opacity, '0.4');
  assert.match(String(overridden.classes), /bg-\[#ff0000\]/);
  assert.match(String(overridden.classes), /opacity-\[40%\]/);
  assert.equal(overridden.variables?.text?.type === 'dynamic_text' ? overridden.variables.text.data.content : '', 'Bold');
  assert.doesNotMatch(String(overridden.classes), /bg-\[#ffffff\]/);
});

test('reset clears one override and leaves the others in place', () => {
  const fill = variables[1];
  const fade = variables[2];
  const overrides = {
    color: { fill: { type: 'color' as const, value: '#112233' } },
    number: { fade: { type: 'number' as const, value: 12 } },
  };

  assert.equal(isPropertyOverridden(fill, overrides), true);
  assert.equal(hasOverrideValues(overrides), true);

  const colorValue = readPropertyValue(fill, overrides);
  assert.equal(colorValue && 'value' in colorValue ? colorValue.value : undefined, '#112233');

  const cleared = clearPropertyOverride(overrides, fill);
  assert.equal(isPropertyOverridden(fill, cleared), false);
  assert.equal(isPropertyOverridden(fade, cleared), true);
  assert.equal(readPropertyValue(fill, cleared) && 'value' in readPropertyValue(fill, cleared)! 
    ? (readPropertyValue(fill, cleared) as { value: string }).value
    : undefined, '#ffffff');
  assert.equal(propertyValuesEqual(
    { type: 'color', value: '#AABBCC' },
    { type: 'color', value: '#aabbcc' },
  ), true);
  assert.equal(propertyValuesEqual(
    { type: 'boolean', value: false },
    { type: 'boolean', value: true },
  ), false);
});

test('writing a control default updates every bound layer and skips a no-op', () => {
  const tree = [
    layer({ id: 'a', controlBindings: { fill: 'fill' } }),
    layer({ id: 'b', children: [layer({ id: 'c', controlBindings: { opacity: 'fade' } })] }),
  ];
  const painted = applyControlValueToBoundLayers(
    tree,
    'fill',
    { type: 'color', value: '#00aa00' },
    variables,
  );
  assert.match(String(painted[0].classes), /bg-\[#00aa00\]/);
  assert.equal(painted[0]._dynamicStyles, undefined);
  assert.equal(painted[1].children?.[0].design?.effects?.opacity, '100');

  const faded = applyControlValueToBoundLayers(
    painted,
    'fade',
    { type: 'number', value: 25 },
    variables,
  );
  assert.match(String(faded[1].children?.[0].classes), /opacity-\[25%\]/);

  const again = applyControlValueToBoundLayers(
    faded,
    'fade',
    { type: 'number', value: 25 },
    variables,
  );
  assert.equal(again, faded);
});

test('a number bound to text replaces the layer copy', () => {
  const text = layer({
    id: 'label',
    name: 'text',
    controlBindings: { text: 'fade' },
    variables: { text: { type: 'dynamic_text', id: 'old', data: { content: '100' } } },
  });
  const next = applyControlBindings(
    text,
    { number: { fade: { type: 'number', value: 7 } } },
    variables,
  );
  assert.equal(next.variables?.text?.type === 'dynamic_text' ? next.variables.text.data.content : '', '7');
  assert.equal(next.variables?.text && 'id' in next.variables.text ? next.variables.text.id : undefined, undefined);
});
