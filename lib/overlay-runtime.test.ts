import { test } from 'node:test';
import assert from 'node:assert/strict';

import { closeOpenOverlays, runInteractionActions } from '@/lib/interaction-runtime';
import { createOverlayAction } from '@/lib/interactions-framer';
import type { LayerInteraction } from '@/types';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

class FakeStyle {
  values: Record<string, string> = {};

  get display() { return this.values.display ?? ''; }
  set display(value: string) { this.values.display = value; }
  get visibility() { return this.values.visibility ?? ''; }
  set visibility(value: string) { this.values.visibility = value; }
  get position() { return this.values.position ?? ''; }
  set position(value: string) { this.values.position = value; }
  get top() { return this.values.top ?? ''; }
  set top(value: string) { this.values.top = value; }
  get left() { return this.values.left ?? ''; }
  set left(value: string) { this.values.left = value; }
  get right() { return this.values.right ?? ''; }
  set right(value: string) { this.values.right = value; }
  get bottom() { return this.values.bottom ?? ''; }
  set bottom(value: string) { this.values.bottom = value; }
  get margin() { return this.values.margin ?? ''; }
  set margin(value: string) { this.values.margin = value; }
  get transform() { return this.values.transform ?? ''; }
  set transform(value: string) { this.values.transform = value; }
  get zIndex() { return this.values.zIndex ?? ''; }
  set zIndex(value: string) { this.values.zIndex = value; }
  get inset() { return this.values.inset ?? ''; }
  set inset(value: string) { this.values.inset = value; }
  get background() { return this.values.background ?? ''; }
  set background(value: string) { this.values.background = value; }

  removeProperty(name: string) {
    delete this.values[name];
    const camel = name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    delete this.values[camel];
  }
}

class FakeElement {
  nodeType = 1;
  attributes = new Map<string, string>();
  dataset: Record<string, string> = {};
  style = new FakeStyle();
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  ownerDocument: FakeDocument;
  offsetWidth: number;
  offsetHeight: number;
  rect: Box;
  listeners = new Map<string, Set<(event: Event) => void>>();

  constructor(doc: FakeDocument, box: Box) {
    this.ownerDocument = doc;
    this.rect = box;
    this.offsetWidth = box.width;
    this.offsetHeight = box.height;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string) {
    return this.attributes.has(name);
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }

  getBoundingClientRect() {
    const { top, left, width, height } = this.rect;
    return { top, left, width, height, bottom: top + height, right: left + width, x: left, y: top };
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  contains(node: unknown): boolean {
    if (node === this) return true;
    return this.children.some(child => child.contains(node));
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  insertBefore(node: FakeElement, ref: FakeElement | null) {
    node.remove();
    node.parentElement = this;
    const index = ref ? this.children.indexOf(ref) : this.children.length;
    this.children.splice(index < 0 ? this.children.length : index, 0, node);
  }

  appendChild(node: FakeElement) {
    this.insertBefore(node, null);
  }

  remove() {
    this.parentElement?.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = null;
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: { target?: unknown; key?: string; shiftKey?: boolean; preventDefault?: () => void; stopImmediatePropagation?: () => void }) {
    for (const listener of this.listeners.get(type) ?? []) listener(event as Event);
  }
}

class FakeDocument {
  body: FakeElement;
  documentElement: FakeElement;
  activeElement: FakeElement | null = null;
  defaultView = {
    innerWidth: 400,
    innerHeight: 300,
    addEventListener() {},
    removeEventListener() {},
    getComputedStyle() {
      return { display: 'block', visibility: 'visible' };
    },
  };

  constructor() {
    this.documentElement = new FakeElement(this, { top: 0, left: 0, width: 400, height: 300 });
    this.body = new FakeElement(this, { top: 0, left: 0, width: 400, height: 300 });
    this.documentElement.appendChild(this.body);
  }

  createElement() {
    return new FakeElement(this, { top: 0, left: 0, width: 0, height: 0 });
  }

  querySelector(selector: string) {
    const match = selector.match(/data-layer-id="([^"]+)"/);
    if (!match) return null;
    return this.find(this.body, match[1]);
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    this.documentElement.addEventListener(type, listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    this.documentElement.removeEventListener(type, listener);
  }

  emit(type: string, event: Parameters<FakeElement['emit']>[1]) {
    this.documentElement.emit(type, event);
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

function layer(doc: FakeDocument, id: string, box: Box) {
  const element = new FakeElement(doc, box);
  element.offsetWidth = box.width;
  element.offsetHeight = box.height;
  element.setAttribute('data-layer-id', id);
  doc.body.appendChild(element);
  return element;
}

function interaction(action: ReturnType<typeof createOverlayAction>): LayerInteraction {
  return {
    id: 'int-1',
    trigger: 'click',
    timeline: { breakpoints: ['desktop'], repeat: 0, yoyo: false },
    tweens: [],
    actions: [action],
  };
}

function open(doc: FakeDocument, action: ReturnType<typeof createOverlayAction>, trigger: FakeElement | null) {
  runInteractionActions(doc as unknown as Document, interaction(action), trigger as unknown as HTMLElement | null, { live: true });
}

test('a modal opens centered, traps the page behind a backdrop, and closes from Escape, the backdrop, and Close Overlay', () => {
  const doc = new FakeDocument();
  const trigger = layer(doc, 'button', { top: 20, left: 20, width: 80, height: 32 });
  const overlay = layer(doc, 'dialog', { top: 0, left: 0, width: 200, height: 100 });
  open(doc, createOverlayAction('open', 'open', 'dialog', 'fixed', 'modal'), trigger);

  assert.equal(overlay.getAttribute('data-overlay-open'), 'modal');
  assert.equal(overlay.getAttribute('role'), 'dialog');
  assert.equal(overlay.getAttribute('aria-modal'), 'true');
  assert.equal(overlay.style.top, '100px');
  assert.equal(overlay.style.left, '100px');
  assert.equal(overlay.style.position, 'fixed');
  const backdrop = doc.body.children.find(child => child.getAttribute('data-overlay-backdrop') === 'dialog');
  assert.ok(backdrop);
  assert.equal(backdrop.style.background.includes('0.45'), true);
  assert.equal(doc.activeElement, overlay);

  const escape = { key: 'Escape', prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  doc.emit('keydown', escape);
  assert.equal(escape.prevented, true);
  assert.equal(escape.stopped, true);
  assert.equal(overlay.style.display, 'none');
  assert.equal(overlay.hasAttribute('data-overlay-open'), false);
  assert.equal(doc.body.children.includes(backdrop), false);
  assert.equal(doc.activeElement, trigger);

  open(doc, createOverlayAction('open', 'open', 'dialog', 'fixed', 'modal'), trigger);
  const backdropAgain = doc.body.children.find(child => child.getAttribute('data-overlay-backdrop') === 'dialog');
  assert.ok(backdropAgain);
  doc.emit('pointerdown', { target: backdropAgain });
  assert.equal(overlay.style.display, 'none');
  assert.equal(doc.body.children.includes(backdropAgain), false);

  open(doc, createOverlayAction('open', 'open', 'dialog', 'fixed', 'modal'), trigger);
  open(doc, createOverlayAction('close', 'close', 'dialog'), trigger);
  assert.equal(overlay.style.display, 'none');
  assert.equal(doc.body.children.some(child => child.getAttribute('data-overlay-backdrop') === 'dialog'), false);
  closeOpenOverlays();
});

test('an anchored popover flips above the trigger and stays open when the trigger is clicked', () => {
  const doc = new FakeDocument();
  const trigger = layer(doc, 'button', { top: 250, left: 30, width: 40, height: 30 });
  const overlay = layer(doc, 'pop', { top: 0, left: 0, width: 100, height: 80 });
  const action = createOverlayAction('open', 'open', 'pop', 'relative', 'popover');
  action.anchor = 'bottom';
  open(doc, action, trigger);

  assert.equal(overlay.getAttribute('role'), 'dialog');
  assert.equal(overlay.hasAttribute('aria-modal'), false);
  assert.equal(overlay.style.top, '162px');
  assert.equal(overlay.style.left, '30px');
  assert.equal(doc.body.children.some(child => child.hasAttribute('data-overlay-backdrop')), false);

  doc.emit('pointerdown', { target: trigger });
  assert.equal(overlay.getAttribute('data-overlay-open'), 'popover');

  doc.emit('pointerdown', { target: doc.body });
  assert.equal(overlay.style.display, 'none');
  closeOpenOverlays();
});

test('a sheet sits on the bottom edge over a backdrop', () => {
  const doc = new FakeDocument();
  const trigger = layer(doc, 'button', { top: 20, left: 20, width: 80, height: 32 });
  const overlay = layer(doc, 'sheet', { top: 0, left: 0, width: 200, height: 80 });
  open(doc, createOverlayAction('open', 'open', 'sheet', 'fixed', 'sheet'), trigger);

  assert.equal(overlay.style.top, '212px');
  assert.equal(overlay.style.left, '100px');
  assert.equal(overlay.getAttribute('aria-modal'), 'true');
  assert.ok(doc.body.children.some(child => child.getAttribute('data-overlay-backdrop') === 'sheet'));
  closeOpenOverlays();
});

test('Tab wraps inside a modal', () => {
  const doc = new FakeDocument();
  const trigger = layer(doc, 'button', { top: 20, left: 20, width: 80, height: 32 });
  const overlay = layer(doc, 'dialog', { top: 0, left: 0, width: 200, height: 100 });
  const first = new FakeElement(doc, { top: 0, left: 0, width: 10, height: 10 });
  const last = new FakeElement(doc, { top: 0, left: 0, width: 10, height: 10 });
  overlay.querySelectorAll = () => [first, last] as unknown as never[];
  open(doc, createOverlayAction('open', 'open', 'dialog', 'fixed', 'modal'), trigger);
  assert.equal(doc.activeElement, first);

  const tab = { key: 'Tab', shiftKey: false, prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} };
  doc.activeElement = last;
  doc.emit('keydown', tab);
  assert.equal(tab.prevented, true);
  assert.equal(doc.activeElement, first);
  closeOpenOverlays();
});

test('a tooltip does not take focus and Escape can be turned off', () => {
  const doc = new FakeDocument();
  const trigger = layer(doc, 'button', { top: 40, left: 16, width: 80, height: 24 });
  const overlay = layer(doc, 'tip', { top: 0, left: 0, width: 120, height: 40 });
  const action = createOverlayAction('open', 'open', 'tip', 'relative', 'tooltip');
  action.dismiss = { escape: false, outside: true, restoreFocus: false };
  open(doc, action, trigger);

  assert.equal(overlay.getAttribute('role'), 'tooltip');
  assert.equal(overlay.style.top, '72px');
  assert.equal(overlay.style.left, '16px');
  assert.equal(doc.activeElement, null);

  doc.emit('keydown', { key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
  assert.equal(overlay.getAttribute('data-overlay-open'), 'tooltip');

  doc.emit('pointerdown', { target: doc.body });
  assert.equal(overlay.style.display, 'none');
  closeOpenOverlays();
});
