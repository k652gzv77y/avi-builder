'use client';

/**
 * Event → action editor. Sits on the Interactions tab, separate from Effects.
 */

import React, { useMemo } from 'react';
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
  createNavigateAction,
  createOverlayAction,
  createScrollVariantAction,
  createSetVariantAction,
  flattenLayers,
  hrefForPage,
  nextScrollStop,
  removeInteractionAction,
  upsertInteractionAction,
  variantTargets,
  withAppearPreset,
} from '@/lib/interactions-framer';
import { getLayerName } from '@/lib/layer-display-utils';
import { generateId } from '@/lib/utils';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { usePagesStore } from '@/stores/usePagesStore';
import type {
  AppearPresetId,
  InteractionAction,
  Layer,
  LayerInteraction,
  OverlayDismiss,
  OverlayPlacement,
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
  const actions = interaction.actions ?? [];
  const showAppear = interaction.trigger === 'scroll-into-view' || interaction.trigger === 'load';
  const showScrollAction = interaction.trigger === 'while-scrolling';

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

  const handleAdd = (kind: 'set-variant' | 'open-overlay' | 'close-overlay' | 'navigate' | 'scroll-variant') => {
    const id = generateId('act');
    const action = kind === 'set-variant'
      ? createSetVariantAction(id)
      : kind === 'open-overlay'
        ? createOverlayAction(id, 'open')
        : kind === 'close-overlay'
          ? createOverlayAction(id, 'close')
          : kind === 'navigate'
            ? createNavigateAction(id)
            : createScrollVariantAction(id);
    onChange(upsertInteractionAction(interaction, action));
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

      {actions.length === 0 && !showAppear && (
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
  onChange: (action: InteractionAction) => void;
}

function ActionFields({ action, layers, targets, pages, onChange }: ActionFieldsProps) {
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
  const rows: Array<{ key: keyof OverlayDismiss; label: string }> = [
    { key: 'escape', label: 'Escape' },
    { key: 'outside', label: 'Outside click' },
    { key: 'restoreFocus', label: 'Return focus' },
  ];
  return (
    <div className="flex flex-col gap-2">
      {rows.map(row => (
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
