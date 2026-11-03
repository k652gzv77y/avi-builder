import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LayerInteraction } from '@/types';
import { nextInteractionOwnerId } from '@/lib/interaction-owner';

function event(id: string, tweenLayerIds: string[] = []): LayerInteraction {
  return {
    id,
    trigger: 'press',
    timeline: { breakpoints: ['desktop'], repeat: 0, yoyo: false },
    tweens: tweenLayerIds.map((layerId, index) => ({
      id: `tw-${index}`,
      layer_id: layerId,
      position: 0,
      duration: 0.3,
      ease: 'power1.out',
      from: {},
      to: {},
      apply_styles: {},
    })),
  };
}

test('an empty selection clears the interactions owner', () => {
  assert.equal(nextInteractionOwnerId(null, 'text', 'int-1', [event('int-1')]), null);
});

test('selecting another layer leaves an open event that does not target it', () => {
  const interactions = [event('int-press')];
  assert.equal(
    nextInteractionOwnerId('image', 'text', 'int-press', interactions),
    'image',
  );
  assert.equal(
    nextInteractionOwnerId('container', 'text', 'int-press', interactions),
    'container',
  );
});

test('the owner follows a single layer and the last layer of a multi-select', () => {
  assert.equal(nextInteractionOwnerId('text', null, null, undefined), 'text');
  assert.equal(nextInteractionOwnerId('container', 'image', null, undefined), 'container');
});

test('selecting an animation target keeps the event owner', () => {
  const interactions = [event('int-tap', ['image'])];
  assert.equal(
    nextInteractionOwnerId('image', 'text', 'int-tap', interactions),
    'text',
  );
  assert.equal(
    nextInteractionOwnerId('text', 'text', 'int-tap', interactions),
    'text',
  );
  assert.equal(
    nextInteractionOwnerId('container', 'text', 'int-tap', interactions),
    'container',
  );
});
