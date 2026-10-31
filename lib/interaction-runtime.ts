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
  overlayOpenTargets,
  overlayPlacementStyle,
  resolveNavigateHref,
  scrollProgressThroughViewport,
  variantForScrollProgress,
} from '@/lib/interactions-framer';
import { useInteractionPreviewStore } from '@/stores/useInteractionPreviewStore';
import type { InteractionAction, Layer, LayerInteraction } from '@/types';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ActionRunOptions {
  /** Published and preview pages navigate and bind pointer events. */
  live: boolean;
  /** 0–1 scroll progress. Only scroll-to-variant actions use it. */
  scrollProgress?: number;
  onNavigate?: (href: string, openInNewTab: boolean) => void;
}

interface OverlaySession {
  overlay: HTMLElement;
  trigger: HTMLElement | null;
  restoreFocus: boolean;
  cleanup: () => void;
}

const sessions = new Map<string, OverlaySession>();

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

function pointerHit(
  target: EventTarget | null,
  overlay: HTMLElement,
  trigger: HTMLElement | null,
): 'overlay' | 'trigger' | 'outside' {
  if (!(target instanceof Node)) return 'outside';
  if (overlay.contains(target)) return 'overlay';
  if (trigger && (trigger === target || trigger.contains(target))) return 'trigger';
  return 'outside';
}

export function closeOverlay(targetLayerId: string): void {
  const session = sessions.get(targetLayerId);
  if (!session) return;
  session.cleanup();
  session.overlay.style.display = 'none';
  session.overlay.removeAttribute('data-overlay-open');
  if (session.overlay.dataset.overlayRoleAdded === 'true') {
    session.overlay.removeAttribute('role');
    session.overlay.removeAttribute('aria-modal');
    delete session.overlay.dataset.overlayRoleAdded;
  }
  sessions.delete(targetLayerId);
  if (session.restoreFocus) session.trigger?.focus();
}

function openOverlay(
  doc: Document,
  action: Extract<InteractionAction, { type: 'overlay' }>,
  trigger: HTMLElement | null,
): void {
  const overlay = findLayer(doc, action.targetLayerId);
  if (!overlay) return;
  closeOverlay(action.targetLayerId);

  const rect = trigger?.getBoundingClientRect();
  const style = overlayPlacementStyle(
    action.placement,
    rect ? { bottom: rect.bottom, left: rect.left } : undefined,
  );
  for (const [key, value] of Object.entries(style)) {
    overlay.style.setProperty(cssProperty(key), value);
  }
  overlay.setAttribute('data-overlay-open', action.placement);
  overlay.setAttribute('role', 'dialog');
  if (action.placement === 'fixed') overlay.setAttribute('aria-modal', 'true');
  overlay.dataset.overlayRoleAdded = 'true';

  if (!overlay.hasAttribute('tabindex')) overlay.setAttribute('tabindex', '-1');
  const focusable = overlay.querySelector<HTMLElement>(FOCUSABLE);
  (focusable ?? overlay).focus();

  const onKey = (event: KeyboardEvent) => {
    if (dismissOnEscape(action.dismiss, event.key)) {
      event.preventDefault();
      closeOverlay(action.targetLayerId);
    }
  };
  const onPointer = (event: Event) => {
    const hit = pointerHit(event.target, overlay, trigger);
    if (dismissOnPointer(action.dismiss, hit)) closeOverlay(action.targetLayerId);
  };
  doc.addEventListener('keydown', onKey);
  doc.addEventListener('pointerdown', onPointer, true);

  sessions.set(action.targetLayerId, {
    overlay,
    trigger,
    restoreFocus: focusAfterClose(action.dismiss),
    cleanup: () => {
      doc.removeEventListener('keydown', onKey);
      doc.removeEventListener('pointerdown', onPointer, true);
    },
  });
}

function cssProperty(key: string): string {
  return key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
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
    default:
      break;
  }
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
    if (!element || element.dataset.overlayPrepared === 'true') continue;
    element.dataset.overlayPrepared = 'true';
    element.style.display = 'none';
  }
}

/**
 * Bind action events. `live` is the published page: tap, hover, appear, and
 * load run there. The editor passes `live: false` and only tracks scroll.
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

    if (interaction.trigger === 'load') {
      runInteractionActions(doc, interaction, trigger, { live: true });
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
    for (const layerId of [...sessions.keys()]) closeOverlay(layerId);
  };
}
