import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_DRAG_DISTANCE_PX,
  clampDragPoint,
  defaultDragTrigger,
  dragPastSlop,
  dragPhaseActions,
  dragVariantChoices,
  limitsForBounds,
  lockDragAxis,
  momentumCarry,
  nearestSnapPoint,
  projectDragMove,
  readDragTrigger,
  settleDragOffset,
  travelOnAxis,
} from '@/lib/drag-gesture';
import { bindDragInteraction, resetInteractiveVariants } from '@/lib/interaction-runtime';
import {
  EVENT_LABELS,
  createLayerInteraction,
  createNavigateAction,
  createSetVariantAction,
  interactionSummary,
  parseLayerInteractions,
  remapActionTarget,
  serializeLayerInteractions,
} from '@/lib/interactions-framer';
import { collectSetVariantTargets } from '@/lib/interactive-variants';
import { useInteractionPreviewStore } from '@/stores/useInteractionPreviewStore';
import type { DragTrigger, Layer, LayerInteraction } from '@/types';

const OPEN_LIMITS = { minX: null, maxX: null, minY: null, maxY: null };

function dragInteraction(partial: Partial<LayerInteraction> = {}): LayerInteraction {
  return {
    ...createLayerInteraction('drag-1', 'drag'),
    ...partial,
  };
}

test('drag is an authorable event and keeps a direction rule on set variant', () => {
  assert.equal(EVENT_LABELS.drag, 'Drag');
  assert.equal(DEFAULT_DRAG_DISTANCE_PX, 48);
  const authored = dragInteraction({
    drag: {
      axis: 'x',
      phase: 'both',
      momentum: true,
      bounds: { reference: 'parent', minX: -20, maxX: 160 },
      snap: [{ x: 0, y: 0 }, { x: 120, y: 0 }],
    },
    actions: [
      createSetVariantAction('act', 'card', 'open', {
        direction: 'right',
        distance: 32,
        release: 'return',
      }),
    ],
  });
  assert.equal(interactionSummary(authored), 'Drag → Set Variant');

  const stored = parseLayerInteractions(serializeLayerInteractions([authored]));
  assert.deepEqual(stored[0].drag, authored.drag);
  assert.deepEqual(stored[0].actions?.[0], authored.actions?.[0]);

  const filled = parseLayerInteractions(serializeLayerInteractions([
    { ...createLayerInteraction('plain', 'click'), trigger: 'drag', drag: undefined },
  ]));
  assert.deepEqual(filled[0].drag, defaultDragTrigger());

  assert.throws(
    () => readDragTrigger({ axis: 'diagonal' }),
    /Drag axis is not supported/,
  );

  const remapped = remapActionTarget(
    createSetVariantAction('act', 'card', 'open', { direction: 'left', distance: 12, release: 'stick' }),
    (id) => `next-${id}`,
  );
  assert.equal(remapped.type === 'set-variant' && remapped.targetLayerId, 'next-card');
  assert.equal(remapped.type === 'set-variant' && remapped.drag?.direction, 'left');
});

test('drag targets still publish their variant pane', () => {
  const layer: Layer = {
    id: 'card',
    name: 'div',
    classes: '',
    interactions: [dragInteraction({
      actions: [createSetVariantAction('act', 'card', 'open', {
        direction: 'right',
        distance: 24,
        release: 'stick',
      })],
    })],
  };
  assert.deepEqual(collectSetVariantTargets([layer]).get('card'), ['open']);
});

test('axis lock, bounds, snap, and momentum stay on the dragged layer', () => {
  assert.equal(dragPastSlop({ x: 3, y: 0 }), false);
  assert.deepEqual(
    lockDragAxis('both', { x: 2, y: 1 }, null),
    { delta: { x: 0, y: 0 }, locked: null },
  );
  assert.deepEqual(
    lockDragAxis('both', { x: 12, y: 4 }, null).locked,
    'x',
  );
  assert.deepEqual(
    lockDragAxis('x', { x: 12, y: 40 }, null).delta,
    { x: 12, y: 0 },
  );

  const parent = limitsForBounds(
    { reference: 'parent', minX: -10, maxX: 400 },
    { width: 40, height: 40 },
    { width: 200, height: 200 },
    { x: 20, y: 30 },
  );
  assert.deepEqual(parent, { minX: -10, maxX: 140, minY: -30, maxY: 130 });
  assert.deepEqual(
    limitsForBounds({ reference: 'px', maxX: 50 }, { width: 40, height: 40 }, { width: 200, height: 200 }, { x: 20, y: 30 }),
    { minX: null, maxX: 50, minY: null, maxY: null },
  );
  assert.deepEqual(clampDragPoint({ x: 80, y: -40 }, parent), { x: 80, y: -30 });

  assert.deepEqual(
    nearestSnapPoint({ x: 50, y: 4 }, [{ x: 0, y: 0 }, { x: 80, y: 20 }], 'x', 'x'),
    { x: 80, y: 4 },
  );
  assert.deepEqual(momentumCarry({ x: 10, y: 0 }, { x: 1, y: 0 }), { x: 190, y: 0 });
  assert.equal(momentumCarry({ x: 0, y: 0 }, { x: 10, y: 0 }).x, 240);

  const spec: DragTrigger = {
    axis: 'x',
    momentum: true,
    snap: [{ x: 0, y: 0 }, { x: 200, y: 40 }],
    bounds: { reference: 'px', maxX: 120 },
  };
  const moved = projectDragMove(spec, { x: 0, y: 0 }, { x: 30, y: 80 }, null, { minX: null, maxX: 120, minY: null, maxY: null });
  assert.equal(moved.active, true);
  assert.deepEqual(moved.offset, { x: 30, y: 0 });
  assert.deepEqual(
    settleDragOffset(spec, moved.offset, { x: 1, y: 4 }, moved.locked, { minX: null, maxX: 120, minY: null, maxY: null }),
    { x: 120, y: 0 },
  );
});

test('drag-to-variant picks a direction and the furthest threshold', () => {
  const actions = [
    createSetVariantAction('near', 'card', 'open', { direction: 'right', distance: 40, release: 'stick' }),
    createSetVariantAction('far', 'card', 'wide', { direction: 'right', distance: 80, release: 'stick' }),
    createSetVariantAction('back', 'card', 'shut', { direction: 'left', distance: 40, release: 'return' }),
    createSetVariantAction('up', 'card', 'raised', { direction: 'up', distance: 30, release: 'stick' }),
  ];
  assert.equal(dragVariantChoices({ x: 20, y: 0 }, actions).length, 0);
  assert.equal(dragVariantChoices({ x: 50, y: 0 }, actions)[0]?.variantId, 'open');
  assert.equal(dragVariantChoices({ x: 100, y: 0 }, actions)[0]?.variantId, 'wide');
  assert.equal(dragVariantChoices({ x: -50, y: 0 }, actions)[0]?.variantId, 'shut');
  assert.equal(dragVariantChoices({ x: -50, y: 0 }, actions)[0]?.release, 'return');
  assert.equal(dragVariantChoices({ x: 50, y: -80 }, actions)[0]?.variantId, 'raised');
  assert.equal(travelOnAxis({ x: -12, y: 3 }, 'left'), 12);

  const drag = dragInteraction({
    drag: { axis: 'free', phase: 'end' },
    actions: [
      ...actions,
      createNavigateAction('nav', 'url'),
    ],
  });
  assert.deepEqual(dragPhaseActions(drag, 'move').map(action => action.type), []);
  assert.deepEqual(dragPhaseActions(drag, 'end').map(action => action.type), ['navigate']);
  const moving = dragInteraction({
    drag: { axis: 'free', phase: 'move' },
    actions: [createSetVariantAction('plain', 'card', 'open'), createNavigateAction('nav', 'url')],
  });
  assert.deepEqual(dragPhaseActions(moving, 'move').map(action => action.id), ['plain', 'nav']);
  assert.deepEqual(dragPhaseActions(moving, 'end').map(action => action.id), []);
});

class FakeStyle {
  values: Record<string, string> = {};

  setProperty(name: string, value: string) {
    this.values[name] = value;
  }

  getPropertyValue(name: string) {
    return this.values[name] ?? '';
  }
}

class FakeElement {
  nodeType = 1;
  attributes = new Map<string, string>();
  style = new FakeStyle();
  parentElement: FakeElement | null = null;
  children: FakeElement[] = [];

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }

  contains(node: unknown): boolean {
    return node === this || this.children.some(child => child.contains(node));
  }

  appendChild(node: FakeElement) {
    node.parentElement = this;
    this.children.push(node);
  }
}

class FakeDocument {
  body = new FakeElement();
  private listeners = new Map<string, Set<(event: Event) => void>>();

  querySelector(selector: string) {
    const match = selector.match(/data-layer-id="([^"]+)"/);
    if (!match) return null;
    return this.find(this.body, match[1]);
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: Record<string, unknown>) {
    const payload = {
      preventDefault() {},
      stopPropagation() {},
      ...event,
    };
    for (const listener of this.listeners.get(type) ?? []) listener(payload as unknown as Event);
  }

  private find(node: FakeElement, id: string): FakeElement | null {
    if (node.getAttribute('data-layer-id') === id) return node;
    for (const child of node.children) {
      const found = this.find(child, id);
      if (found) return found;
    }
    return null;
  }
}

function addLayer(doc: FakeDocument, id: string) {
  const element = new FakeElement();
  element.setAttribute('data-layer-id', id);
  doc.body.appendChild(element);
  return element;
}

function pointer(target: FakeElement, x: number, y: number, time = 0) {
  return { target, button: 0, pointerId: 1, clientX: x, clientY: y, timeStamp: time };
}

function withoutAnimationFrame(run: () => void) {
  const original = globalThis.requestAnimationFrame;
  const had = 'requestAnimationFrame' in globalThis;
  Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
  try {
    run();
  } finally {
    if (had) globalThis.requestAnimationFrame = original;
  }
}

test('dragging past a threshold keeps or returns the variant, and the design canvas does not drag', () => {
  withoutAnimationFrame(() => {
    resetInteractiveVariants();
    const doc = new FakeDocument();
    const element = addLayer(doc, 'card');
    const stick = dragInteraction({
      drag: { axis: 'x', phase: 'end', snap: [{ x: 0, y: 0 }, { x: 80, y: 0 }] },
      actions: [createSetVariantAction('act', 'card', 'open', {
        direction: 'right',
        distance: 30,
        release: 'stick',
      })],
    });
    const cleanup = bindDragInteraction(doc as unknown as Document, 'card', stick, { live: true });
    assert.equal(element.getAttribute('data-drag-gesture'), 'true');

    doc.emit('pointerdown', pointer(element, 10, 10));
    doc.emit('pointermove', pointer(element, 12, 10, 16));
    assert.equal(element.style.getPropertyValue('translate'), '');
    assert.equal(useInteractionPreviewStore.getState().variantByLayerId.card, undefined);

    doc.emit('pointermove', pointer(element, 60, 30, 32));
    assert.equal(element.style.getPropertyValue('translate'), '50px 0px');
    assert.equal(useInteractionPreviewStore.getState().variantByLayerId.card, 'open');

    const click = {
      ...pointer(element, 60, 30),
      prevented: false,
      stopped: false,
      preventDefault() { click.prevented = true; },
      stopPropagation() { click.stopped = true; },
    };
    doc.emit('pointerup', pointer(element, 60, 30, 48));
    assert.equal(element.style.getPropertyValue('translate'), '80px 0px');
    assert.equal(useInteractionPreviewStore.getState().variantByLayerId.card, 'open');
    doc.emit('click', click);
    assert.equal(click.prevented, true);
    assert.equal(click.stopped, true);
    cleanup();

    resetInteractiveVariants();
    const returning = new FakeDocument();
    const back = addLayer(returning, 'card');
    const release = bindDragInteraction(returning as unknown as Document, 'card', dragInteraction({
      actions: [createSetVariantAction('act', 'card', 'shut', {
        direction: 'left',
        distance: 30,
        release: 'return',
      })],
    }), { live: true });
    returning.emit('pointerdown', pointer(back, 0, 0));
    returning.emit('pointermove', pointer(back, -40, 12, 20));
    assert.equal(useInteractionPreviewStore.getState().variantByLayerId.card, 'shut');
    returning.emit('pointerup', pointer(back, -40, 12, 40));
    assert.equal(useInteractionPreviewStore.getState().variantByLayerId.card, undefined);
    release();

    resetInteractiveVariants();
    const editing = new FakeDocument();
    const canvas = addLayer(editing, 'card');
    const ignored = bindDragInteraction(editing as unknown as Document, 'card', stick, { live: false });
    editing.emit('pointerdown', pointer(canvas, 0, 0));
    editing.emit('pointermove', pointer(canvas, 80, 0, 16));
    editing.emit('pointerup', pointer(canvas, 80, 0, 32));
    assert.equal(canvas.style.getPropertyValue('translate'), '');
    assert.equal(canvas.getAttribute('data-drag-gesture'), null);
    assert.equal(useInteractionPreviewStore.getState().variantByLayerId.card, undefined);
    ignored();
    resetInteractiveVariants();
  });
});
