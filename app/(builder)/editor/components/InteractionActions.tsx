'use client';

/**
 * Event → action editor. Sits on the Interactions tab, separate from Effects.
 */

import React, { useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { runInteractionActions } from '@/lib/interaction-runtime';
import {
  APPEAR_PRESETS,
  actionLabel,
  createEventAction,
  flattenLayers,
  hrefForPage,
  nextScrollStop,
  removeInteractionAction,
  OVERLAY_DISMISS_ROWS,
  SCROLL_PRESETS,
  upsertInteractionAction,
  variantTargets,
  withAppearPreset,
  withScrollPreset,
} from '@/lib/interactions-framer';
import { getLayerName } from '@/lib/layer-display-utils';
import { generateId } from '@/lib/utils';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useGlobalsStore } from '@/stores/useGlobalsStore';
import { usePagesStore } from '@/stores/usePagesStore';
import type {
  AppearPresetId,
  InteractionAction,
  Layer,
  LayerInteraction,
  OverlayDismiss,
  OverlayPlacement,
  ScrollPresetId,
} from '@/types';

interface InteractionActionsProps {
  interaction: LayerInteraction;
  triggerLayerId: string;
  allLayers: Layer[];
  onChange: (interaction: LayerInteraction) => void;
}

export default function InteractionActions({
  interaction,
  triggerLayerId,
  allLayers,
  onChange,
}: InteractionActionsProps) {
  const pages = usePagesStore(state => state.pages);
  const components = useComponentsStore(state => state.components);
  const globals = useGlobalsStore(state => state.globals);
  const globalsLoaded = useGlobalsStore(state => state.hasLoaded);
  const loadGlobals = useGlobalsStore(state => state.loadGlobals);
  const actions = interaction.actions ?? [];
  const showAppear = interaction.trigger === 'scroll-into-view' || interaction.trigger === 'load';
  const showScroll = interaction.trigger === 'while-scrolling';
  const showScrollAction = showScroll;
  const isPointerEvent = interaction.trigger === 'click' || interaction.trigger === 'hover' || interaction.trigger === 'press';

  useEffect(() => {
    if (!globalsLoaded) {
      void loadGlobals();
    }
  }, [globalsLoaded, loadGlobals]);

  const layers = useMemo(
    () => flattenLayers(allLayers).filter(layer => layer.id !== 'body'),
    [allLayers],
  );
  const targets = useMemo(
    () => variantTargets(allLayers, components),
    [allLayers, components],
  );
  const pageChoices = useMemo(
    () => pages.filter(page => !page.deleted_at),
    [pages],
  );
  const variableChoices = useMemo(
    () => globals.filter(item => !item.deleted_at && item.type !== 'image' && item.type !== 'rich_text'),
    [globals],
  );

  const handleAdd = (kind: 'set-variant' | 'open-overlay' | 'close-overlay' | 'navigate' | 'scroll-to' | 'set-variable' | 'scroll-variant') => {
    onChange(upsertInteractionAction(interaction, createEventAction(generateId('act'), kind)));
  };

  const handlePlay = (action: InteractionAction) => {
    const iframe = document.querySelector('iframe') as HTMLIFrameElement | null;
    const doc = iframe?.contentDocument ?? document;
    const trigger = doc.querySelector(`[data-layer-id="${CSS.escape(triggerLayerId)}"]`) as HTMLElement | null;
    runInteractionActions(doc, { ...interaction, actions: [action] }, trigger, {
      live: false,
      scrollProgress: action.type === 'scroll-variant' ? 1 : undefined,
      onNavigate: (href) => {
        toast.message(`Navigate to ${href}`);
      },
      onScrollTo: (label) => {
        toast.message(`Scroll to ${label}`);
      },
      onSetVariable: (_variableId, value) => {
        const name = globals.find(item => item.id === _variableId)?.name;
        toast.message(name ? `Set ${name} to ${value}` : `Set variable to ${value}`);
      },
    });
  };

  const updateAction = (action: InteractionAction) => {
    onChange(upsertInteractionAction(interaction, action));
  };

  return (
    <div className="border-t">
      <header className="py-5 flex justify-between">
        <span className="font-medium">Actions</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="xs"
              variant="secondary"
              aria-label="Add action"
            >
              <Icon name="plus" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleAdd('set-variant')}>Set Variant</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAdd('open-overlay')}>Open Overlay</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAdd('close-overlay')}>Close Overlay</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAdd('navigate')}>Navigate</DropdownMenuItem>
            {isPointerEvent && (
              <>
                <DropdownMenuItem onClick={() => handleAdd('scroll-to')}>Scroll to</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAdd('set-variable')}>Set variable</DropdownMenuItem>
              </>
            )}
            {showScrollAction && (
              <DropdownMenuItem onClick={() => handleAdd('scroll-variant')}>Scroll to Variant</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {showAppear && (
        <div className="grid grid-cols-3 items-center pb-4">
          <Label variant="muted">Appear</Label>
          <div className="col-span-2">
            <Select
              value={interaction.appearPreset ?? 'custom'}
              onValueChange={(value) => {
                if (value === 'custom') return;
                onChange(withAppearPreset(interaction, triggerLayerId, value as AppearPresetId, generateId('anm')));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                {APPEAR_PRESETS.map(preset => (
                  <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {showScroll && (
        <div className="grid grid-cols-3 items-center pb-4">
          <Label variant="muted">Scroll</Label>
          <div className="col-span-2">
            <Select
              value={interaction.scrollPreset ?? 'custom'}
              onValueChange={(value) => {
                if (value === 'custom') return;
                onChange(withScrollPreset(interaction, triggerLayerId, value as ScrollPresetId, generateId('anm')));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                {SCROLL_PRESETS.map(preset => (
                  <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {actions.length === 0 && isPointerEvent && (
        <div className="flex flex-col gap-1 pb-4">
          <p className="text-xs text-muted-foreground">
            Choose an action for this event.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => handleAdd('navigate')}
          >
            Navigate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => handleAdd('set-variant')}
          >
            Set variant
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => handleAdd('open-overlay')}
          >
            Open overlay
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => handleAdd('scroll-to')}
          >
            Scroll to
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => handleAdd('set-variable')}
          >
            Set variable
          </Button>
        </div>
      )}

      {actions.length === 0 && !showAppear && !isPointerEvent && (
        <p className="text-xs text-muted-foreground pb-4">
          Add an action for this event.
        </p>
      )}

      <div className="flex flex-col gap-4 pb-4">
        {actions.map(action => (
          <div key={action.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Label className="flex-1">{actionLabel(action)}</Label>
              <Button
                type="button"
                size="xs"
                variant="secondary"
                aria-label={`Play ${actionLabel(action)}`}
                onClick={() => handlePlay(action)}
              >
                <Icon name="play" />
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                aria-label={`Remove ${actionLabel(action)}`}
                onClick={() => onChange(removeInteractionAction(interaction, action.id))}
              >
                <Icon name="x" />
              </Button>
            </div>
            <ActionFields
              action={action}
              layers={layers}
              targets={targets}
              pages={pageChoices.map(page => ({ id: page.id, name: page.name, slug: page.slug, is_index: page.is_index }))}
              variables={variableChoices.map(item => ({ id: item.id, name: item.name }))}
              onChange={updateAction}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface ActionFieldsProps {
  action: InteractionAction;
  layers: Layer[];
  targets: ReturnType<typeof variantTargets>;
  pages: Array<{ id: string; name: string; slug: string; is_index: boolean }>;
  variables: Array<{ id: string; name: string }>;
  onChange: (action: InteractionAction) => void;
}

function ActionFields({ action, layers, targets, pages, variables, onChange }: ActionFieldsProps) {
  if (action.type === 'set-variant' || action.type === 'scroll-variant') {
    const target = targets.find(item => item.layerId === action.targetLayerId);
    return (
      <>
        <Field label="Component">
          <Select
            value={action.targetLayerId || undefined}
            onValueChange={(layerId) => {
              const next = targets.find(item => item.layerId === layerId);
              if (action.type === 'set-variant') {
                onChange({ ...action, targetLayerId: layerId, variantId: next?.variants[0]?.id ?? '' });
              } else {
                onChange({
                  ...action,
                  targetLayerId: layerId,
                  stops: action.stops.map((stop, index) => ({
                    ...stop,
                    variantId: stop.variantId || next?.variants[index]?.id || next?.variants[0]?.id || '',
                  })),
                });
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {targets.map(item => (
                <SelectItem key={item.layerId} value={item.layerId}>
                  {item.componentName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {action.type === 'set-variant' && (
          <Field label="Variant">
            <VariantSelect
              variants={target?.variants ?? []}
              value={action.variantId}
              onChange={(variantId) => onChange({ ...action, variantId })}
            />
          </Field>
        )}
        {action.type === 'scroll-variant' && action.stops.map((stop, index) => (
          <Field key={`${action.id}-${index}`} label={`${Math.round(stop.at * 100)}%`}>
            <div className="flex items-center gap-1">
              <VariantSelect
                variants={target?.variants ?? []}
                value={stop.variantId}
                onChange={(variantId) => {
                  const stops = action.stops.map((item, itemIndex) => (
                    itemIndex === index ? { ...item, variantId } : item
                  ));
                  onChange({ ...action, stops });
                }}
              />
              {action.stops.length > 1 && (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  aria-label="Remove stop"
                  onClick={() => onChange({
                    ...action,
                    stops: action.stops.filter((_, itemIndex) => itemIndex !== index),
                  })}
                >
                  <Icon name="x" />
                </Button>
              )}
            </div>
          </Field>
        ))}
        {action.type === 'scroll-variant' && (
          <div className="flex justify-end">
            <Button
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => onChange({
                ...action,
                stops: [...action.stops, { at: nextScrollStop(action.stops), variantId: target?.variants[0]?.id ?? '' }],
              })}
            >
              Add stop
            </Button>
          </div>
        )}
      </>
    );
  }

  if (action.type === 'overlay') {
    return (
      <>
        <Field label="Layer">
          <Select
            value={action.targetLayerId || undefined}
            onValueChange={(targetLayerId) => onChange({ ...action, targetLayerId })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {layers.map(layer => (
                <SelectItem key={layer.id} value={layer.id}>{getLayerName(layer)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {action.operation === 'open' && (
          <>
            <Field label="Position">
              <Tabs
                value={action.placement}
                onValueChange={(placement) => onChange({ ...action, placement: placement as OverlayPlacement })}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="fixed">Fixed</TabsTrigger>
                  <TabsTrigger value="relative">Relative</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <DismissFields
              dismiss={action.dismiss}
              onChange={(dismiss) => onChange({ ...action, dismiss })}
            />
          </>
        )}
      </>
    );
  }

  if (action.type === 'scroll-to') {
    return (
      <>
        <Field label="To">
          <Tabs
            value={action.target}
            onValueChange={(target) => onChange({
              ...action,
              target: target as 'layer' | 'page',
            })}
          >
            <TabsList className="w-full">
              <TabsTrigger value="layer">Layer</TabsTrigger>
              <TabsTrigger value="page">Page</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        {action.target === 'layer' ? (
          <Field label="Layer">
            <Select
              value={action.targetLayerId || undefined}
              onValueChange={(targetLayerId) => onChange({ ...action, targetLayerId })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {layers.map(layer => (
                  <SelectItem key={layer.id} value={layer.id}>{getLayerName(layer)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Field label="Position">
            <Tabs
              value={action.position === 'bottom' ? 'bottom' : 'top'}
              onValueChange={(position) => onChange({
                ...action,
                position: position as 'top' | 'bottom',
              })}
            >
              <TabsList className="w-full">
                <TabsTrigger value="top">Top</TabsTrigger>
                <TabsTrigger value="bottom">Bottom</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        )}
      </>
    );
  }

  if (action.type === 'set-variable') {
    return (
      <>
        <Field label="Variable">
          <Select
            value={action.variableId || undefined}
            onValueChange={(variableId) => onChange({ ...action, variableId })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={variables.length === 0 ? 'No project variables' : 'Choose'} />
            </SelectTrigger>
            <SelectContent>
              {variables.map(variable => (
                <SelectItem key={variable.id} value={variable.id}>{variable.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Value">
          <Input
            value={action.value}
            placeholder="Value"
            onChange={(event) => onChange({ ...action, value: event.target.value })}
          />
        </Field>
      </>
    );
  }

  if (action.type !== 'navigate') return null;

  return (
    <>
      <Field label="To">
        <Tabs
          value={action.destination}
          onValueChange={(destination) => onChange({
            ...action,
            destination: destination as 'page' | 'url',
            href: '',
            pageId: undefined,
          })}
        >
          <TabsList className="w-full">
            <TabsTrigger value="page">Page</TabsTrigger>
            <TabsTrigger value="url">URL</TabsTrigger>
          </TabsList>
        </Tabs>
      </Field>
      {action.destination === 'page' ? (
        <Field label="Page">
          <Select
            value={action.pageId || undefined}
            onValueChange={(pageId) => {
              const page = pages.find(item => item.id === pageId);
              onChange({
                ...action,
                pageId,
                href: page ? hrefForPage(page) : '',
              });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {pages.map(page => (
                <SelectItem key={page.id} value={page.id}>{page.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : (
        <Field label="URL">
          <Input
            value={action.href ?? ''}
            placeholder="https://"
            onChange={(event) => onChange({ ...action, href: event.target.value })}
          />
        </Field>
      )}
      <label className="flex items-center gap-2">
        <Checkbox
          checked={action.openInNewTab === true}
          onCheckedChange={(checked) => onChange({ ...action, openInNewTab: checked === true })}
        />
        <Label variant="muted">New tab</Label>
      </label>
    </>
  );
}

function VariantSelect({
  variants,
  value,
  onChange,
}: {
  variants: Array<{ id: string; name: string }>;
  value: string;
  onChange: (variantId: string) => void;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Choose" />
      </SelectTrigger>
      <SelectContent>
        {variants.map(variant => (
          <SelectItem key={variant.id} value={variant.id}>{variant.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DismissFields({
  dismiss,
  onChange,
}: {
  dismiss: OverlayDismiss;
  onChange: (dismiss: OverlayDismiss) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {OVERLAY_DISMISS_ROWS.map(row => (
        <label key={row.key} className="flex items-center gap-2">
          <Checkbox
            checked={dismiss[row.key]}
            onCheckedChange={(checked) => onChange({ ...dismiss, [row.key]: checked === true })}
          />
          <Label variant="muted">{row.label}</Label>
        </label>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 items-center gap-2">
      <Label variant="muted">{label}</Label>
      <div className="col-span-2">{children}</div>
    </div>
  );
}
