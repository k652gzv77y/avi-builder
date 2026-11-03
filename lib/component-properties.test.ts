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
  colorValueToCss,
  isObjectPropertyValue,
  isPropertyOverridden,
  isTextPropertyValue,
  propertyValuesEqual,
  readPropertyValue,
  resolveEditorInstanceLayers,
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

const COLOR_VAR = '89befc96-1111-2222-3333-444444444444';
const OVERRIDE_VAR = 'abcdef12-1111-2222-3333-444444444444';

test('editor instance resolution paints merged overrides on the root and nested text', () => {
  const frame = layer({
    id: 'frame',
    classes: `flex bg-[color:var(--${COLOR_VAR})]`,
    design: {
      backgrounds: { isActive: true, backgroundColor: `color:var(--${COLOR_VAR})` },
      effects: { isActive: true, opacity: '100' },
    },
    controlBindings: { visible: 'show', fill: 'fill', opacity: 'fade' },
    children: [
      layer({
        id: 'label',
        name: 'text',
        controlBindings: { text: 'tone' },
        variables: { text: { type: 'dynamic_text', data: { content: '' } } },
      }),
    ],
  });

  const painted = resolveEditorInstanceLayers(
    [frame],
    {
      boolean: { show: { type: 'boolean', value: false } },
      color: { fill: { type: 'color', value: `color:var(--${OVERRIDE_VAR})` } },
      number: { fade: { type: 'number', value: 40 } },
      enum: { tone: { type: 'enum', value: 'bold' } },
    },
    variables,
  )[0];

  assert.equal(painted.settings?.hidden, true);
  assert.equal(painted._dynamicStyles?.display, 'none');
  assert.equal(painted._dynamicStyles?.backgroundColor, `var(--${OVERRIDE_VAR})`);
  assert.equal(painted._dynamicStyles?.opacity, '0.4');
  assert.match(String(painted.classes), new RegExp(`bg-\\[color:var\\(--${OVERRIDE_VAR}\\)\\]`));
  assert.match(String(painted.classes), /opacity-\[40%\]/);
  assert.doesNotMatch(String(painted.classes), new RegExp(COLOR_VAR));
  assert.equal(textOf(painted.children?.[0]), 'Bold');
});

test('preview resolution turns a color-variable override into paintable CSS', () => {
  const frame = layer({
    id: 'frame',
    name: 'text',
    classes: `flex bg-[color:var(--${COLOR_VAR})] opacity-[100%]`,
    design: {
      backgrounds: { isActive: true, backgroundColor: `color:var(--${COLOR_VAR})` },
      effects: { isActive: true, opacity: '100' },
    },
    controlBindings: { fill: 'fill', opacity: 'fade', text: 'fade' },
    variables: { text: { type: 'dynamic_text', data: { content: '100' } } },
  });
  const resolved = applyComponentOverrides(
    [frame],
    {
      color: { fill: { type: 'color', value: `color:var(--${OVERRIDE_VAR})` } },
      number: { fade: { type: 'number', value: 15 } },
    },
    variables,
  )[0];
  assert.equal(resolved._dynamicStyles?.backgroundColor, `var(--${OVERRIDE_VAR})`);
  assert.equal(resolved._dynamicStyles?.opacity, '0.15');
  assert.match(String(resolved.classes), new RegExp(`bg-\\[color:var\\(--${OVERRIDE_VAR}\\)\\]`));
  assert.match(String(resolved.classes), /opacity-\[15%\]/);
  assert.doesNotMatch(String(resolved.classes), new RegExp(COLOR_VAR));
  assert.equal(textOf(resolved), '15');
});

test('a hex default replaces a baked color-variable fill on the instance', () => {
  const frame = layer({
    id: 'frame',
    classes: `flex bg-[color:var(--${COLOR_VAR})]`,
    design: {
      backgrounds: { isActive: true, backgroundColor: `color:var(--${COLOR_VAR})` },
      effects: { isActive: true, opacity: '100' },
    },
    controlBindings: { fill: 'fill' },
  });
  const withHex = variables.map((variable) => (
    variable.id === 'fill'
      ? { ...variable, default_value: { type: 'color' as const, value: '#123456' } }
      : variable
  ));

  const painted = resolveEditorInstanceLayers([frame], undefined, withHex)[0];
  assert.match(String(painted.classes), /bg-\[#123456\]/);
  assert.doesNotMatch(String(painted.classes), new RegExp(COLOR_VAR));
  assert.equal(painted._dynamicStyles?.backgroundColor, '#123456');

  const faded = resolveEditorInstanceLayers(
    [frame],
    { color: { fill: { type: 'color', value: '#00ff00/40' } } },
    withHex,
  )[0];
  assert.match(String(faded.classes), /bg-\[#00ff00\]\/40/);
  assert.equal(faded._dynamicStyles?.backgroundColor, 'rgba(0,255,0,0.4)');
  assert.equal(colorValueToCss(`color:var(--${COLOR_VAR})`), `var(--${COLOR_VAR})`);
  assert.equal(colorValueToCss('#abc/50'), 'rgba(170,187,204,0.5)');
});

test('clearing overrides restores the primary control values on the instance', () => {
  const frame = layer({
    id: 'frame',
    classes: 'flex bg-[#000000]',
    design: {
      backgrounds: { isActive: true, backgroundColor: '#000000' },
      effects: { isActive: true, opacity: '100' },
    },
    controlBindings: { fill: 'fill', visible: 'show' },
  });
  const overrides = {
    color: { fill: { type: 'color' as const, value: '#ff0000' } },
    boolean: { show: { type: 'boolean' as const, value: false } },
  };
  const overridden = resolveEditorInstanceLayers([frame], overrides, variables)[0];
  assert.match(String(overridden.classes), /bg-\[#ff0000\]/);
  assert.equal(overridden.settings?.hidden, true);

  const reset = resolveEditorInstanceLayers(
    [frame],
    clearPropertyOverride(clearPropertyOverride(overrides, variables[0]), variables[1]),
    variables,
  )[0];
  assert.equal(reset.settings?.hidden, undefined);
  assert.match(String(reset.classes), /bg-\[#ffffff\]/);
  assert.doesNotMatch(String(reset.classes), /bg-\[#ff0000\]/);
  assert.doesNotMatch(String(reset.classes), /bg-\[#000000\]/);
});

test('canvas serialization paints fill and text overrides on the component root', () => {
  const root = layer({
    id: 'frame',
    classes: `flex bg-[color:var(--${COLOR_VAR})]`,
    design: {
      backgrounds: { isActive: true, backgroundColor: `color:var(--${COLOR_VAR})` },
      effects: { isActive: true, opacity: '100' },
    },
    controlBindings: { fill: 'fill' },
    children: [
      layer({
        id: 'label',
        name: 'text',
        controlBindings: { text: 'tone' },
        variables: { text: { type: 'dynamic_text', data: { content: '' } } },
      }),
    ],
  });
  const component = componentFixture(root, variables);
  const serialized = serializeLayers(
    [layer({
      id: 'inst',
      componentId: component.id,
      componentOverrides: {
        color: { fill: { type: 'color', value: '#ff00aa' } },
        enum: { tone: { type: 'enum', value: 'bold' } },
      },
    })],
    [component],
  ).layers[0];
  assert.match(String(serialized?.classes), /bg-\[#ff00aa\]/);
  assert.doesNotMatch(String(serialized?.classes), new RegExp(COLOR_VAR));
  assert.equal(serialized?._dynamicStyles?.backgroundColor, '#ff00aa');
  assert.equal(textOf(serialized?.children?.[0]), 'Bold');

  const editing = serializeLayers([root], [], variables.map((variable) => (
    variable.id === 'fill'
      ? { ...variable, default_value: { type: 'color' as const, value: '#123456' } }
      : variable
  ))).layers[0];
  assert.match(String(editing?.classes), /bg-\[#123456\]/);
  assert.equal(editing?._dynamicStyles?.backgroundColor, '#123456');
});
