import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tweenTransition } from '@/lib/action-transition';
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
  get width() { return this.values.width ?? ''; }
  set width(value: string) { this.values.width = value; }
  get height() { return this.values.height ?? ''; }
  set height(value: string) { this.values.height = value; }
  get maxWidth() { return this.values.maxWidth ?? ''; }
  set maxWidth(value: string) { this.values.maxWidth = value; }
  get maxHeight() { return this.values.maxHeight ?? ''; }
  set maxHeight(value: string) { this.values.maxHeight = value; }
  get padding() { return this.values.padding ?? ''; }
  set padding(value: string) { this.values.padding = value; }
  get overflowY() { return this.values.overflowY ?? ''; }
  set overflowY(value: string) { this.values.overflowY = value; }
  get boxShadow() { return this.values.boxShadow ?? ''; }
  set boxShadow(value: string) { this.values.boxShadow = value; }
  get borderTopLeftRadius() { return this.values.borderTopLeftRadius ?? ''; }
  set borderTopLeftRadius(value: string) { this.values.borderTopLeftRadius = value; }
  get borderTopRightRadius() { return this.values.borderTopRightRadius ?? ''; }
  set borderTopRightRadius(value: string) { this.values.borderTopRightRadius = value; }
  get borderBottomLeftRadius() { return this.values.borderBottomLeftRadius ?? ''; }
  set borderBottomLeftRadius(value: string) { this.values.borderBottomLeftRadius = value; }
  get borderBottomRightRadius() { return this.values.borderBottomRightRadius ?? ''; }
  set borderBottomRightRadius(value: string) { this.values.borderBottomRightRadius = value; }
  get marginLeft() { return this.values.marginLeft ?? ''; }
  set marginLeft(value: string) { this.values.marginLeft = value; }
  get borderRadius() { return this.values.borderRadius ?? ''; }
  set borderRadius(value: string) { this.values.borderRadius = value; }
  get pointerEvents() { return this.values.pointerEvents ?? ''; }
  set pointerEvents(value: string) { this.values.pointerEvents = value; }

  removeProperty(name: string) {
    delete this.values[name];
    const camel = name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    delete this.values[camel];
    delete (this as unknown as Record<string, unknown>)[name];
    delete (this as unknown as Record<string, unknown>)[camel];
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

  animations: Array<{
    keyframes: unknown;
    options: { duration?: number; delay?: number; easing?: string };
    onfinish: (() => void) | null;
    oncancel: (() => void) | null;
    cancel: () => void;
  }> = [];

  animate(keyframes: unknown, options: { duration?: number; delay?: number; easing?: string } = {}) {
    const record = {
      keyframes,
      options,
      onfinish: null as (() => void) | null,
      oncancel: null as (() => void) | null,
      cancel() {
        this.oncancel?.();
      },
    };
    this.animations.push(record);
    return record;
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

test('a sheet sits flush on the bottom, keeps height and padding, and closes like a modal', () => {
  const doc = new FakeDocument();
  const trigger = layer(doc, 'button', { top: 20, left: 20, width: 80, height: 32 });
  const overlay = layer(doc, 'sheet', { top: 0, left: 0, width: 400, height: 160 });
  overlay.style.height = '160px';
  overlay.style.padding = '24px';
  overlay.style.maxHeight = '85vh';
  open(doc, createOverlayAction('open', 'open', 'sheet', 'fixed', 'sheet'), trigger);

  assert.equal(overlay.getAttribute('data-overlay-open'), 'sheet');
  assert.equal(overlay.getAttribute('role'), 'dialog');
  assert.equal(overlay.getAttribute('aria-modal'), 'true');
  assert.equal(overlay.style.top, 'auto');
  assert.equal(overlay.style.bottom, '0px');
  assert.equal(overlay.style.left, '0px');
  assert.equal(overlay.style.height, '160px');
  assert.equal(overlay.style.padding, '24px');
  assert.equal(overlay.style.maxHeight, '85vh');
  assert.equal(overlay.style.borderTopLeftRadius, '16px');
  assert.equal(overlay.style.borderBottomLeftRadius, '0px');
  assert.equal(overlay.style.borderBottomRightRadius, '0px');
  assert.equal(overlay.style.overflowY, 'auto');
  assert.ok(overlay.style.boxShadow.length > 0);
  const handle = overlay.children.find(child => child.getAttribute('data-overlay-chrome') === 'sheet-handle');
  assert.ok(handle);
  assert.equal(handle.getAttribute('aria-hidden'), 'true');
  assert.equal(doc.activeElement, overlay);
  const backdrop = doc.body.children.find(child => child.getAttribute('data-overlay-backdrop') === 'sheet');
  assert.ok(backdrop);

  const escape = { key: 'Escape', prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} };
  doc.emit('keydown', escape);
  assert.equal(escape.prevented, true);
  assert.equal(overlay.style.display, 'none');
  assert.equal(overlay.style.borderBottomLeftRadius ?? '', '');
  assert.equal(overlay.children.some(child => child.getAttribute('data-overlay-chrome') === 'sheet-handle'), false);
  assert.equal(doc.body.children.includes(backdrop), false);
  assert.equal(doc.activeElement, trigger);

  open(doc, createOverlayAction('open', 'open', 'sheet', 'fixed', 'sheet'), trigger);
  const backdropAgain = doc.body.children.find(child => child.getAttribute('data-overlay-backdrop') === 'sheet');
  assert.ok(backdropAgain);
  doc.emit('pointerdown', { target: backdropAgain });
  assert.equal(overlay.style.display, 'none');

  open(doc, createOverlayAction('open', 'open', 'sheet', 'fixed', 'sheet'), trigger);
  open(doc, createOverlayAction('close', 'close', 'sheet'), trigger);
  assert.equal(overlay.style.display, 'none');
  assert.equal(doc.body.children.some(child => child.getAttribute('data-overlay-backdrop') === 'sheet'), false);
  closeOpenOverlays();
});

test('a tall sheet is capped to the viewport and a narrow one stays centered', () => {
  const doc = new FakeDocument();
  const trigger = layer(doc, 'button', { top: 20, left: 20, width: 80, height: 32 });
  const tall = layer(doc, 'tall', { top: 0, left: 0, width: 200, height: 500 });
  open(doc, createOverlayAction('open', 'open', 'tall', 'fixed', 'sheet'), trigger);
  assert.equal(tall.style.bottom, '0px');
  assert.equal(tall.style.top, 'auto');
  assert.equal(tall.style.left, '100px');
  assert.equal(tall.style.maxHeight, '300px');
  assert.equal(tall.style.overflowY, 'auto');
  closeOpenOverlays();

  const narrow = layer(doc, 'narrow', { top: 0, left: 0, width: 200, height: 80 });
  open(doc, createOverlayAction('open', 'open', 'narrow', 'fixed', 'sheet'), trigger);
  assert.equal(narrow.style.left, '100px');
  assert.equal(narrow.style.bottom, '0px');
  assert.equal(narrow.style.maxHeight ?? '', '');
  closeOpenOverlays();
});

test('a menu flips like a popover, moves with arrow keys, and returns focus', () => {
  const doc = new FakeDocument();
  const trigger = layer(doc, 'button', { top: 250, left: 30, width: 40, height: 30 });
  const overlay = layer(doc, 'menu', { top: 0, left: 0, width: 100, height: 80 });
  const first = new FakeElement(doc, { top: 0, left: 0, width: 80, height: 24 });
  const second = new FakeElement(doc, { top: 24, left: 0, width: 80, height: 24 });
  first.setAttribute('role', 'menuitem');
  second.setAttribute('role', 'menuitem');
  overlay.appendChild(first);
  overlay.appendChild(second);
  const action = createOverlayAction('open', 'open', 'menu', 'relative', 'menu');
  action.anchor = 'bottom';
  action.transition = tweenTransition();
  open(doc, action, trigger);

  assert.equal(overlay.getAttribute('data-overlay-open'), 'menu');
  assert.equal(overlay.getAttribute('role'), 'menu');
  assert.equal(overlay.getAttribute('aria-orientation'), 'vertical');
  assert.equal(overlay.hasAttribute('aria-modal'), false);
  assert.equal(overlay.style.top, '162px');
  assert.equal(overlay.style.left, '30px');
  assert.equal(overlay.style.bottom, 'auto');
  assert.equal(doc.body.children.some(child => child.hasAttribute('data-overlay-backdrop')), false);
  assert.equal(doc.activeElement, first);
  assert.equal(overlay.animations.length, 1);
  closeOpenOverlays();
  action.transition = undefined;
  open(doc, action, trigger);
  assert.equal(doc.activeElement, first);

  const down = { key: 'ArrowDown', prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} };
  doc.emit('keydown', down);
  assert.equal(down.prevented, true);
  assert.equal(doc.activeElement, second);

  const up = { key: 'ArrowUp', prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} };
  doc.emit('keydown', up);
  assert.equal(doc.activeElement, first);

  const end = { key: 'End', prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} };
  doc.emit('keydown', end);
  assert.equal(doc.activeElement, second);

  const typed = { key: 'e', prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} };
  doc.emit('keydown', typed);
  assert.equal(typed.prevented, false);
  assert.equal(doc.activeElement, second);

  doc.emit('pointerdown', { target: first });
  assert.equal(overlay.getAttribute('data-overlay-open'), 'menu');

  const escape = { key: 'Escape', prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} };
  doc.emit('keydown', escape);
  assert.equal(overlay.style.display, 'none');
  assert.equal(overlay.hasAttribute('aria-orientation'), false);
  assert.equal(doc.activeElement, trigger);

  open(doc, action, trigger);
  doc.emit('pointerdown', { target: doc.body });
  assert.equal(overlay.style.display, 'none');

  open(doc, action, trigger);
  open(doc, createOverlayAction('close', 'close', 'menu'), trigger);
  assert.equal(overlay.style.display, 'none');
  closeOpenOverlays();
});

test('a menu marks a direct child with no role as an item', () => {
  const doc = new FakeDocument();
  const trigger = layer(doc, 'button', { top: 40, left: 16, width: 80, height: 24 });
  const overlay = layer(doc, 'menu', { top: 0, left: 0, width: 120, height: 40 });
  const row = new FakeElement(doc, { top: 0, left: 0, width: 100, height: 20 });
  overlay.appendChild(row);
  open(doc, createOverlayAction('open', 'open', 'menu', 'relative', 'menu'), trigger);
  assert.equal(row.getAttribute('role'), 'menuitem');
  assert.equal(doc.activeElement, row);
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

test('an authored overlay transition fades open and waits to finish before it closes', () => {
  const doc = new FakeDocument();
  const trigger = layer(doc, 'button', { top: 20, left: 20, width: 80, height: 32 });
  const overlay = layer(doc, 'dialog', { top: 0, left: 0, width: 200, height: 100 });
  const action = createOverlayAction('open', 'open', 'dialog', 'fixed', 'modal');
  action.transition = tweenTransition();
  open(doc, action, trigger);

  assert.equal(overlay.getAttribute('data-overlay-open'), 'modal');
  assert.equal(overlay.animations.length, 1);
  assert.equal(overlay.animations[0]?.options.duration, 300);
  assert.equal(overlay.animations[0]?.options.easing, 'ease-out');
  const backdrop = doc.body.children.find(child => child.getAttribute('data-overlay-backdrop') === 'dialog');
  assert.ok(backdrop);
  assert.equal(backdrop.animations.length, 1);

  const escape = { key: 'Escape', prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} };
  doc.emit('keydown', escape);
  assert.equal(overlay.getAttribute('data-overlay-open'), 'modal');
  assert.equal(overlay.animations.length, 2);
  assert.equal(backdrop.animations.length, 2);

  overlay.animations[1]?.onfinish?.();
  assert.equal(overlay.getAttribute('data-overlay-open'), 'modal');
  backdrop.animations[1]?.onfinish?.();
  assert.equal(overlay.style.display, 'none');
  assert.equal(doc.body.children.includes(backdrop), false);
  closeOpenOverlays();
});

test('a close action with an instant transition hides without waiting', () => {
  const doc = new FakeDocument();
  const trigger = layer(doc, 'button', { top: 20, left: 20, width: 80, height: 32 });
  const overlay = layer(doc, 'dialog', { top: 0, left: 0, width: 200, height: 100 });
  const opening = createOverlayAction('open', 'open', 'dialog', 'fixed', 'modal');
  opening.transition = tweenTransition();
  open(doc, opening, trigger);
  assert.equal(overlay.getAttribute('data-overlay-open'), 'modal');

  const closing = createOverlayAction('close', 'close', 'dialog');
  closing.transition = { ...tweenTransition(), duration: 0, stagger: 0 };
  open(doc, closing, trigger);
  assert.equal(overlay.style.display, 'none');
  assert.equal(overlay.hasAttribute('data-overlay-open'), false);
  closeOpenOverlays();
});
