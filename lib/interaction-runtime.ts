/**
 * Runs interaction actions against a document.
 * Published pages bind events here. The editor plays one action at a time
 * and only auto-binds scroll, so selecting a layer does not navigate away.
 */

import {
  actionsForRun,
  actionsOnHoverLeave,
  dismissOnEscape,
  dismissOnPointer,
  focusAfterClose,
  keyboardShouldFire,
  overlayOpenTargets,
  resolveNavigateHref,
  scrollProgressThroughViewport,
  scrollToPlan,
  timerSchedule,
  variableAssignment,
  variantForScrollProgress,
} from '@/lib/interactions-framer';
import {
  overlayAriaRole,
  overlayIsAnchored,
  overlayTakesFocus,
  overlayTrapsFocus,
  overlayUsesBackdrop,
  placeAnchoredOverlay,
  placeModalOverlay,
  placeSheetOverlay,
  pointerZoneForDismiss,
  resolveOverlayKind,
  trapFocusIndex,
} from '@/lib/overlay-position';
import { useGlobalsStore } from '@/stores/useGlobalsStore';
import { useInteractionPreviewStore } from '@/stores/useInteractionPreviewStore';
import type {
  InteractionAction,
  KeyboardPhase,
  KeyboardTrigger,
  Layer,
  LayerInteraction,
  OverlayAnchor,
  OverlayKind,
  TimerTrigger,
} from '@/types';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ActionRunOptions {
  /** Published and preview pages navigate and bind pointer events. */
  live: boolean;
  /** 0–1 scroll progress. Only scroll-to-variant actions use it. */
  scrollProgress?: number;
  onNavigate?: (href: string, openInNewTab: boolean) => void;
  onScrollTo?: (label: string) => void;
  onSetVariable?: (variableId: string, value: string) => void;
}

interface OverlaySession {
  overlay: HTMLElement;
  trigger: HTMLElement | null;
  backdrop: HTMLElement | null;
  restoreFocus: boolean;
  cleanup: () => void;
}

const sessions = new Map<string, OverlaySession>();

interface OverlayFrame {
  top: number;
  left: number;
}

interface MeasuredBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/"/g, '\\"');
}

function findLayer(doc: Document, layerId: string): HTMLElement | null {
  if (!layerId || layerId === 'body') return null;
  return doc.querySelector(`[data-layer-id="${cssEscape(layerId)}"]`);
}

function applySetVariant(doc: Document, targetLayerId: string, variantId: string): void {
  if (!targetLayerId || !variantId) return;
  useInteractionPreviewStore.getState().setVariant(targetLayerId, variantId);
  const element = findLayer(doc, targetLayerId);
  element?.setAttribute('data-interaction-variant', variantId);
}

function isEventNode(value: EventTarget | null): value is Node {
  if (!value || typeof value !== 'object') return false;
  if (typeof Node === 'function' && value instanceof Node) return true;
  return 'nodeType' in value;
}

function pointerZone(
  target: EventTarget | null,
  overlay: HTMLElement,
  trigger: HTMLElement | null,
  backdrop: HTMLElement | null,
): 'overlay' | 'trigger' | 'backdrop' | 'outside' {
  if (!isEventNode(target)) return 'outside';
  if (overlay.contains(target)) return 'overlay';
  if (trigger && (trigger === target || trigger.contains(target))) return 'trigger';
  if (backdrop && (backdrop === target || backdrop.contains(target))) return 'backdrop';
  return 'outside';
}

function clearOverlayChrome(overlay: HTMLElement): void {
  overlay.style.display = 'none';
  overlay.style.removeProperty('visibility');
  overlay.style.removeProperty('position');
  overlay.style.removeProperty('top');
  overlay.style.removeProperty('left');
  overlay.style.removeProperty('right');
  overlay.style.removeProperty('bottom');
  overlay.style.removeProperty('margin');
  overlay.style.removeProperty('transform');
  overlay.style.removeProperty('z-index');
  overlay.removeAttribute('data-overlay-open');
  if (overlay.dataset.overlayRoleAdded === 'true') {
    overlay.removeAttribute('role');
    overlay.removeAttribute('aria-modal');
    delete overlay.dataset.overlayRoleAdded;
  }
}

export function closeOverlay(targetLayerId: string): void {
  const session = sessions.get(targetLayerId);
  if (!session) return;
  session.cleanup();
  session.backdrop?.remove();
  clearOverlayChrome(session.overlay);
  sessions.delete(targetLayerId);
  if (session.restoreFocus) session.trigger?.focus();
}

/** Close every overlay this document opened. Used when preview rebinds. */
export function closeOpenOverlays(): void {
  for (const layerId of [...sessions.keys()]) closeOverlay(layerId);
}

function viewportOf(doc: Document): { width: number; height: number } {
  const view = doc.defaultView;
  return {
    width: view?.innerWidth ?? doc.documentElement.clientWidth ?? 0,
    height: view?.innerHeight ?? doc.documentElement.clientHeight ?? 0,
  };
}

function boxOf(element: HTMLElement): MeasuredBox {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function overlaySize(overlay: HTMLElement): { width: number; height: number } {
  const width = overlay.offsetWidth || overlay.getBoundingClientRect().width;
  const height = overlay.offsetHeight || overlay.getBoundingClientRect().height;
  return {
    width: width > 0 ? width : 240,
    height: height > 0 ? height : 80,
  };
}

function resolveAnchorElement(
  doc: Document,
  action: Extract<InteractionAction, { type: 'overlay' }>,
  trigger: HTMLElement | null,
): HTMLElement | null {
  if (action.anchorLayerId && action.anchorLayerId !== action.targetLayerId) {
    const chosen = findLayer(doc, action.anchorLayerId);
    if (chosen) return chosen;
  }
  return trigger;
}

function frameForOverlay(
  kind: OverlayKind,
  overlay: HTMLElement,
  anchor: HTMLElement | null,
  side: OverlayAnchor,
  viewport: { width: number; height: number },
): OverlayFrame {
  const size = overlaySize(overlay);
  if (kind === 'sheet') return placeSheetOverlay({ overlay: size, viewport });
  if (overlayIsAnchored(kind) && anchor) {
    return placeAnchoredOverlay({
      anchor: boxOf(anchor),
      overlay: size,
      viewport,
      side,
    });
  }
  return placeModalOverlay({ overlay: size, viewport });
}

function applyOverlayFrame(overlay: HTMLElement, frame: OverlayFrame): void {
  overlay.style.position = 'fixed';
  overlay.style.top = `${frame.top}px`;
  overlay.style.left = `${frame.left}px`;
  overlay.style.right = 'auto';
  overlay.style.bottom = 'auto';
  overlay.style.margin = '0px';
  overlay.style.transform = 'none';
  overlay.style.zIndex = '70';
  overlay.style.display = 'flex';
  overlay.style.visibility = 'visible';
}

function createBackdrop(doc: Document, overlay: HTMLElement, layerId: string): HTMLElement {
  const backdrop = doc.createElement('div');
  backdrop.setAttribute('data-overlay-backdrop', layerId);
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.style.position = 'fixed';
  backdrop.style.inset = '0px';
  backdrop.style.background = 'rgba(15, 15, 15, 0.45)';
  backdrop.style.zIndex = '60';
  const parent = overlay.parentElement;
  if (parent) parent.insertBefore(backdrop, overlay);
  else doc.body.appendChild(backdrop);
  return backdrop;
}

function focusableElements(overlay: HTMLElement): HTMLElement[] {
  const view = overlay.ownerDocument.defaultView;
  return [...overlay.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    if (element.getAttribute('aria-hidden') === 'true') return false;
    const style = view?.getComputedStyle(element);
    if (!style) return true;
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

function openOverlay(
  doc: Document,
  action: Extract<InteractionAction, { type: 'overlay' }>,
  trigger: HTMLElement | null,
): void {
  const overlay = findLayer(doc, action.targetLayerId);
  if (!overlay) return;
  closeOverlay(action.targetLayerId);

  const kind = resolveOverlayKind(action);
  const anchored = overlayIsAnchored(kind);
  const anchor = anchored ? resolveAnchorElement(doc, action, trigger) : null;
  const side = action.anchor ?? 'bottom';

  overlay.style.display = 'flex';
  overlay.style.visibility = 'hidden';
  overlay.style.position = 'fixed';

  const backdrop = overlayUsesBackdrop(kind) ? createBackdrop(doc, overlay, action.targetLayerId) : null;
  const place = () => {
    applyOverlayFrame(overlay, frameForOverlay(kind, overlay, anchor, side, viewportOf(doc)));
  };
  place();

  overlay.setAttribute('data-overlay-open', kind);
  overlay.setAttribute('role', overlayAriaRole(kind));
  if (overlayUsesBackdrop(kind)) overlay.setAttribute('aria-modal', 'true');
  else overlay.removeAttribute('aria-modal');
  overlay.dataset.overlayRoleAdded = 'true';

  const takesFocus = overlayTakesFocus(kind);
  if (takesFocus) {
    if (!overlay.hasAttribute('tabindex')) overlay.setAttribute('tabindex', '-1');
    const focusable = focusableElements(overlay)[0];
    (focusable ?? overlay).focus();
  }

  const onKey = (event: KeyboardEvent) => {
    if (dismissOnEscape(action.dismiss, event.key)) {
      event.preventDefault();
      // Overlay dismiss wins over a Keyboard event bound to Escape.
      event.stopImmediatePropagation();
      closeOverlay(action.targetLayerId);
      return;
    }
    if (event.key !== 'Tab' || !overlayTrapsFocus(kind)) return;
    const items = focusableElements(overlay);
    if (items.length === 0) {
      event.preventDefault();
      overlay.focus();
      return;
    }
    const active = overlay.ownerDocument.activeElement as HTMLElement | null;
    const index = active ? items.indexOf(active) : -1;
    const next = trapFocusIndex(index === -1 ? null : index, items.length, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  };
  const onPointer = (event: Event) => {
    const zone = pointerZone(event.target, overlay, trigger, backdrop);
    if (dismissOnPointer(action.dismiss, pointerZoneForDismiss(zone))) {
      closeOverlay(action.targetLayerId);
    }
  };
  const view = doc.defaultView;
  doc.addEventListener('keydown', onKey, true);
  doc.addEventListener('pointerdown', onPointer, true);
  doc.addEventListener('scroll', place, true);
  view?.addEventListener('resize', place);
  view?.addEventListener('scroll', place, true);

  sessions.set(action.targetLayerId, {
    overlay,
    trigger,
    backdrop,
    restoreFocus: takesFocus && focusAfterClose(action.dismiss),
    cleanup: () => {
      doc.removeEventListener('keydown', onKey, true);
      doc.removeEventListener('pointerdown', onPointer, true);
      doc.removeEventListener('scroll', place, true);
      view?.removeEventListener('resize', place);
      view?.removeEventListener('scroll', place, true);
    },
  });
}

function applyScrollTo(
  doc: Document,
  action: Extract<InteractionAction, { type: 'scroll-to' }>,
  options: ActionRunOptions,
): void {
  const plan = scrollToPlan(action);
  if (!plan) return;
  if (!options.live) {
    const label = plan.target === 'page'
      ? plan.position
      : plan.layerId;
    options.onScrollTo?.(label);
  }
  const view = doc.defaultView;
  if (!view) return;
  if (plan.target === 'page') {
    const scroller = doc.scrollingElement || doc.documentElement;
    const top = plan.position === 'bottom' ? scroller.scrollHeight : 0;
    view.scrollTo({ top, behavior: 'smooth' });
    return;
  }
  findLayer(doc, plan.layerId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function applyVariableText(doc: Document, variableId: string, value: string): void {
  const nodes = doc.querySelectorAll(`[data-global-id="${cssEscape(variableId)}"]`);
  nodes.forEach(node => {
    node.textContent = value;
  });
}

function applySetVariable(
  doc: Document,
  action: Extract<InteractionAction, { type: 'set-variable' }>,
  options: ActionRunOptions,
): void {
  const assignment = variableAssignment(action);
  if (!assignment) return;
  if (!options.live) options.onSetVariable?.(assignment.variableId, assignment.value);
  applyVariableText(doc, assignment.variableId, assignment.value);
  useGlobalsStore.setState(state => {
    const current = state.globals.find(global => global.id === assignment.variableId);
    if (!current || current.value === assignment.value) return state;
    return {
      globals: state.globals.map(global => (
        global.id === assignment.variableId ? { ...global, value: assignment.value } : global
      )),
    };
  });
}

function applyNavigate(
  doc: Document,
  action: Extract<InteractionAction, { type: 'navigate' }>,
  options: ActionRunOptions,
): void {
  const href = resolveNavigateHref(action);
  if (!href) return;
  if (!options.live) {
    options.onNavigate?.(href, action.openInNewTab === true);
    return;
  }
  const view = doc.defaultView;
  if (!view) return;
  if (action.openInNewTab) view.open(href, '_blank', 'noopener,noreferrer');
  else view.location.assign(href);
}

function applyAction(
  doc: Document,
  action: InteractionAction,
  trigger: HTMLElement | null,
  options: ActionRunOptions,
): void {
  switch (action.type) {
    case 'set-variant':
      applySetVariant(doc, action.targetLayerId, action.variantId);
      break;
    case 'scroll-variant': {
      const variantId = variantForScrollProgress(action.stops, options.scrollProgress ?? 1);
      if (variantId) applySetVariant(doc, action.targetLayerId, variantId);
      break;
    }
    case 'overlay':
      if (action.operation === 'close') closeOverlay(action.targetLayerId);
      else openOverlay(doc, action, trigger);
      break;
    case 'navigate':
      applyNavigate(doc, action, options);
      break;
    case 'scroll-to':
      applyScrollTo(doc, action, options);
      break;
    case 'set-variable':
      applySetVariable(doc, action, options);
      break;
    default:
      break;
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as HTMLElement;
  if (typeof element.tagName !== 'string') return false;
  const tag = element.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (element.isContentEditable) return true;
  return typeof element.closest === 'function' && !!element.closest('[contenteditable="true"]');
}

/**
 * Keyboard listens on the document that owns the layer.
 * Tap and Press hit the layer element. A key event does not, unless that
 * layer is focused, so the shortcut is page-scoped while the layer is mounted.
 * Plain letters stay quiet inside text fields. Ctrl, Alt, and Cmd still run.
 * Holding the key does not repeat. Key up runs the action list only when the
 * event phase is up — it does not close overlays the way Press does.
 */
export function listenForKeyboard(
  doc: Document,
  keyboard: KeyboardTrigger | undefined,
  fire: () => void,
): () => void {
  const onKey = (phase: KeyboardPhase) => (event: Event) => {
    if (!('key' in event) || typeof event.key !== 'string') return;
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardShouldFire(keyboard, keyboardEvent, phase, isTypingTarget(keyboardEvent.target))) return;
    if (phase === 'down') keyboardEvent.preventDefault();
    fire();
  };
  const onDown = onKey('down');
  const onUp = onKey('up');
  doc.addEventListener('keydown', onDown);
  doc.addEventListener('keyup', onUp);
  return () => {
    doc.removeEventListener('keydown', onDown);
    doc.removeEventListener('keyup', onUp);
  };
}

/**
 * First run waits `delay` ms from the moment the layer binds in preview.
 * Repeat then fires every `interval` ms. The caller clears this on unmount.
 */
export function listenForTimer(
  timer: TimerTrigger | undefined,
  fire: () => void,
): () => void {
  const schedule = timerSchedule(timer);
  if (!schedule || typeof window === 'undefined') return () => {};
  let intervalId: number | undefined;
  const timeoutId = window.setTimeout(() => {
    try {
      fire();
    } finally {
      if (schedule.interval != null) {
        intervalId = window.setInterval(fire, schedule.interval);
      }
    }
  }, schedule.delay);
  return () => {
    window.clearTimeout(timeoutId);
    if (intervalId !== undefined) window.clearInterval(intervalId);
  };
}

export function runInteractionActions(
  doc: Document,
  interaction: LayerInteraction,
  trigger: HTMLElement | null,
  options: ActionRunOptions,
): void {
  const mode = options.scrollProgress === undefined ? 'event' : 'scroll';
  for (const action of actionsForRun(interaction.actions, mode)) {
    applyAction(doc, action, trigger, options);
  }
}

function collect(layers: Layer[]): Array<{ triggerLayerId: string; interaction: LayerInteraction }> {
  const found: Array<{ triggerLayerId: string; interaction: LayerInteraction }> = [];
  const walk = (list: Layer[]) => {
    for (const layer of list) {
      for (const interaction of layer.interactions ?? []) {
        if ((interaction.actions && interaction.actions.length > 0) || interaction.trigger === 'while-scrolling') {
          found.push({ triggerLayerId: layer.id, interaction });
        }
      }
      if (layer.children?.length) walk(layer.children);
    }
  };
  walk(layers);
  return found;
}

export function prepareOverlayTargets(doc: Document, layers: Layer[]): void {
  for (const layerId of overlayOpenTargets(layers)) {
    const element = findLayer(doc, layerId);
    if (!element || element.dataset.overlayEditing === 'true') continue;
    if (element.dataset.overlayPrepared === 'true') continue;
    element.dataset.overlayPrepared = 'true';
    element.style.display = 'none';
  }
}

/**
 * Bind action events. `live` is the published page: tap, hover, press, keyboard,
 * timer, appear, and load run there. The editor passes `live: false` and only
 * tracks scroll, so a shortcut does not fire while editing.
 */
export function bindInteractionActions(
  doc: Document,
  layers: Layer[],
  options: { live: boolean },
): () => void {
  const cleanups: Array<() => void> = [];
  if (options.live) prepareOverlayTargets(doc, layers);

  const items = collect(layers);
  const view = doc.defaultView;

  const onScroll = () => {
    const viewportHeight = view?.innerHeight ?? 0;
    for (const item of items) {
      if (item.interaction.trigger !== 'while-scrolling') continue;
      if (!item.interaction.actions?.some(action => action.type === 'scroll-variant')) continue;
      const trigger = findLayer(doc, item.triggerLayerId);
      if (!trigger) continue;
      const rect = trigger.getBoundingClientRect();
      const progress = scrollProgressThroughViewport(rect.top, rect.height, viewportHeight);
      runInteractionActions(doc, item.interaction, trigger, { live: options.live, scrollProgress: progress });
    }
  };

  const tracksScroll = items.some(item => (
    item.interaction.trigger === 'while-scrolling'
    && item.interaction.actions?.some(action => action.type === 'scroll-variant')
  ));
  if (view && tracksScroll) {
    view.addEventListener('scroll', onScroll, { passive: true });
    doc.addEventListener('scroll', onScroll, { passive: true, capture: true });
    onScroll();
    cleanups.push(() => {
      view.removeEventListener('scroll', onScroll);
      doc.removeEventListener('scroll', onScroll, true);
    });
  }

  if (!options.live) {
    return () => cleanups.forEach(cleanup => cleanup());
  }

  for (const item of items) {
    const trigger = findLayer(doc, item.triggerLayerId);
    if (!trigger) continue;
    const { interaction } = item;

    if (interaction.trigger === 'click') {
      const handleClick = () => runInteractionActions(doc, interaction, trigger, { live: true });
      trigger.addEventListener('click', handleClick);
      cleanups.push(() => trigger.removeEventListener('click', handleClick));
    }

    if (interaction.trigger === 'hover') {
      const handleEnter = () => runInteractionActions(doc, interaction, trigger, { live: true });
      const handleLeave = () => {
        const closing: LayerInteraction = {
          ...interaction,
          actions: actionsOnHoverLeave(interaction.actions),
        };
        runInteractionActions(doc, closing, trigger, { live: true });
      };
      trigger.addEventListener('mouseenter', handleEnter);
      trigger.addEventListener('mouseleave', handleLeave);
      cleanups.push(() => {
        trigger.removeEventListener('mouseenter', handleEnter);
        trigger.removeEventListener('mouseleave', handleLeave);
      });
    }

    if (interaction.trigger === 'press') {
      const handleDown = () => runInteractionActions(doc, interaction, trigger, { live: true });
      const handleUp = () => {
        const closing: LayerInteraction = {
          ...interaction,
          actions: actionsOnHoverLeave(interaction.actions),
        };
        runInteractionActions(doc, closing, trigger, { live: true });
      };
      trigger.addEventListener('pointerdown', handleDown);
      trigger.addEventListener('pointerup', handleUp);
      trigger.addEventListener('pointerleave', handleUp);
      trigger.addEventListener('pointercancel', handleUp);
      cleanups.push(() => {
        trigger.removeEventListener('pointerdown', handleDown);
        trigger.removeEventListener('pointerup', handleUp);
        trigger.removeEventListener('pointerleave', handleUp);
        trigger.removeEventListener('pointercancel', handleUp);
      });
    }

    if (interaction.trigger === 'load') {
      runInteractionActions(doc, interaction, trigger, { live: true });
    }

    if (interaction.trigger === 'key') {
      cleanups.push(listenForKeyboard(doc, interaction.keyboard, () => {
        runInteractionActions(doc, interaction, trigger, { live: true });
      }));
    }

    if (interaction.trigger === 'timer') {
      cleanups.push(listenForTimer(interaction.timer, () => {
        runInteractionActions(doc, interaction, trigger, { live: true });
      }));
    }

    if (interaction.trigger === 'scroll-into-view' && view && 'IntersectionObserver' in view) {
      const observer = new view.IntersectionObserver((entries) => {
        if (entries.some(entry => entry.isIntersecting)) {
          runInteractionActions(doc, interaction, trigger, { live: true });
          observer.disconnect();
        }
      }, { threshold: 0.2 });
      observer.observe(trigger);
      cleanups.push(() => observer.disconnect());
    }
  }

  return () => {
    cleanups.forEach(cleanup => cleanup());
    closeOpenOverlays();
  };
}
