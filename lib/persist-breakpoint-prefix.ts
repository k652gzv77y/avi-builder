import { pageLayersApi } from '@/lib/api';
import { projectsPath } from '@/lib/project-url';
import {
  prefixUnprefixedLayers,
  prefixUnprefixedText,
  rewriteClassText,
  rewriteLayers,
  rewriteVariantOverrides,
} from '@/lib/breakpoint-utils';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useLayerStylesStore } from '@/stores/useLayerStylesStore';
import { usePagesStore } from '@/stores/usePagesStore';
import type { Component, Layer } from '@/types';

function rewriteComponent(component: Component, from: string, to: string): { component: Component; changed: boolean } {
  let changed = false;
  let next = component;

  if (component.layers?.length) {
    const layers = rewriteLayers(component.layers, from, to);
    if (layers.changed) {
      next = { ...next, layers: layers.layers };
      changed = true;
    }
  }

  if (component.variants?.length) {
    let variantsChanged = false;
    const variants = component.variants.map((variant) => {
      let variantNext = variant;
      let variantChanged = false;
      if (variant.layers?.length) {
        const layers = rewriteLayers(variant.layers, from, to);
        if (layers.changed) {
          variantNext = { ...variantNext, layers: layers.layers };
          variantChanged = true;
        }
      }
      const overrides = rewriteVariantOverrides(variant.overrides, from, to);
      if (overrides.changed) {
        variantNext = { ...variantNext, overrides: overrides.overrides };
        variantChanged = true;
      }
      if (variantChanged) variantsChanged = true;
      return variantChanged ? variantNext : variant;
    });
    if (variantsChanged) {
      next = { ...next, variants };
      changed = true;
    }
  }

  return { component: changed ? next : component, changed };
}

function draftsFor(
  component: Component,
  existing: Record<string, Layer[]> | undefined,
  from: string,
  to: string,
): { drafts: Record<string, Layer[]>; changed: boolean } {
  const source = existing ?? {};
  let changed = false;
  const drafts: Record<string, Layer[]> = { ...source };
  const variants = component.variants ?? [];
  const ids = new Set([...Object.keys(source), ...variants.map((variant) => variant.id)]);
  for (const variantId of ids) {
    const layers = source[variantId] ?? variants.find((variant) => variant.id === variantId)?.layers ?? [];
    const rewritten = rewriteLayers(layers, from, to);
    if (!rewritten.changed) continue;
    drafts[variantId] = rewritten.layers;
    changed = true;
  }
  return { drafts, changed };
}

/**
 * Move classes that had no breakpoint prefix onto the previous primary's
 * new query. Runs before prefix rewrites so the new primary can drop its
 * old prefix without those classes being prefixed again.
 */
export async function persistBreakpointBaseDemotion(to: string): Promise<void> {
  if (!to) return;

  const pages = usePagesStore.getState();
  const nextDrafts = { ...pages.draftsByPageId };
  const changedPageIds: string[] = [];
  for (const [pageId, draft] of Object.entries(pages.draftsByPageId)) {
    if (!draft?.layers) continue;
    const prefixed = prefixUnprefixedLayers(draft.layers, to);
    if (!prefixed.changed) continue;
    nextDrafts[pageId] = { ...draft, layers: prefixed.layers };
    changedPageIds.push(pageId);
  }
  if (changedPageIds.length > 0) {
    usePagesStore.setState({ draftsByPageId: nextDrafts });
    for (const pageId of changedPageIds) {
      const layers = nextDrafts[pageId]?.layers;
      if (!layers) continue;
      await pageLayersApi.updateDraft(pageId, layers);
    }
  }

  const componentsState = useComponentsStore.getState();
  const nextComponents: Component[] = [];
  const nextComponentDrafts = { ...componentsState.componentDrafts };
  const dirtyIds: string[] = [];
  for (const component of componentsState.components) {
    const layers = component.layers?.length ? prefixUnprefixedLayers(component.layers, to) : { layers: component.layers, changed: false };
    let changed = layers.changed;
    let next = layers.changed ? { ...component, layers: layers.layers } : component;
    if (component.variants?.length) {
      let variantsChanged = false;
      const variants = component.variants.map((variant) => {
        if (!variant.layers?.length) return variant;
        const variantLayers = prefixUnprefixedLayers(variant.layers, to);
        if (!variantLayers.changed) return variant;
        variantsChanged = true;
        return { ...variant, layers: variantLayers.layers };
      });
      if (variantsChanged) {
        next = { ...next, variants };
        changed = true;
      }
    }
    const drafts = componentsState.componentDrafts[component.id];
    if (drafts) {
      let draftsChanged = false;
      const nextDraftsForComponent = { ...drafts };
      for (const [variantId, variantLayers] of Object.entries(drafts)) {
        const prefixed = prefixUnprefixedLayers(variantLayers, to);
        if (!prefixed.changed) continue;
        nextDraftsForComponent[variantId] = prefixed.layers;
        draftsChanged = true;
      }
      if (draftsChanged) {
        nextComponentDrafts[component.id] = nextDraftsForComponent;
        changed = true;
      }
    }
    nextComponents.push(next);
    if (changed) dirtyIds.push(component.id);
  }
  if (dirtyIds.length > 0) {
    useComponentsStore.setState({
      components: nextComponents,
      componentDrafts: nextComponentDrafts,
      componentDraftDirty: {
        ...componentsState.componentDraftDirty,
        ...Object.fromEntries(dirtyIds.map((id) => [id, true])),
      },
    });
    for (const componentId of dirtyIds) {
      const drafts = useComponentsStore.getState().componentDrafts[componentId];
      if (drafts && Object.keys(drafts).length > 0) {
        await useComponentsStore.getState().saveComponentDraft(componentId);
        continue;
      }
      const component = useComponentsStore.getState().components.find((item) => item.id === componentId);
      if (!component?.variants?.length) continue;
      await fetch(projectsPath(`/api/components/${componentId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants: component.variants }),
      });
    }
  }

  const styles = useLayerStylesStore.getState().styles;
  const changedStyles = styles.flatMap((style) => {
    const classes = prefixUnprefixedText(style.classes || '', to);
    return classes === (style.classes || '') ? [] : [{ ...style, classes }];
  });
  if (changedStyles.length > 0) {
    const byId = new Map(changedStyles.map((style) => [style.id, style]));
    useLayerStylesStore.setState({
      styles: styles.map((style) => byId.get(style.id) ?? style),
    });
    for (const style of changedStyles) {
      await useLayerStylesStore.getState().updateStyle(style.id, { classes: style.classes });
    }
  }
}

/**
 * When a breakpoint's max width changes, stored classes move to the new
 * Tailwind prefix so published CSS follows the edited range.
 */
export async function persistBreakpointPrefixRewrite(from: string, to: string): Promise<void> {
  if (!from || from === to) return;

  const pages = usePagesStore.getState();
  const nextDrafts = { ...pages.draftsByPageId };
  const changedPageIds: string[] = [];
  for (const [pageId, draft] of Object.entries(pages.draftsByPageId)) {
    if (!draft?.layers) continue;
    const rewritten = rewriteLayers(draft.layers, from, to);
    if (!rewritten.changed) continue;
    nextDrafts[pageId] = { ...draft, layers: rewritten.layers };
    changedPageIds.push(pageId);
  }
  if (changedPageIds.length > 0) {
    usePagesStore.setState({ draftsByPageId: nextDrafts });
    for (const pageId of changedPageIds) {
      const layers = nextDrafts[pageId]?.layers;
      if (!layers) continue;
      await pageLayersApi.updateDraft(pageId, layers);
    }
    fetch(projectsPath('/api/css/generate-pages'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageIds: changedPageIds }),
    }).catch(() => undefined);
  }

  const componentsState = useComponentsStore.getState();
  const nextComponents: Component[] = [];
  const nextComponentDrafts = { ...componentsState.componentDrafts };
  const dirtyIds: string[] = [];
  for (const component of componentsState.components) {
    const rewritten = rewriteComponent(component, from, to);
    const drafts = draftsFor(rewritten.component, componentsState.componentDrafts[component.id], from, to);
    nextComponents.push(rewritten.component);
    if (drafts.changed) nextComponentDrafts[component.id] = drafts.drafts;
    if (rewritten.changed || drafts.changed) dirtyIds.push(component.id);
  }
  if (dirtyIds.length > 0) {
    useComponentsStore.setState({
      components: nextComponents,
      componentDrafts: nextComponentDrafts,
      componentDraftDirty: {
        ...componentsState.componentDraftDirty,
        ...Object.fromEntries(dirtyIds.map((id) => [id, true])),
      },
    });
    for (const componentId of dirtyIds) {
      const drafts = useComponentsStore.getState().componentDrafts[componentId];
      if (drafts && Object.keys(drafts).length > 0) {
        await useComponentsStore.getState().saveComponentDraft(componentId);
        continue;
      }
      const component = useComponentsStore.getState().components.find((item) => item.id === componentId);
      if (!component?.variants?.length) continue;
      await fetch(projectsPath(`/api/components/${componentId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants: component.variants }),
      });
    }
  }

  const styles = useLayerStylesStore.getState().styles;
  const changedStyles = styles.flatMap((style) => {
    const classes = rewriteClassText(style.classes || '', from, to);
    return classes === (style.classes || '') ? [] : [{ ...style, classes }];
  });
  if (changedStyles.length > 0) {
    const byId = new Map(changedStyles.map((style) => [style.id, style]));
    useLayerStylesStore.setState({
      styles: styles.map((style) => byId.get(style.id) ?? style),
    });
    for (const style of changedStyles) {
      await useLayerStylesStore.getState().updateStyle(style.id, { classes: style.classes });
    }
  }
}
