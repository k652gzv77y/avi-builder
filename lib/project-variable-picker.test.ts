import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Layer } from '@/types';
import {
  applyStyleBindings,
  boundProjectVariableId,
  buildProjectVariableOptions,
  colorTokenValue,
  designColorVariablesPatch,
  globalColorField,
  groupProjectVariables,
  opacityFromVariable,
  readColorTokenId,
  readGlobalColorId,
  sizeFromVariable,
  styleBindingPatch,
} from '@/lib/project-variable-picker';

const catalog = {
  colorVariables: [
    { id: 'brand', name: 'Brand/Primary', value: '#112233' },
    { id: 'ink', name: 'Ink', value: '#000000' },
  ],
  globals: [
    { id: 'title', name: 'Site/Title', type: 'text', value: 'Hello' },
    { id: 'gap', name: 'Spacing/Page', type: 'number', value: '24' },
    { id: 'accent', name: 'Accent', type: 'color', value: '#abcdef' },
  ],
};

function layer(partial: Partial<Layer> & Pick<Layer, 'id'>): Layer {
  return {
    name: 'div',
    classes: '',
    ...partial,
  };
}

test('picker lists compatible variables and groups folders ahead of types', () => {
  const colors = buildProjectVariableOptions(catalog, 'fill');
  assert.deepEqual(colors.map(item => item.id), ['global:accent', 'color:ink', 'color:brand']);
  const colorGroups = groupProjectVariables(colors);
  assert.equal(colorGroups[0]?.label, 'No folder');
  assert.deepEqual(colorGroups[0]?.items.map(item => item.leaf), ['Accent', 'Ink']);
  assert.equal(colorGroups[1]?.label, 'Brand');
  assert.equal(colorGroups[1]?.items[0]?.leaf, 'Primary');

  const sizes = buildProjectVariableOptions(catalog, 'width');
  assert.deepEqual(sizes.map(item => item.sourceId), ['gap']);
  assert.equal(groupProjectVariables(sizes, 'page')[0]?.items[0]?.leaf, 'Page');
  assert.equal(groupProjectVariables(sizes, 'missing').length, 0);

  const text = buildProjectVariableOptions(catalog, 'text');
  assert.deepEqual(text.map(item => item.type), ['number', 'text']);
  const rich = buildProjectVariableOptions(catalog, 'text', true);
  assert.equal(rich.some(item => item.type === 'text'), true);
});

test('color bindings round-trip tokens and global fields', () => {
  assert.equal(readColorTokenId(colorTokenValue('brand')), 'brand');
  assert.equal(readColorTokenId('#fff'), null);

  const base = layer({ id: 'box', design: { backgrounds: { backgroundColor: '#ffffff' } } });
  const bound = designColorVariablesPatch(base, 'backgroundColor', globalColorField('accent'));
  assert.equal(readGlobalColorId(bound.variables?.design?.backgroundColor), 'accent');
  assert.equal(boundProjectVariableId('fill', { ...base, ...bound }, '#ffffff'), 'global:accent');
  assert.equal(boundProjectVariableId('fill', base, colorTokenValue('brand')), 'color:brand');

  const cleared = designColorVariablesPatch({ ...base, ...bound }, 'backgroundColor', undefined);
  assert.equal(cleared.variables?.design, undefined);
});

test('number bindings resolve at render and unbind keeps the literal', () => {
  assert.equal(opacityFromVariable('0.4'), '40');
  assert.equal(opacityFromVariable('80%'), '80');
  assert.equal(sizeFromVariable('24px'), '24px');
  assert.equal(sizeFromVariable('about 12'), '12');

  const source = layer({
    id: 'card',
    classes: 'opacity-[100%] w-[10px]',
    design: {
      effects: { isActive: true, opacity: '100' },
      sizing: { isActive: true, width: '10' },
    },
    variables: {
      style: {
        opacity: { globalId: 'fade', literal: '100' },
        width: { globalId: 'gap', literal: '10' },
      },
    },
  });

  const resolved = applyStyleBindings(source, { fade: '40', gap: '24' });
  assert.equal(resolved.design?.effects?.opacity, '40');
  assert.equal(resolved.design?.sizing?.width, '24');
  assert.match(String(resolved.classes), /opacity-\[40%\]/);
  assert.match(String(resolved.classes), /w-\[24px\]/);
  assert.equal(source.design?.effects?.opacity, '100');
  assert.equal(boundProjectVariableId('opacity', source), 'global:fade');

  assert.equal(applyStyleBindings(source, { fade: '' }), source);

  const unbound = styleBindingPatch(source, 'opacity', undefined);
  assert.equal(unbound.variables?.style?.opacity, undefined);
  assert.equal(unbound.variables?.style?.width?.literal, '10');
  assert.equal(boundProjectVariableId('opacity', { ...source, ...unbound }), null);
});
