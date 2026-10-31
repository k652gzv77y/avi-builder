import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCodeOverrideProps,
  buildCodeComponentInstance,
  controlIdFromName,
  isCodeComponent,
  markupForCodeLayer,
  mergeOverrideClass,
  readCodeComponent,
  renderCodeTemplate,
  resolveControlValues,
  sanitizeCodeOverride,
  validatePropertyControls,
} from '@/lib/code-components';
import type { Component, Layer, PropertyControl } from '@/types';

const controls: PropertyControl[] = [
  { id: 'title', name: 'Title', type: 'string', defaultValue: 'Hello' },
  { id: 'count', name: 'Count', type: 'number', defaultValue: 1, min: 0, max: 5 },
  { id: 'on', name: 'On', type: 'boolean', defaultValue: false },
  { id: 'tone', name: 'Tone', type: 'enum', options: ['calm', 'bold'], defaultValue: 'calm' },
];

function component(partial: Partial<Component> = {}): Component {
  return {
    id: 'cmp-1',
    name: 'Greeting',
    layers: [{
      id: 'src',
      name: 'codeComponent',
      classes: '',
      settings: {
        codeComponent: {
          source: '<p>{{title}} {{count}} {{on}} {{tone}}</p>',
          controls,
        },
      },
    }],
    is_published: false,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

test('property controls reject duplicate ids and empty enums', () => {
  assert.equal(validatePropertyControls(controls), null);
  assert.match(validatePropertyControls([
    { id: 'title', name: 'A', type: 'string' },
    { id: 'title', name: 'B', type: 'string' },
  ]) || '', /more than once/);
  assert.match(validatePropertyControls([
    { id: 'tone', name: 'Tone', type: 'enum', options: [] },
  ]) || '', /at least one option/);
});

test('control ids stay unique and token-safe', () => {
  const taken = new Set(['text']);
  assert.equal(controlIdFromName('Text', taken), 'text-2');
  assert.equal(controlIdFromName('1 Color', new Set()), 'color');
});

test('instance values fall back to defaults and stay inside number bounds', () => {
  const values = resolveControlValues(controls, { count: 9, on: true, tone: 'nope' });
  assert.equal(values.title, 'Hello');
  assert.equal(values.count, '5');
  assert.equal(values.on, 'true');
  assert.equal(values.tone, 'calm');
});

test('template tokens are escaped and unknown tokens stay', () => {
  const html = renderCodeTemplate('<p>{{title}}</p>{{missing}}', { title: '<b>Hi</b>' });
  assert.equal(html, '<p>&lt;b&gt;Hi&lt;/b&gt;</p>{{missing}}');
});

test('a code component is stored on the component and placed without componentId', () => {
  const master = component();
  assert.equal(isCodeComponent(master), true);
  assert.equal(readCodeComponent(master)?.controls[0].id, 'title');
  const instance = buildCodeComponentInstance(master);
  assert.equal(instance.componentId, undefined);
  assert.equal(instance.settings?.codeComponent?.componentId, 'cmp-1');
  assert.equal(markupForCodeLayer(instance, [master]), '<p>Hello 1 false calm</p>');
});

test('code overrides only keep classes and data or aria attributes', () => {
  const clean = sanitizeCodeOverride({
    className: 'rounded-md <script>',
    attributes: {
      'data-theme': 'dark',
      'aria-label': 'Greeting',
      onclick: 'alert(1)',
      href: 'https://example.com',
    },
  });
  assert.deepEqual(clean, {
    className: 'rounded-md',
    attributes: { 'data-theme': 'dark', 'aria-label': 'Greeting' },
  });
  assert.equal(mergeOverrideClass('flex', clean), 'flex rounded-md');

  const props: { className?: unknown } & Record<string, unknown> = { className: 'flex' };
  applyCodeOverrideProps(props, clean);
  assert.equal(props.className, 'flex rounded-md');
  assert.equal(props['data-theme'], 'dark');
  assert.equal(props.onclick, undefined);
});

test('visual components are not treated as code components', () => {
  const visual: Layer[] = [{ id: 'a', name: 'div', classes: '' }];
  assert.equal(isCodeComponent({ layers: visual, variants: [] }), false);
});
