/**
 * Runs interaction actions against a document.
 * Published pages bind events here. The editor plays one action at a time
 * and only auto-binds scroll, so selecting a layer does not navigate away.
 */

import {
  dragPhaseActions,
  dragVariantChoices,
  limitsForBounds,
  normalizeDragTrigger,
  plainDragVariantTargets,
  projectDragMove,
  settleDragOffset,
  type DragPoint,
} from '@/lib/drag-gesture';
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
import {
  motionSpec,
  transitionForVariantChange,
  variantMotionSlot,
  type VariantMotionSlot,
} from '@/lib/action-transition';
import {
  currentOpacity,
  playOverlayEnter,
  playOverlayExit,
} from '@/lib/action-transition-playback';
import {
  activeVariantId,
  emptyVariantSession,
  reduceVariantSession,
  variantGestureForTrigger,
  type VariantGesture,
  type VariantSession,
} from '@/lib/interactive-variants';
import { useGlobalsStore } from '@/stores/useGlobalsStore';
import { useInteractionPreviewStore } from '@/stores/useInteractionPreviewStore';
import type {
  ActionTransition,
  InteractionAction,
  KeyboardPhase,
  DragTrigger,
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
  /**
   * Hover and Press set a variant only while the gesture lasts.
   * Tap and other events keep it. Defaults to sticky.
   */
  gesture?: VariantGesture;
  onNavigate?: (href: string, openInNewTab: boolean) => void;
  onScrollTo?: (label: string) => void;
  onSetVariable?: (variableId: string, value: string) => void;
}

interface OverlaySession {
  overlay: HTMLElement;
  trigger: HTMLElement | null;
  backdrop: HTMLElement | null;
  restoreFocus: boolean;
  /** Transition the overlay opened with. Close reuses it when the close action has none. */
  transition: ActionTransition | null;
  closing: boolean;
  cancelMotion: () => void;
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

const variantSessions = new Map<string, VariantSession>();
const transitionSlots = new Map<string, Partial<Record<VariantMotionSlot, ActionTransition | null>>>();
let playbackToken = 0;

function rememberTransition(
  layerId: string,
  gesture: VariantGesture,
  transition: ActionTransition | null | undefined,
): void {
  const slots = { ...(transitionSlots.get(layerId) ?? {}) };
  slots[variantMotionSlot(gesture)] = transition ?? null;
  transitionSlots.set(layerId, slots);
}

function publishVariant(doc: Document, layerId: string, before: VariantSession, after: VariantSession): void {
  const active = activeVariantId(after);
  const transition = transitionForVariantChange(before, after, transitionSlots.get(layerId) ?? {});
  const playback = transition ? { token: ++playbackToken, transition } : undefined;
  const element = findLayer(doc, layerId);
  if (active) {
    useInteractionPreviewStore.getState().setVariant(layerId, active, playback);
    element?.setAttribute('data-interaction-variant', active);
    return;
  }
  useInteractionPreviewStore.getState().clearVariant(layerId, playback);
  element?.removeAttribute('data-interaction-variant');
}

function sessionIsEmpty(session: VariantSession): boolean {
  return session.base == null
    && session.hover == null
    && session.press == null
    && session.drag == null;
}

function writeVariantSession(doc: Document, layerId: string, next: VariantSession, previous: VariantSession): void {
  if (next === previous) return;
  const empty = sessionIsEmpty(next);
  if (empty) variantSessions.delete(layerId);
  else variantSessions.set(layerId, next);
  publishVariant(doc, layerId, previous, next);
  if (empty) transitionSlots.delete(layerId);
}

/** Remember a variant for a gesture and publish the one that should show. */
export function previewVariantGesture(
  doc: Document,
  layerId: string,
  event:
    | { type: 'set'; gesture: VariantGesture; variantId: string; transition?: ActionTransition | null }
    | { type: 'end'; gesture: 'hover' | 'press' | 'drag' },
): void {
  if (!layerId) return;
  if (event.type === 'set' && !event.variantId) return;
  if (event.type === 'set') rememberTransition(layerId, event.gesture, event.transition);
  const current = variantSessions.get(layerId) ?? emptyVariantSession();
  writeVariantSession(doc, layerId, reduceVariantSession(current, event), current);
}

/** Drop every remembered variant. Tests use this between cases. */
export function resetInteractiveVariants(): void {
  variantSessions.clear();
  transitionSlots.clear();
  resetDragGestures();
  useInteractionPreviewStore.getState().clearVariants();
}

function applySetVariant(
  doc: Document,
  targetLayerId: string,
  variantId: string,
  gesture: VariantGesture,
  mode: 'merge' | 'replace',
  transition?: ActionTransition,
): void {
  if (!targetLayerId || !variantId) return;
  if (mode === 'replace') {
    transitionSlots.set(targetLayerId, { base: transition ?? null });
    const current = variantSessions.get(targetLayerId) ?? emptyVariantSession();
    writeVariantSession(doc, targetLayerId, { base: variantId, hover: null, press: null, drag: null }, current);
    return;
  }
  previewVariantGesture(doc, targetLayerId, { type: 'set', gesture, variantId, transition });
}

function pointerHitsLayer(doc: Document, layerId: string, event: Event): HTMLElement | null {
  const element = findLayer(doc, layerId);
  if (!element || !isEventNode(event.target)) return null;
  if (element === event.target || element.contains(event.target)) return element;
  return null;
}

function pointerCrossesLayer(doc: Document, layerId: string, event: Event): HTMLElement | null {
  const element = pointerHitsLayer(doc, layerId, event);
  if (!element) return null;
  const related = (event as Event & { relatedTarget?: EventTarget | null }).relatedTarget ?? null;
  if (isEventNode(related) && (element === related || element.contains(related))) return null;
  return element;
}

/**
 * Hover and Press variants on a component instance.
 * Listeners stay on the document so swapping the variant tree does not drop them.
 */
export function bindComponentGestures(
  doc: Document,
  layerId: string,
  spec: { hoverVariantId?: string; pressedVariantId?: string },
): () => void {
  const cleanups: Array<() => void> = [];
  if (spec.hoverVariantId) {
    const hoverVariantId = spec.hoverVariantId;
    const onOver = (event: Event) => {
      if (!pointerCrossesLayer(doc, layerId, event)) return;
      previewVariantGesture(doc, layerId, { type: 'set', gesture: 'hover', variantId: hoverVariantId });
    };
    const onOut = (event: Event) => {
      if (!pointerCrossesLayer(doc, layerId, event)) return;
      previewVariantGesture(doc, layerId, { type: 'end', gesture: 'hover' });
      previewVariantGesture(doc, layerId, { type: 'end', gesture: 'press' });
    };
    doc.addEventListener('pointerover', onOver, true);
    doc.addEventListener('pointerout', onOut, true);
    cleanups.push(() => {
      doc.removeEventListener('pointerover', onOver, true);
      doc.removeEventListener('pointerout', onOut, true);
    });
  }
  if (spec.pressedVariantId) {
    const pressedVariantId = spec.pressedVariantId;
    const onDown = (event: Event) => {
      if (!pointerHitsLayer(doc, layerId, event)) return;
      if ('button' in event && event.button !== 0) return;
      previewVariantGesture(doc, layerId, { type: 'set', gesture: 'press', variantId: pressedVariantId });
    };
    const onUp = () => {
      previewVariantGesture(doc, layerId, { type: 'end', gesture: 'press' });
    };
    const onOut = (event: Event) => {
      if (!pointerCrossesLayer(doc, layerId, event)) return;
      previewVariantGesture(doc, layerId, { type: 'end', gesture: 'press' });
    };
    doc.addEventListener('pointerdown', onDown, true);
    doc.addEventListener('pointerup', onUp, true);
    doc.addEventListener('pointercancel', onUp, true);
    doc.addEventListener('pointerout', onOut, true);
    cleanups.push(() => {
      doc.removeEventListener('pointerdown', onDown, true);
      doc.removeEventListener('pointerup', onUp, true);
      doc.removeEventListener('pointercancel', onUp, true);
      doc.removeEventListener('pointerout', onOut, true);
    });
  }
  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
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
  overlay.style.removeProperty('opacity');
  overlay.removeAttribute('data-overlay-open');
  if (overlay.dataset.overlayRoleAdded === 'true') {
    overlay.removeAttribute('role');
    overlay.removeAttribute('aria-modal');
    delete overlay.dataset.overlayRoleAdded;
  }
}

function finishClose(targetLayerId: string): void {
  const session = sessions.get(targetLayerId);
  if (!session) return;
  session.cancelMotion();
  session.cleanup();
  session.backdrop?.remove();
  clearOverlayChrome(session.overlay);
  sessions.delete(targetLayerId);
  if (session.restoreFocus) session.trigger?.focus();
}

function closeMotion(explicit: ActionTransition | null | undefined, openedWith: ActionTransition | null) {
  // A close action with its own transition wins, even when that transition is instant.
  // An omitted close transition reuses the one the overlay opened with.
  if (explicit) return motionSpec(explicit);
  return motionSpec(openedWith);
}

export function closeOverlay(targetLayerId: string, transition?: ActionTransition | null): void {
  const session = sessions.get(targetLayerId);
  if (!session || session.closing) return;
  const spec = closeMotion(transition, session.transition);
  const canAnimate = spec != null && typeof session.overlay.animate === 'function';
  if (!spec || !canAnimate) {
    finishClose(targetLayerId);
    return;
  }
  session.closing = true;
  session.cleanup();
  const fromOverlay = currentOpacity(session.overlay);
  const fromBackdrop = session.backdrop ? currentOpacity(session.backdrop) : 1;
  session.cancelMotion();
  session.cancelMotion = playOverlayExit(
    session.overlay,
    session.backdrop,
    spec,
    fromOverlay,
    fromBackdrop,
    () => {
      if (sessions.get(targetLayerId) !== session) return;
      finishClose(targetLayerId);
    },
  );
}

/** Close every overlay this document opened. Used when preview rebinds. */
export function closeOpenOverlays(): void {
  for (const layerId of [...sessions.keys()]) finishClose(layerId);
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
  finishClose(action.targetLayerId);

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

  const motion = motionSpec(action.transition);
  sessions.set(action.targetLayerId, {
    overlay,
    trigger,
    backdrop,
    restoreFocus: takesFocus && focusAfterClose(action.dismiss),
    transition: action.transition ?? null,
    closing: false,
    cancelMotion: () => {},
    cleanup: () => {
      doc.removeEventListener('keydown', onKey, true);
      doc.removeEventListener('pointerdown', onPointer, true);
      doc.removeEventListener('scroll', place, true);
      view?.removeEventListener('resize', place);
      view?.removeEventListener('scroll', place, true);
    },
  });
  if (!motion || typeof overlay.animate !== 'function') return;
  const session = sessions.get(action.targetLayerId);
  if (!session) return;
  session.cancelMotion = playOverlayEnter(overlay, backdrop, motion);
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
      applySetVariant(
        doc,
        action.targetLayerId,
        action.variantId,
        options.gesture ?? 'sticky',
        'merge',
        action.transition,
      );
      break;
    case 'scroll-variant': {
      const variantId = variantForScrollProgress(action.stops, options.scrollProgress ?? 1);
      if (variantId) applySetVariant(doc, action.targetLayerId, variantId, 'sticky', 'replace');
      break;
    }
    case 'overlay':
      if (action.operation === 'close') closeOverlay(action.targetLayerId, action.transition);
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

/** Run one event. Hover and Press variants last only for the gesture. */
export function playInteraction(
  doc: Document,
  interaction: LayerInteraction,
  trigger: HTMLElement | null,
  options: { live: boolean },
): void {
  runInteractionActions(doc, interaction, trigger, {
    live: options.live,
    gesture: variantGestureForTrigger(interaction.trigger),
  });
}

/**
 * End a Hover, Press, or Drag variant.
 * Hover and Press also close overlays this event opened.
 * Drag leaves overlays to the drag binder, because a release can be the commit.
 */
export function releaseInteraction(
  doc: Document,
  interaction: LayerInteraction,
  trigger: HTMLElement | null,
  options: { live: boolean },
): void {
  const gesture = variantGestureForTrigger(interaction.trigger);
  if (gesture === 'hover' || gesture === 'press' || gesture === 'drag') {
    for (const action of interaction.actions ?? []) {
      if (action.type !== 'set-variant' || !action.targetLayerId) continue;
      previewVariantGesture(doc, action.targetLayerId, { type: 'end', gesture });
    }
  }
  if (gesture === 'drag') return;
  const closing = actionsOnHoverLeave(interaction.actions);
  if (closing.length === 0) return;
  runInteractionActions(doc, { ...interaction, actions: closing }, trigger, {
    live: options.live,
    gesture: 'sticky',
  });
}

const dragOffsetByLayerId = new Map<string, DragPoint>();
let dragDepth = 0;
const dragEndListeners = new Set<() => void>();

/** True while a preview or published drag has passed the slop and not yet released. */
export function isDragGestureActive(): boolean {
  return dragDepth > 0;
}

/**
 * Fires when the last active drag releases.
 * The animation binder uses this to defer a rebind that would drop the gesture.
 */
export function subscribeDragGestureEnd(listener: () => void): () => void {
  dragEndListeners.add(listener);
  return () => {
    dragEndListeners.delete(listener);
  };
}

function setDragActive(active: boolean): void {
  dragDepth += active ? 1 : -1;
  if (dragDepth < 0) dragDepth = 0;
  if (dragDepth === 0) {
    for (const listener of [...dragEndListeners]) listener();
  }
}

/** Forget drag offsets. Tests call this between cases, via resetInteractiveVariants. */
export function resetDragGestures(): void {
  dragOffsetByLayerId.clear();
  dragDepth = 0;
  dragEndListeners.clear();
}

function measureDragLimits(
  doc: Document,
  layerId: string,
  spec: DragTrigger,
  offset: DragPoint,
): ReturnType<typeof limitsForBounds> {
  if (!spec.bounds) return { minX: null, maxX: null, minY: null, maxY: null };
  const element = findLayer(doc, layerId);
  if (!element) return limitsForBounds(spec.bounds, { width: 0, height: 0 }, null, { x: 0, y: 0 });
  const rect = element.getBoundingClientRect();
  const parentRect = element.parentElement?.getBoundingClientRect();
  const resting = parentRect
    ? { x: rect.left - parentRect.left - offset.x, y: rect.top - parentRect.top - offset.y }
    : { x: 0, y: 0 };
  return limitsForBounds(
    spec.bounds,
    { width: rect.width, height: rect.height },
    parentRect ? { width: parentRect.width, height: parentRect.height } : null,
    resting,
  );
}

function paintDrag(doc: Document, layerId: string, point: DragPoint): void {
  const element = findLayer(doc, layerId);
  if (!element) return;
  element.style.setProperty('translate', `${point.x}px ${point.y}px`);
  element.style.setProperty('touch-action', 'none');
  element.style.setProperty('cursor', 'grab');
  element.setAttribute('data-drag-gesture', 'true');
}

function syncDragVariants(
  doc: Document,
  actions: LayerInteraction['actions'],
  delta: DragPoint,
  activeTargets: Set<string>,
): Set<string> {
  const choices = dragVariantChoices(delta, actions);
  const next = new Set<string>();
  for (const choice of choices) {
    previewVariantGesture(doc, choice.targetLayerId, {
      type: 'set',
      gesture: 'drag',
      variantId: choice.variantId,
      transition: choice.transition,
    });
    next.add(choice.targetLayerId);
  }
  for (const targetLayerId of activeTargets) {
    if (next.has(targetLayerId)) continue;
    previewVariantGesture(doc, targetLayerId, { type: 'end', gesture: 'drag' });
  }
  return next;
}

function commitDragVariants(
  doc: Document,
  actions: LayerInteraction['actions'],
  delta: DragPoint,
  activeTargets: Set<string>,
): void {
  const choices = dragVariantChoices(delta, actions);
  const chosen = new Set<string>();
  for (const choice of choices) {
    chosen.add(choice.targetLayerId);
    if (choice.release !== 'stick') continue;
    previewVariantGesture(doc, choice.targetLayerId, {
      type: 'set',
      gesture: 'sticky',
      variantId: choice.variantId,
      transition: choice.transition,
    });
  }
  for (const targetLayerId of new Set([...activeTargets, ...chosen])) {
    previewVariantGesture(doc, targetLayerId, { type: 'end', gesture: 'drag' });
  }
}

function runDragPhase(
  doc: Document,
  interaction: LayerInteraction,
  phase: 'move' | 'end',
  trigger: HTMLElement | null,
  live: boolean,
): void {
  const drag = normalizeDragTrigger(interaction.drag);
  const actions = dragPhaseActions(interaction, phase);
  if (actions.length > 0) {
    const gesture = phase === 'move' || drag.phase === 'move' ? 'drag' as const : 'sticky' as const;
    runInteractionActions(doc, { ...interaction, actions }, trigger, { live, gesture });
  }
  if (phase !== 'end') return;
  for (const targetLayerId of plainDragVariantTargets(interaction.actions)) {
    previewVariantGesture(doc, targetLayerId, { type: 'end', gesture: 'drag' });
  }
  if (drag.phase !== 'move') return;
  const closing = actionsOnHoverLeave(interaction.actions);
  if (closing.length === 0) return;
  runInteractionActions(doc, { ...interaction, actions: closing }, trigger, { live, gesture: 'sticky' });
}

interface ActiveDrag {
  pointerId: number;
  originX: number;
  originY: number;
  startOffset: DragPoint;
  offset: DragPoint;
  locked: 'x' | 'y' | null;
  lastX: number;
  lastY: number;
  lastTime: number;
  velocity: DragPoint;
  moved: boolean;
  firedMove: boolean;
  counted: boolean;
  targets: Set<string>;
}

function readPointer(event: Event): { pointerId: number; button: number; x: number; y: number; time: number } | null {
  if (!('clientX' in event) || typeof event.clientX !== 'number') return null;
  if (!('clientY' in event) || typeof event.clientY !== 'number') return null;
  const pointer = event as PointerEvent;
  return {
    pointerId: typeof pointer.pointerId === 'number' ? pointer.pointerId : 1,
    button: typeof pointer.button === 'number' ? pointer.button : 0,
    x: pointer.clientX,
    y: pointer.clientY,
    time: typeof pointer.timeStamp === 'number' ? pointer.timeStamp : 0,
  };
}

/**
 * Follow the pointer on a Drag event.
 * Listeners stay on the document so a variant swap can replace the node.
 * `live: false` does nothing: the design canvas uses the pointer to select
 * and move free-form layers, and this gesture must not take that over.
 */
export function bindDragInteraction(
  doc: Document,
  layerId: string,
  interaction: LayerInteraction,
  options: { live: boolean; enabled?: () => boolean },
): () => void {
  if (!options.live || interaction.trigger !== 'drag') return () => {};
  const spec = normalizeDragTrigger(interaction.drag);
  let session: ActiveDrag | null = null;
  let frame = 0;
  let paintGeneration = 0;
  let suppressClick = false;
  let suppressTimer = 0;

  const remember = (point: DragPoint) => {
    dragOffsetByLayerId.set(layerId, point);
  };

  const scheduleReapply = (point: DragPoint) => {
    if (typeof requestAnimationFrame !== 'function') return;
    const generation = ++paintGeneration;
    requestAnimationFrame(() => {
      if (generation !== paintGeneration) return;
      paintDrag(doc, layerId, dragOffsetByLayerId.get(layerId) ?? point);
    });
  };

  const show = (point: DragPoint) => {
    remember(point);
    paintDrag(doc, layerId, point);
    scheduleReapply(point);
  };

  const cancelFrame = () => {
    if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    frame = 0;
  };

  const glide = (from: DragPoint, to: DragPoint) => {
    remember(to);
    paintGeneration += 1;
    if ((from.x === to.x && from.y === to.y) || typeof requestAnimationFrame !== 'function') {
      paintDrag(doc, layerId, to);
      scheduleReapply(to);
      return;
    }
    const start = typeof performance !== 'undefined' ? performance.now() : 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / 180);
      const eased = 1 - (1 - progress) ** 2;
      paintDrag(doc, layerId, {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
      });
      if (progress < 1) {
        frame = requestAnimationFrame(step);
        return;
      }
      frame = 0;
      paintDrag(doc, layerId, to);
      scheduleReapply(to);
    };
    frame = requestAnimationFrame(step);
  };

  const armClickSuppression = () => {
    suppressClick = true;
    if (suppressTimer) clearTimeout(suppressTimer);
    suppressTimer = setTimeout(() => {
      suppressClick = false;
      suppressTimer = 0;
    }, 400) as unknown as number;
  };

  const finish = (event: Event) => {
    if (!session) return;
    const point = readPointer(event);
    if (point && point.pointerId !== session.pointerId) return;
    const current = session;
    session = null;
    if (current.counted) setDragActive(false);
    if (!current.moved) return;
    const limits = measureDragLimits(doc, layerId, spec, current.offset);
    const settled = settleDragOffset(spec, current.offset, current.velocity, current.locked, limits);
    commitDragVariants(doc, interaction.actions, {
      x: settled.x - current.startOffset.x,
      y: settled.y - current.startOffset.y,
    }, current.targets);
    glide(current.offset, settled);
    runDragPhase(doc, interaction, 'end', findLayer(doc, layerId), options.live);
    armClickSuppression();
  };

  const onDown = (event: Event) => {
    if (options.enabled && !options.enabled()) return;
    if (session) return;
    const point = readPointer(event);
    if (!point || point.button !== 0) return;
    if (!pointerHitsLayer(doc, layerId, event)) return;
    cancelFrame();
    const origin = dragOffsetByLayerId.get(layerId) ?? { x: 0, y: 0 };
    if (origin.x !== 0 || origin.y !== 0) paintDrag(doc, layerId, origin);
    session = {
      pointerId: point.pointerId,
      originX: point.x,
      originY: point.y,
      startOffset: origin,
      offset: origin,
      locked: null,
      lastX: point.x,
      lastY: point.y,
      lastTime: point.time,
      velocity: { x: 0, y: 0 },
      moved: false,
      firedMove: false,
      counted: false,
      targets: new Set(),
    };
  };

  const onMove = (event: Event) => {
    if (!session) return;
    const point = readPointer(event);
    if (!point || point.pointerId !== session.pointerId) return;
    const elapsed = point.time - session.lastTime;
    if (elapsed >= 80) session.velocity = { x: 0, y: 0 };
    else if (elapsed > 0) {
      session.velocity = {
        x: (point.x - session.lastX) / elapsed,
        y: (point.y - session.lastY) / elapsed,
      };
    }
    session.lastX = point.x;
    session.lastY = point.y;
    session.lastTime = point.time;
    const projection = projectDragMove(
      spec,
      session.startOffset,
      { x: point.x - session.originX, y: point.y - session.originY },
      session.locked,
      measureDragLimits(doc, layerId, spec, session.offset),
    );
    session.locked = projection.locked;
    if (!projection.active) return;
    session.offset = projection.offset;
    session.moved = true;
    if (!session.counted) {
      session.counted = true;
      setDragActive(true);
    }
    show(projection.offset);
    session.targets = syncDragVariants(doc, interaction.actions, projection.delta, session.targets);
    if (!session.firedMove) {
      session.firedMove = true;
      runDragPhase(doc, interaction, 'move', findLayer(doc, layerId), options.live);
    }
    event.preventDefault?.();
  };

  const onClick = (event: Event) => {
    if (!suppressClick) return;
    suppressClick = false;
    const element = findLayer(doc, layerId);
    if (!element || !isEventNode(event.target)) return;
    if (element !== event.target && !element.contains(event.target)) return;
    event.preventDefault?.();
    event.stopPropagation?.();
  };

  const prepare = () => {
    const origin = dragOffsetByLayerId.get(layerId);
    if (origin) paintDrag(doc, layerId, origin);
    else {
      const element = findLayer(doc, layerId);
      if (!element) return;
      element.style.setProperty('touch-action', 'none');
      element.style.setProperty('cursor', 'grab');
      element.setAttribute('data-drag-gesture', 'true');
    }
  };
  prepare();

  doc.addEventListener('pointerdown', onDown, true);
  doc.addEventListener('pointermove', onMove, true);
  doc.addEventListener('pointerup', finish, true);
  doc.addEventListener('pointercancel', finish, true);
  doc.addEventListener('click', onClick, true);

  return () => {
    cancelFrame();
    if (session?.counted) setDragActive(false);
    session = null;
    if (suppressTimer) clearTimeout(suppressTimer);
    doc.removeEventListener('pointerdown', onDown, true);
    doc.removeEventListener('pointermove', onMove, true);
    doc.removeEventListener('pointerup', finish, true);
    doc.removeEventListener('pointercancel', finish, true);
    doc.removeEventListener('click', onClick, true);
  };
}

function variantOnly(interaction: LayerInteraction): LayerInteraction {
  return {
    ...interaction,
    actions: (interaction.actions ?? []).filter((action) => action.type === 'set-variant'),
  };
}

function collect(layers: Layer[]): Array<{ triggerLayerId: string; interaction: LayerInteraction }> {
  const found: Array<{ triggerLayerId: string; interaction: LayerInteraction }> = [];
  const walk = (list: Layer[]) => {
    for (const layer of list) {
      for (const interaction of layer.interactions ?? []) {
        if (
          (interaction.actions && interaction.actions.length > 0)
          || interaction.trigger === 'while-scrolling'
          || interaction.trigger === 'drag'
        ) {
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
 * Hover and Press listeners follow the layer id, so a variant swap can replace
 * the node without dropping the gesture.
 */
function bindHoverPress(
  doc: Document,
  layerId: string,
  interaction: LayerInteraction,
  live: boolean,
): () => void {
  const played = live ? interaction : variantOnly(interaction);
  if ((played.actions ?? []).length === 0) return () => {};

  if (interaction.trigger === 'hover') {
    const onOver = (event: Event) => {
      const element = pointerCrossesLayer(doc, layerId, event);
      if (!element) return;
      playInteraction(doc, played, element, { live });
    };
    const onOut = (event: Event) => {
      const element = pointerCrossesLayer(doc, layerId, event);
      if (!element) return;
      releaseInteraction(doc, played, element, { live });
    };
    doc.addEventListener('pointerover', onOver, true);
    doc.addEventListener('pointerout', onOut, true);
    return () => {
      doc.removeEventListener('pointerover', onOver, true);
      doc.removeEventListener('pointerout', onOut, true);
    };
  }

  if (interaction.trigger === 'press') {
    let pressed = false;
    const finish = () => {
      if (!pressed) return;
      pressed = false;
      releaseInteraction(doc, played, findLayer(doc, layerId), { live });
    };
    const onDown = (event: Event) => {
      const element = pointerHitsLayer(doc, layerId, event);
      if (!element) return;
      if ('button' in event && event.button !== 0) return;
      pressed = true;
      playInteraction(doc, played, element, { live });
    };
    const onOut = (event: Event) => {
      if (!pressed || !pointerCrossesLayer(doc, layerId, event)) return;
      finish();
    };
    doc.addEventListener('pointerdown', onDown, true);
    doc.addEventListener('pointerup', finish, true);
    doc.addEventListener('pointercancel', finish, true);
    doc.addEventListener('pointerout', onOut, true);
    return () => {
      doc.removeEventListener('pointerdown', onDown, true);
      doc.removeEventListener('pointerup', finish, true);
      doc.removeEventListener('pointercancel', finish, true);
      doc.removeEventListener('pointerout', onOut, true);
    };
  }

  return () => {};
}

/**
 * Bind action events. `live` is the published page: tap, hover, press, drag,
 * keyboard, timer, appear, and load run there. The editor passes `live: false`
 * and only tracks scroll plus Hover and Press variant changes, so a shortcut
 * or a drag does not fire while editing. The design canvas keeps the pointer
 * for selection and free-form move.
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
    for (const item of items) {
      if (item.interaction.trigger !== 'hover' && item.interaction.trigger !== 'press') continue;
      if (!item.interaction.actions?.some(action => action.type === 'set-variant')) continue;
      cleanups.push(bindHoverPress(doc, item.triggerLayerId, item.interaction, false));
    }
    return () => cleanups.forEach(cleanup => cleanup());
  }

  for (const item of items) {
    const trigger = findLayer(doc, item.triggerLayerId);
    const { interaction } = item;

    if (interaction.trigger === 'drag') {
      cleanups.push(bindDragInteraction(doc, item.triggerLayerId, interaction, { live: true }));
      continue;
    }

    if (!trigger) continue;

    if (interaction.trigger === 'click') {
      const handleClick = () => runInteractionActions(doc, interaction, trigger, { live: true });
      trigger.addEventListener('click', handleClick);
      cleanups.push(() => trigger.removeEventListener('click', handleClick));
    }

    if (interaction.trigger === 'hover' || interaction.trigger === 'press') {
      cleanups.push(bindHoverPress(doc, item.triggerLayerId, interaction, true));
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
