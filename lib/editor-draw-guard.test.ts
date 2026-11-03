import assert from 'node:assert/strict';
import test from 'node:test';

import { chipClasses } from '@/lib/layer-style-resolve';
import {
  asLayerArray,
  filterDisabledSliderLayers,
  serializeLayers,
} from '@/lib/layer-utils';
import { extractPlainTextFromTiptap } from '@/lib/tiptap-utils';
import { classesToDesign } from '@/lib/tailwind-class-mapper';
import { flattenTree } from '@/lib/tree-utilities';
import { collectEditorHiddenLayerIds } from '@/lib/animation-utils';
import { getVariableCollectionItemCount } from '@/lib/variable-collections';
import type { Component, Layer, LayerStyle } from '@/types';

const bodyClasses = 'pl-[0px] justify-center h-[100%] w-[1200px] bg-[color:var(--d2047fee-6840-4b16-82fc-34a9f613f5e5)] pr-[0px] ml-auto mr-auto relative flex flex-row items-start flex-nowrap';
const navClasses = 'flex flex-col w-[100%] items-center pt-[20px] pb-[20px] bg-[color:var(--99f3f474-5616-4e45-b438-9ce8b695a7ef)]';

function homepageLayers(): { layers: Layer[]; component: Component } {
  const text = (id: string, label: string): Layer => ({
    id,
    name: 'text',
    classes: 'text-[14px] text-[#000000]/60',
    variables: {
      text: {
        type: 'dynamic_rich_text',
        data: {
          content: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ text: label, type: 'text' }] }],
          },
        },
      },
    },
  });

  const component: Component = {
    id: '5b283fcd-99d7-4d73-884f-f8b063633c2f',
    name: 'Navigation',
    layers: [],
    variables: [],
    is_published: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    variants: [{
      id: 'cmpvar-1',
      name: 'Default',
      layers: [{
        id: 'sec',
        name: 'section',
        classes: navClasses,
        children: [
          text('features', 'Features'),
          {
            id: 'menu-button',
            name: 'button',
            classes: 'hidden max-md:flex',
            children: [{
              id: 'icon',
              name: 'icon',
              classes: 'w-[20px] h-[20px]',
              variables: {
                icon: {
                  src: {
                    type: 'static_text',
                    data: { content: '<svg viewBox="0 0 24 24"></svg>' },
                  },
                },
              },
            }],
            interactions: [{
              id: 'int1',
              trigger: 'click',
              tweens: [{
                id: 'twn1',
                from: { display: 'hidden' },
                to: { display: 'visible' },
                duration: 0,
                ease: 'power1.out',
                layer_id: 'menu',
                position: '>',
                apply_styles: { display: 'on-load' },
              }],
              timeline: { yoyo: true, repeat: 0, breakpoints: ['mobile'] },
            }],
          },
        ],
      }],
    }],
  };

  const layers: Layer[] = [{
    id: 'body',
    name: 'body',
    classes: bodyClasses,
    children: [{
      id: 'nav-instance',
      name: 'section',
      classes: 'flex',
      children: [],
      componentId: component.id,
    }],
  }];

  return { layers, component };
}

test('a missing or non-array draft does not throw when the canvas reads layers', () => {
  assert.deepEqual(asLayerArray(null), []);
  assert.deepEqual(asLayerArray(undefined), []);
  assert.deepEqual(asLayerArray('not-layers'), []);
  assert.equal(filterDisabledSliderLayers(null as unknown as Layer[]).length, 0);
  assert.equal(flattenTree(null as unknown as Layer[]).length, 0);
});

test('homepage body plus navigation component resolves without throwing', () => {
  const { layers, component } = homepageLayers();
  const serialized = serializeLayers(layers, [component]);
  assert.equal(serialized.layers[0]?.id, 'body');
  assert.ok(serialized.layers[0]?.children && serialized.layers[0].children.length > 0);
  assert.equal(flattenTree(layers).length, 2);
  assert.doesNotThrow(() => collectEditorHiddenLayerIds(serialized.layers));
  assert.doesNotThrow(() => classesToDesign(bodyClasses));
  assert.doesNotThrow(() => classesToDesign(navClasses));
  assert.doesNotThrow(() => classesToDesign('text-[14px] text-[#000000]/60'));
});

test('rich text with a null block does not throw while the layers tree reads it', () => {
  const text = extractPlainTextFromTiptap({
    type: 'doc',
    content: [null, { type: 'paragraph', content: [{ type: 'text', text: 'Features' }] }],
  });
  assert.equal(text, 'Features');
  assert.equal(extractPlainTextFromTiptap(['star-saunders', 'anna-babcock']), '');
});

test('a non-string style override does not throw when the design panel splits classes', () => {
  const styles = new Map<string, LayerStyle>([
    ['base', { id: 'base', name: 'Base', classes: 'p-2' } as LayerStyle],
  ]);
  const layer = {
    styleOverridesByStyle: {
      base: { classes: { bad: true } as unknown as string },
    },
  };
  assert.equal(chipClasses(layer, 'base', styles), '');
  assert.doesNotThrow(() => chipClasses(layer, 'base', styles).split(' '));
});

test('variable counts tolerate a missing globals list', () => {
  assert.equal(getVariableCollectionItemCount('colors', 3, null), 3);
  assert.equal(getVariableCollectionItemCount('assets', 0, [{ type: 'image' }, null as unknown as { type: string }]), 1);
});

test('a circular component reference does not throw while serializing the canvas', () => {
  const component = {
    id: 'loop',
    name: 'Loop',
    layers: [],
    variables: [],
    is_published: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    variants: [{
      id: 'v',
      name: 'Default',
      layers: [{
        id: 'root',
        name: 'div',
        classes: '',
        children: [{ id: 'inner', name: 'div', classes: '', componentId: 'loop', children: [] }],
      }],
    }],
  };
  const layers: Layer[] = [{ id: 'body', name: 'body', classes: '', children: [{ id: 'inst', name: 'div', classes: '', componentId: 'loop', children: [] }] }];
  assert.doesNotThrow(() => serializeLayers(layers, [component]));
});
