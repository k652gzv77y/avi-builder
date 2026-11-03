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
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
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
import { withActionTransition } from '@/lib/action-transition';
import {
  DEFAULT_DRAG_DISTANCE_PX,
  defaultDragTrigger,
  defaultDragVariantRule,
  sanitizeDragPixels,
} from '@/lib/drag-gesture';
import { runInteractionActions } from '@/lib/interaction-runtime';
import {
  APPEAR_PRESETS,
  DEFAULT_TIMER_DELAY_MS,
  KEYBOARD_MODIFIERS,
  SCROLL_PRESETS,
  actionLabel,
  createEventAction,
  defaultKeyboardTrigger,
  defaultTimerTrigger,
  flattenLayers,
  formatKeyLabel,
  hrefForPage,
  keyFromKeyboardEvent,
  nextScrollStop,
  removeInteractionAction,
  sanitizeMilliseconds,
  upsertInteractionAction,
  variantTargets,
  withAppearPreset,
  withScrollPreset,
} from '@/lib/interactions-framer';
import { getLayerName } from '@/lib/layer-display-utils';
import { placementForKind, resolveOverlayKind } from '@/lib/overlay-position';
import { generateId } from '@/lib/utils';
import OverlayChromeControls from './overlay-chrome-controls';
import TransitionEditor from './transition-editor';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useGlobalsStore } from '@/stores/useGlobalsStore';
import { usePagesStore } from '@/stores/usePagesStore';
import type {
  AppearPresetId,
  DragAxis,
  DragBounds,
  DragDirection,
  DragPhase,
  DragRelease,
  DragTrigger,
  DragVariantRule,
  InteractionAction,
  KeyboardTrigger,
  Layer,
  LayerInteraction,
  ScrollPresetId,
  TimerTrigger,
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
  const isActionEvent = interaction.trigger === 'click'
    || interaction.trigger === 'hover'
    || interaction.trigger === 'press'
    || interaction.trigger === 'drag'
    || interaction.trigger === 'key'
    || interaction.trigger === 'timer';

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
    const action = createEventAction(generateId('act'), kind);
    if (kind === 'set-variant' && interaction.trigger === 'drag' && action.type === 'set-variant') {
      onChange(upsertInteractionAction(interaction, { ...action, drag: defaultDragVariantRule() }));
      return;
    }
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
            {isActionEvent && (
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

      {interaction.trigger === 'key' && (
        <KeyboardFields
          keyboard={interaction.keyboard ?? defaultKeyboardTrigger()}
          onChange={(keyboard) => onChange({ ...interaction, keyboard })}
        />
      )}

      {interaction.trigger === 'timer' && (
        <TimerFields
          timer={interaction.timer ?? defaultTimerTrigger()}
          onChange={(timer) => onChange({ ...interaction, timer })}
        />
      )}

      {interaction.trigger === 'drag' && (
        <DragFields
          drag={interaction.drag ?? defaultDragTrigger()}
          onChange={(drag) => onChange({ ...interaction, drag })}
        />
      )}

      {actions.length === 0 && isActionEvent && (
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

      {actions.length === 0 && !showAppear && !isActionEvent && (
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
              isDrag={interaction.trigger === 'drag'}
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
  isDrag: boolean;
  layers: Layer[];
  targets: ReturnType<typeof variantTargets>;
  pages: Array<{ id: string; name: string; slug: string; is_index: boolean }>;
  variables: Array<{ id: string; name: string }>;
  onChange: (action: InteractionAction) => void;
}

function ActionFields({ action, isDrag, layers, targets, pages, variables, onChange }: ActionFieldsProps) {
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
        {action.type === 'set-variant' && isDrag && (
          <DragVariantFields
            rule={action.drag}
            onChange={(drag) => onChange(drag ? { ...action, drag } : { ...action, drag: undefined })}
          />
        )}
        {action.type === 'set-variant' && (
          <TransitionEditor
            value={action.transition}
            hint="Duration, delay, and stagger are in seconds. Instant plays no animation. Hover, Press, and a drag that returns replay this transition on the way back. Stagger waits between each direct child."
            onChange={(transition) => onChange(withActionTransition(action, transition))}
          />
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
          <OverlayChromeControls
            value={{
              kind: resolveOverlayKind(action),
              anchor: action.anchor ?? 'bottom',
              anchorLayerId: action.anchorLayerId,
              dismiss: action.dismiss,
            }}
            layers={layers}
            excludeLayerId={action.targetLayerId}
            onChange={(next) => onChange({
              ...action,
              kind: next.kind,
              placement: placementForKind(next.kind),
              anchor: next.anchor,
              anchorLayerId: next.anchorLayerId,
              dismiss: next.dismiss,
            })}
          />
        )}
        <TransitionEditor
          value={action.transition}
          hint={action.operation === 'close'
            ? 'Duration, delay, and stagger are in seconds. Instant reuses the transition this overlay opened with.'
            : 'Duration, delay, and stagger are in seconds. Closing and dismissing reuse this transition when Close Overlay does not set one. Stagger waits between each direct child.'}
          onChange={(transition) => onChange(withActionTransition(action, transition))}
        />
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

function KeyboardFields({
  keyboard,
  onChange,
}: {
  keyboard: KeyboardTrigger;
  onChange: (keyboard: KeyboardTrigger) => void;
}) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const key = keyFromKeyboardEvent({ key: event.key, code: event.code });
    if (!key) return;
    onChange({
      ...keyboard,
      key,
      shift: event.shiftKey,
      meta: event.metaKey,
      alt: event.altKey,
      ctrl: event.ctrlKey,
    });
  };

  return (
    <div className="flex flex-col gap-2 pb-4">
      <Field label="Key">
        <Input
          readOnly
          value={formatKeyLabel(keyboard.key)}
          placeholder="Press a key"
          aria-label="Keyboard shortcut"
          onKeyDown={handleKeyDown}
        />
      </Field>
      <Field label="When">
        <Select
          value={keyboard.phase ?? 'down'}
          onValueChange={(phase) => onChange({
            ...keyboard,
            phase: phase === 'up' ? 'up' : 'down',
          })}
        >
          <SelectTrigger className="w-full" aria-label="Key phase">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="down">Key down</SelectItem>
            <SelectItem value="up">Key up</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="flex flex-wrap gap-x-3 gap-y-2">
        {KEYBOARD_MODIFIERS.map((modifier) => (
          <label key={modifier.key} className="flex items-center gap-2">
            <Checkbox
              checked={keyboard[modifier.key] === true}
              onCheckedChange={(checked) => onChange({
                ...keyboard,
                [modifier.key]: checked === true,
              })}
            />
            <Label variant="muted">{modifier.label}</Label>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Focus the key field and press the shortcut. Cmd is the Command or Windows key.
      </p>
    </div>
  );
}

function TimerFields({
  timer,
  onChange,
}: {
  timer: TimerTrigger;
  onChange: (timer: TimerTrigger) => void;
}) {
  const writeDelay = (raw: string) => {
    if (raw.trim() === '') {
      onChange({ ...timer, delay: 0 });
      return;
    }
    const delay = sanitizeMilliseconds(raw, 0);
    if (delay === null) return;
    onChange({ ...timer, delay });
  };

  const writeInterval = (raw: string) => {
    if (raw.trim() === '') {
      onChange({ ...timer, interval: 1 });
      return;
    }
    const interval = sanitizeMilliseconds(raw, 1);
    if (interval === null) return;
    onChange({ ...timer, interval });
  };

  return (
    <div className="flex flex-col gap-2 pb-4">
      <Field label="Delay">
        <InputGroup>
          <InputGroupInput
            type="number"
            min={0}
            step={1}
            value={timer.delay}
            aria-label="Delay in milliseconds"
            onChange={(event) => writeDelay(event.target.value)}
          />
          <InputGroupAddon align="inline-end" className="text-xs text-muted-foreground">
            ms
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <label className="flex items-center gap-2">
        <Checkbox
          checked={timer.repeat === true}
          onCheckedChange={(checked) => {
            const repeat = checked === true;
            const interval = timer.interval && timer.interval > 0
              ? timer.interval
              : (timer.delay > 0 ? timer.delay : DEFAULT_TIMER_DELAY_MS);
            onChange({ ...timer, repeat, interval });
          }}
        />
        <Label variant="muted">Repeat</Label>
      </label>
      {timer.repeat && (
        <Field label="Every">
          <InputGroup>
            <InputGroupInput
              type="number"
              min={1}
              step={1}
              value={timer.interval ?? timer.delay}
              aria-label="Repeat interval in milliseconds"
              onChange={(event) => writeInterval(event.target.value)}
            />
            <InputGroupAddon align="inline-end" className="text-xs text-muted-foreground">
              ms
            </InputGroupAddon>
          </InputGroup>
        </Field>
      )}
    </div>
  );
}

const DRAG_AXES: ReadonlyArray<{ value: DragAxis; label: string }> = [
  { value: 'free', label: 'Free' },
  { value: 'x', label: 'Horizontal' },
  { value: 'y', label: 'Vertical' },
  { value: 'both', label: 'Both' },
];

const DRAG_PHASES: ReadonlyArray<{ value: DragPhase; label: string }> = [
  { value: 'move', label: 'While dragging' },
  { value: 'end', label: 'On release' },
  { value: 'both', label: 'Both' },
];

const DRAG_DIRECTIONS: ReadonlyArray<{ value: DragDirection; label: string }> = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
];

function DragFields({
  drag,
  onChange,
}: {
  drag: DragTrigger;
  onChange: (drag: DragTrigger) => void;
}) {
  const bounds = drag.bounds;
  const reference = bounds?.reference ?? 'none';

  const writeReference = (next: 'none' | 'parent' | 'px') => {
    if (next === 'none') {
      const cleared: DragTrigger = { ...drag };
      delete cleared.bounds;
      onChange(cleared);
      return;
    }
    onChange({ ...drag, bounds: { ...bounds, reference: next } });
  };

  const writeBound = (key: 'minX' | 'maxX' | 'minY' | 'maxY', raw: string) => {
    const next: DragBounds = { reference: bounds?.reference ?? 'px', ...bounds };
    if (raw.trim() === '') {
      delete next[key];
    } else {
      const pixels = sanitizeDragPixels(raw);
      if (pixels === null) return;
      next[key] = pixels;
    }
    onChange({ ...drag, bounds: next });
  };

  return (
    <div className="flex flex-col gap-2 pb-4">
      <Field label="Axis">
        <Select
          value={drag.axis}
          onValueChange={(axis) => onChange({ ...drag, axis: axis as DragAxis })}
        >
          <SelectTrigger className="w-full" aria-label="Drag axis">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DRAG_AXES.map(item => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Run">
        <Select
          value={drag.phase ?? 'end'}
          onValueChange={(phase) => onChange({ ...drag, phase: phase as DragPhase })}
        >
          <SelectTrigger className="w-full" aria-label="When drag actions run">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DRAG_PHASES.map(item => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Bounds">
        <Select
          value={reference}
          onValueChange={(value) => writeReference(value === 'parent' || value === 'px' ? value : 'none')}
        >
          <SelectTrigger className="w-full" aria-label="Drag bounds">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="parent">Parent</SelectItem>
            <SelectItem value="px">Pixels</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {bounds && (
        <>
          <PixelInput
            label="Min X"
            ariaLabel="Minimum X"
            value={bounds.minX}
            onChange={(raw) => writeBound('minX', raw)}
          />
          <PixelInput
            label="Max X"
            ariaLabel="Maximum X"
            value={bounds.maxX}
            onChange={(raw) => writeBound('maxX', raw)}
          />
          <PixelInput
            label="Min Y"
            ariaLabel="Minimum Y"
            value={bounds.minY}
            onChange={(raw) => writeBound('minY', raw)}
          />
          <PixelInput
            label="Max Y"
            ariaLabel="Maximum Y"
            value={bounds.maxY}
            onChange={(raw) => writeBound('maxY', raw)}
          />
        </>
      )}
      <label className="flex items-center gap-2">
        <Checkbox
          checked={drag.momentum === true}
          onCheckedChange={(checked) => onChange({ ...drag, momentum: checked === true })}
        />
        <Label variant="muted">Momentum</Label>
      </label>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label variant="muted">Snap points</Label>
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={() => onChange({
              ...drag,
              snap: [...(drag.snap ?? []), { x: 0, y: 0 }],
            })}
          >
            Add
          </Button>
        </div>
        {(drag.snap ?? []).map((point, index) => (
          <div key={`snap-${index}`} className="grid grid-cols-[1fr_1fr_auto] items-center gap-1">
            <SnapNumber
              label="X"
              ariaLabel={`Snap point ${index + 1} X`}
              value={point.x}
              onChange={(pixels) => {
                const snap = (drag.snap ?? []).map((item, itemIndex) => (
                  itemIndex === index ? { ...item, x: pixels } : item
                ));
                onChange({ ...drag, snap });
              }}
            />
            <SnapNumber
              label="Y"
              ariaLabel={`Snap point ${index + 1} Y`}
              value={point.y}
              onChange={(pixels) => {
                const snap = (drag.snap ?? []).map((item, itemIndex) => (
                  itemIndex === index ? { ...item, y: pixels } : item
                ));
                onChange({ ...drag, snap });
              }}
            />
            <Button
              type="button"
              size="xs"
              variant="ghost"
              aria-label={`Remove snap point ${index + 1}`}
              onClick={() => onChange({
                ...drag,
                snap: (drag.snap ?? []).filter((_, itemIndex) => itemIndex !== index),
              })}
            >
              <Icon name="x" />
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Both locks to the first axis that moves. Momentum glides a short way after release, then stops on a snap point or the bounds. Drag runs in preview and on the published page.
      </p>
    </div>
  );
}

function DragVariantFields({
  rule,
  onChange,
}: {
  rule: DragVariantRule | undefined;
  onChange: (rule: DragVariantRule | undefined) => void;
}) {
  const direction = rule?.direction ?? 'any';

  return (
    <>
      <Field label="Drag">
        <Select
          value={direction}
          onValueChange={(value) => {
            if (value === 'any') {
              onChange(undefined);
              return;
            }
            onChange({
              direction: value as DragDirection,
              distance: rule?.distance ?? DEFAULT_DRAG_DISTANCE_PX,
              release: rule?.release ?? 'stick',
            });
          }}
        >
          <SelectTrigger className="w-full" aria-label="Drag direction">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any drag</SelectItem>
            {DRAG_DIRECTIONS.map(item => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {rule && (
        <>
          <PixelInput
            label="Past"
            ariaLabel="Drag distance"
            value={rule.distance}
            onChange={(raw) => {
              if (raw.trim() === '') {
                onChange({ ...rule, distance: 0 });
                return;
              }
              const distance = sanitizeDragPixels(raw);
              if (distance === null) return;
              onChange({ ...rule, distance: Math.max(0, distance) });
            }}
          />
          <Field label="Release">
            <Select
              value={rule.release}
              onValueChange={(release) => onChange({
                ...rule,
                release: release === 'return' ? 'return' : 'stick',
              })}
            >
              <SelectTrigger className="w-full" aria-label="Drag release">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stick">Keep variant</SelectItem>
                <SelectItem value="return">Return</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Keep matches Tap: the variant stays after the distance. Return matches Hover: it shows while you are past the distance, then the previous variant comes back.
      </p>
    </>
  );
}

function SnapNumber({
  label,
  ariaLabel,
  value,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <InputGroup>
      <InputGroupAddon className="text-xs text-muted-foreground">
        {label}
      </InputGroupAddon>
      <InputGroupInput
        type="number"
        step={1}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => {
          const pixels = sanitizeDragPixels(event.target.value);
          if (pixels === null) return;
          onChange(pixels);
        }}
      />
    </InputGroup>
  );
}

function PixelInput({
  label,
  ariaLabel,
  value,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: number | undefined;
  onChange: (raw: string) => void;
}) {
  return (
    <Field label={label}>
      <InputGroup>
        <InputGroupInput
          type="number"
          step={1}
          value={value ?? ''}
          aria-label={ariaLabel}
          onChange={(event) => onChange(event.target.value)}
        />
        <InputGroupAddon align="inline-end" className="text-xs text-muted-foreground">
          px
        </InputGroupAddon>
      </InputGroup>
    </Field>
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
