import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Layer, LayerStyle } from '@/types';
import {
  applyNamedColorStyle,
  applyNamedTextStyle,
  colorStyleClasses,
  colorStyleDesign,
  colorStyleValue,
  reapplyLinkedNamedStyles,
  textStylePayload,
} from '@/lib/design-styles';
import { updateLayersWithStyle } from '@/lib/layer-style-utils';

function layer(partial: Partial<Layer> & Pick<Layer, 'id'>): Layer {
  return { name: 'text', classes: '', ...partial };
}

function textStyle(id: string, fontSize: string, color: string): LayerStyle {
  const payload = textStylePayload({ fontSize, color, isActive: true });
  return {
    id,
    name: 'Body',
    group: 'text-style',
    classes: payload.classes,
    design: payload.design,
    is_published: false,
    created_at: '',
    updated_at: '',
  };
}

test('text style payload uses typography classes', () => {
  const payload = textStylePayload({ fontSize: '16px', fontWeight: '700', isActive: true });
  assert.match(payload.classes, /text-\[16px\]/);
  assert.match(payload.classes, /font-\[700\]/);
});

test('applying a text style links the layer and can be updated everywhere', () => {
  const style = textStyle('ts-1', '16px', '#111111');
  const linked = applyNamedTextStyle(layer({ id: 'a', classes: 'w-full' }), style);
  assert.equal(linked.namedTextStyleId, 'ts-1');
  assert.match(String(linked.classes), /text-\[16px\]/);
  assert.match(String(linked.classes), /w-full/);

  const renamed = {
    ...style,
    ...(() => {
      const payload = textStylePayload({ fontSize: '20px', color: '#ff0000', isActive: true });
      return { classes: payload.classes, design: payload.design };
    })(),
  };
  const styles = new Map([[renamed.id, renamed]]);
  const [updated] = updateLayersWithStyle([linked], renamed.id, styles);
  assert.match(String(updated.classes), /text-\[20px\]/);
  assert.match(String(updated.classes), /text-\[#ff0000\]/);
  assert.equal(updated.namedTextStyleId, 'ts-1');
  assert.equal(updated.design?.typography?.fontSize, '20px');
});

test('color styles apply to fill and text and follow the shared value', () => {
  const style: LayerStyle = {
    id: 'c-1',
    name: 'Brand',
    group: 'color-style',
    classes: colorStyleClasses('#3366ff'),
    design: colorStyleDesign('#3366ff'),
    is_published: false,
    created_at: '',
    updated_at: '',
  };
  assert.equal(colorStyleValue(style), '#3366ff');

  const fill = applyNamedColorStyle(layer({ id: 'box', name: 'div', classes: 'p-4' }), style, 'backgroundColor');
  const text = applyNamedColorStyle(layer({ id: 'label', classes: '' }), style, 'color');
  assert.match(String(fill.classes), /bg-\[#3366ff\]/);
  assert.match(String(fill.classes), /p-4/);
  assert.match(String(text.classes), /text-\[#3366ff\]/);
  assert.equal(fill.colorStyleIds?.backgroundColor, 'c-1');

  const next: LayerStyle = {
    ...style,
    classes: colorStyleClasses('#00aa00'),
    design: colorStyleDesign('#00aa00'),
  };
  const styles = new Map([[next.id, next]]);
  const refreshed = reapplyLinkedNamedStyles(fill, styles);
  assert.match(String(refreshed.classes), /bg-\[#00aa00\]/);
  assert.doesNotMatch(String(refreshed.classes), /bg-\[#3366ff\]/);
  assert.equal(refreshed.design?.backgrounds?.backgroundColor, '#00aa00');
});
