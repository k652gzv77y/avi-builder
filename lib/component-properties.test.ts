import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Component, ComponentVariable, Layer } from '@/types';
import { serializeLayers } from '@/lib/layer-utils';
import { applyComponentOverrides, resolveComponents } from '@/lib/resolve-components';
import { hasOverrideValues, EMPTY_OVERRIDES } from '@/lib/variable-utils';
import {
  applyControlBindings,
  applyControlValueToBoundLayers,
  applyStructuredLayers,
  clearPropertyOverride,
  isObjectPropertyValue,
  isPropertyOverridden,
  isTextPropertyValue,
  propertyValuesEqual,
  readPropertyValue,
  stripControlBinding,
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

const authorFields = [
  { id: 'name', name: 'Name', type: 'text' as const },
  { id: 'tint', name: 'Tint', type: 'color' as const },
];

const authorVariable: ComponentVariable = {
  id: 'author',
  name: 'Author',
  type: 'object',
  fields: authorFields,
  default_value: {
    type: 'object',
    value: {
      name: { type: 'text', value: 'Ada' },
      tint: { type: 'color', value: '#111111' },
    },
  },
};

const listVariable: ComponentVariable = {
  id: 'features',
  name: 'Features',
  type: 'array',
  fields: [{ id: 'title', name: 'Title', type: 'text' }],
  default_value: {
    type: 'array',
    items: [{ id: 'default-item', value: { title: { type: 'text', value: 'Hello' } } }],
  },
};

const slotVariable: ComponentVariable = {
  id: 'body',
  name: 'Body',
  type: 'slot',
  default_value: { type: 'slot', layers: [] },
};

function textOf(node: Layer | undefined): string {
  const text = node?.variables?.text;
  if (text && text.type === 'dynamic_text') return text.data.content;
  return '';
}

function componentFixture(root: Layer, componentVariables: ComponentVariable[]): Component {
  return {
    id: 'cmp',
    name: 'Card',
    layers: [root],
    variables: componentVariables,
    is_published: false,
    created_at: '',
    updated_at: '',
  };
}

test('object and array overrides reset one property at a time', () => {
  const overrides = {
    object: {
      author: {
        type: 'object' as const,
        value: {
          name: { type: 'text' as const, value: 'Grace' },
          tint: { type: 'color' as const, value: '#abcdef' },
        },
      },
    },
    array: {
      features: {
        type: 'array' as const,
        items: [
          { id: 'a', value: { title: { type: 'text' as const, value: 'One' } } },
          { id: 'b', value: { title: { type: 'text' as const, value: 'Two' } } },
        ],
      },
    },
  };

  assert.equal(hasOverrideValues(overrides), true);
  assert.equal(isPropertyOverridden(authorVariable, overrides), true);
  assert.equal(propertyValuesEqual(
    { type: 'array', items: [{ id: 'a', value: { title: { type: 'text', value: 'One' } } }] },
    { type: 'array', items: [{ id: 'other', value: { title: { type: 'text', value: 'One' } } }] },
  ), true);

  const cleared = clearPropertyOverride(overrides, listVariable);
  assert.equal(isPropertyOverridden(listVariable, cleared), false);
  assert.equal(isPropertyOverridden(authorVariable, cleared), true);
  const author = readPropertyValue(authorVariable, cleared);
  assert.equal(author && 'value' in author && author.value && typeof author.value === 'object' && 'name' in author.value
    ? (author.value.name as { value: string }).value
    : '', 'Grace');

  const reset = clearPropertyOverride(cleared, authorVariable);
  assert.equal(hasOverrideValues(reset), false);
  assert.equal(hasOverrideValues(EMPTY_OVERRIDES), false);
  const restored = readPropertyValue(authorVariable, reset);
  assert.equal(objectFieldText(restored, 'name'), 'Ada');
});

function objectFieldText(value: ReturnType<typeof readPropertyValue>, fieldId: string): string {
  if (!isObjectPropertyValue(value)) return '';
  const field = value.value[fieldId];
  return isTextPropertyValue(field) ? field.value : '';
}

test('an object field binds like a top-level color or text control', () => {
  const card = layer({
    id: 'card',
    controlBindings: { fill: 'author.tint', text: 'author.name' },
    variables: { text: { type: 'dynamic_text', data: { content: 'Placeholder' } } },
  });
  const painted = applyControlBindings(card, undefined, [authorVariable], { ephemeral: false });
  assert.equal(painted.design?.backgrounds?.backgroundColor, '#111111');
  assert.equal(textOf(painted), 'Ada');

  const overridden = applyControlBindings(card, {
    object: {
      author: {
        type: 'object',
        value: {
          name: { type: 'text', value: 'Grace' },
          tint: { type: 'color', value: '#00ff00' },
        },
      },
    },
  }, [authorVariable], { ephemeral: true });
  assert.equal(overridden._dynamicStyles?.backgroundColor, '#00ff00');
  assert.equal(textOf(overridden), 'Grace');

  const stripped = stripControlBinding(card, 'author');
  assert.equal(stripped.controlBindings, undefined);
});

test('slot fallback stays until an instance replaces it, and reset restores it', () => {
  const fallback = layer({
    id: 'fallback',
    name: 'text',
    variables: { text: { type: 'dynamic_text', data: { content: 'Fallback' } } },
  });
  const slot = layer({
    id: 'slot',
    slotVariableId: 'body',
    children: [fallback],
  });
  const repeater = layer({
    id: 'list',
    repeatVariableId: 'features',
    children: [layer({
      id: 'title',
      name: 'text',
      controlBindings: { text: 'features.title' },
      variables: { text: { type: 'dynamic_text', data: { content: 'Template' } } },
    })],
  });
  const root = layer({ id: 'root', children: [slot, repeater] });
  const componentVariables = [authorVariable, listVariable, slotVariable];
  const component = componentFixture(root, componentVariables);

  const withFallback = resolveComponents(
    [layer({ id: 'inst', componentId: 'cmp' })],
    [component],
  )[0];
  assert.equal(textOf(withFallback.children?.[0].children?.[0]), 'Fallback');
  assert.equal(withFallback.children?.[1].children?.length, 1);
  assert.equal(textOf(withFallback.children?.[1].children?.[0]), 'Hello');

  const custom = layer({
    id: 'custom',
    name: 'text',
    variables: { text: { type: 'dynamic_text', data: { content: 'Custom' } } },
  });
  const overrides = {
    slot: { body: { type: 'slot' as const, layers: [custom] } },
    array: {
      features: {
        type: 'array' as const,
        items: [
          { id: 'a', value: { title: { type: 'text' as const, value: 'One' } } },
          { id: 'b', value: { title: { type: 'text' as const, value: 'Two' } } },
        ],
      },
    },
  };
  const replaced = resolveComponents(
    [layer({ id: 'inst', componentId: 'cmp', componentOverrides: overrides })],
    [component],
  )[0];
  assert.equal(textOf(replaced.children?.[0].children?.[0]), 'Custom');
  assert.equal(textOf(replaced.children?.[0].children?.[0]) === 'Fallback', false);
  assert.equal(replaced.children?.[1].children?.length, 2);
  assert.equal(textOf(replaced.children?.[1].children?.[0]), 'One');
  assert.equal(textOf(replaced.children?.[1].children?.[1]), 'Two');

  const onCanvas = serializeLayers(
    [layer({ id: 'inst', componentId: 'cmp', componentOverrides: overrides })],
    [component],
  ).layers[0];
  assert.equal(textOf(onCanvas.children?.[0].children?.[0]), 'Custom');
  assert.equal(onCanvas.children?.[1].children?.length, 2);
  assert.equal(textOf(onCanvas.children?.[1].children?.[0]), 'One');
  assert.equal(textOf(onCanvas.children?.[1].children?.[1]), 'Two');

  const hidden = applyStructuredLayers(
    [slot],
    { slot: { body: { type: 'slot', layers: [] } } },
    componentVariables,
    (nested) => nested,
  )[0];
  assert.equal(hidden.children?.length ?? 0, 0);

  const editing = serializeLayers([root], [], componentVariables).layers[0];
  assert.equal(editing.children?.[1].children?.length, 1);
  assert.equal(textOf(editing.children?.[1].children?.[0]), 'Template');

  const reset = clearPropertyOverride(overrides, slotVariable);
  assert.equal(isPropertyOverridden(slotVariable, reset), false);
  assert.equal(isPropertyOverridden(listVariable, reset), true);
  const restored = resolveComponents(
    [layer({ id: 'inst', componentId: 'cmp', componentOverrides: reset })],
    [component],
  )[0];
  assert.equal(textOf(restored.children?.[0].children?.[0]), 'Fallback');
});
