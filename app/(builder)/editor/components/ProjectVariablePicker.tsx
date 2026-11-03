'use client';

/**
 * Searchable project-variable picker.
 *
 * Lists color tokens and site variables that match the property, grouped by
 * folder when any variable has one and by type otherwise. Create reopens the
 * variable item sheet. Component, CMS, and Fetch sources stay in the same menu.
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon, { type IconProps } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useColorVariablesStore } from '@/stores/useColorVariablesStore';
import { useGlobalsStore } from '@/stores/useGlobalsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { BindingSource } from '@/lib/component-bindings';
import {
  buildProjectVariableOptions,
  collectionIdForProperty,
  createTypeForProperty,
  groupProjectVariables,
  literalColorSeed,
  lockTypeForProperty,
  mergeVariableFolders,
  optionMatchesProperty,
  projectVariableOption,
  type PickerProperty,
  type ProjectVariableOption,
} from '@/lib/project-variable-picker';
import {
  normalizeModes,
  SITE_VARIABLE_TYPE_VALUES,
  VARIABLE_FOLDERS_SETTING_KEY,
  VARIABLE_MODES_SETTING_KEY,
  type VariableCollectionId,
  type VariableFoldersSetting,
  type VariableModesSetting,
} from '@/lib/variable-collections';
import VariableItemSheet from './VariableItemSheet';

const TYPE_ICONS: Record<string, IconProps['name']> = {
  color: 'droplet',
  text: 'text',
  rich_text: 'rich-text',
  number: 'hash',
  date: 'calendar',
  link: 'link',
  image: 'image',
};

const SITE_TYPES = new Set<string>(SITE_VARIABLE_TYPE_VALUES);

export function useProjectVariableCatalog(property: PickerProperty, allowRichText = false) {
  const globals = useGlobalsStore(state => state.globals);
  const colorVariables = useColorVariablesStore(state => state.colorVariables);
  return useMemo(
    () => buildProjectVariableOptions({ globals, colorVariables }, property, allowRichText),
    [allowRichText, colorVariables, globals, property],
  );
}

interface SheetTarget {
  collectionId: VariableCollectionId;
  itemId: string | null;
}

interface ProjectVariablePickerProps {
  label: string;
  property: PickerProperty;
  boundId?: string | null;
  /** Name to show when the bound variable is not in the catalog (CMS label, deleted variable). */
  boundName?: string;
  onSelect: (option: ProjectVariableOption) => void;
  onUnbind?: () => void;
  sources?: BindingSource[];
  linkedSourceId?: string;
  linkedSourceName?: string;
  onUnlink?: () => void;
  /** Opens the component variable dialog while editing a component. */
  onManage?: () => void;
  allowRichText?: boolean;
  /** Current literal, used as the default when creating a variable. */
  createValue?: string;
  className?: string;
}

function sourceTitle(source: BindingSource): string {
  if (source.id === 'variables') return 'Component';
  return source.label;
}

function matchesQuery(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || name.toLowerCase().includes(q);
}

export function BoundVariableValue({
  name,
  onUnbind,
}: {
  name: string;
  onUnbind: () => void;
}) {
  return (
    <Button
      type="button"
      variant="purple"
      className="w-full justify-between"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon name="link" className="size-3 shrink-0" />
        <span className="truncate">{name}</span>
      </span>
      <span
        role="button"
        tabIndex={0}
        aria-label={`Reset ${name} to its literal value`}
        className="inline-flex size-4 items-center justify-center rounded-sm border bg-background"
        onClick={(event) => {
          event.stopPropagation();
          onUnbind();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onUnbind();
          }
        }}
      >
        <Icon name="x" className="size-2" />
      </span>
    </Button>
  );
}

export default function ProjectVariablePicker({
  label,
  property,
  boundId,
  boundName,
  onSelect,
  onUnbind,
  sources,
  linkedSourceId,
  linkedSourceName,
  onUnlink,
  onManage,
  allowRichText = false,
  createValue,
  className,
}: ProjectVariablePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sheetTarget, setSheetTarget] = useState<SheetTarget | null>(null);
  const catalog = useProjectVariableCatalog(property, allowRichText);
  const globals = useGlobalsStore(state => state.globals);
  const colorVariables = useColorVariablesStore(state => state.colorVariables);
  const getSettingByKey = useSettingsStore(state => state.getSettingByKey);

  const boundOption = boundId ? catalog.find(item => item.id === boundId) : undefined;
  const resolvedName = boundOption?.leaf ?? boundName ?? linkedSourceName;
  const groups = useMemo(
    () => groupProjectVariables(catalog, query),
    [catalog, query],
  );

  const foldersSetting = (getSettingByKey(VARIABLE_FOLDERS_SETTING_KEY) || {}) as VariableFoldersSetting;
  const modesSetting = (getSettingByKey(VARIABLE_MODES_SETTING_KEY) || {}) as VariableModesSetting;
  const sheetCollection = sheetTarget?.collectionId ?? collectionIdForProperty(property);
  const names = sheetCollection === 'colors'
    ? colorVariables.map(item => item.name)
    : globals.filter(item => SITE_TYPES.has(item.type)).map(item => item.name);
  const sheetFolders = mergeVariableFolders(foldersSetting[sheetCollection], names);
  const sheetModes = normalizeModes(modesSetting[sheetCollection]);
  const createType = createTypeForProperty(property, allowRichText);
  const createSeed = createType === 'color'
    ? literalColorSeed(createValue)
    : createType === 'number'
      ? ((createValue || '').replace(/[^\d.-]/g, '') || '0')
      : '';

  const enabledSources = (sources ?? []).filter(source => source.enabled);
  const hasSourceItems = enabledSources.some(source => {
    const items = (source.items ?? []).some(item => matchesQuery(item.name, query));
    const showCreate = !!source.onCreate && (!query.trim() || matchesQuery(sourceTitle(source), query));
    return items || showCreate;
  });

  const handleCreated = (id: string) => {
    const collectionId = sheetTarget?.collectionId ?? collectionIdForProperty(property);
    const option = collectionId === 'colors'
      ? (() => {
        const color = useColorVariablesStore.getState().getVariableById(id);
        return color
          ? projectVariableOption('color', color.id, color.name, 'color', color.value)
          : null;
      })()
      : (() => {
        const global = useGlobalsStore.getState().getGlobalById(id);
        return global
          ? projectVariableOption('global', global.id, global.name, global.type, global.value)
          : null;
      })();
    if (!option || !optionMatchesProperty(option, property, allowRichText)) return;
    onSelect(option);
  };

  const handleRemove = () => {
    if (boundId) onUnbind?.();
    else onUnlink?.();
    setOpen(false);
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={resolvedName ? 'purple' : 'variable'}
            size="xs"
            className={className ?? 'has-[>svg]:px-0'}
            aria-label={resolvedName ? `${label}, bound to ${resolvedName}` : `Bind ${label} to a variable`}
          >
            <Icon name={resolvedName ? 'link' : 'plus-circle-solid'} />
            <span className="truncate">{resolvedName ?? label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Icon
                name="search"
                className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search variables"
                aria-label="Search variables"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => {
                setSheetTarget({ collectionId: collectionIdForProperty(property), itemId: null });
                setOpen(false);
              }}
            >
              <Icon name="plus" />
              Create variable
            </Button>
            <div className="max-h-64 overflow-y-auto">
              {groups.length === 0 && !hasSourceItems ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">No matching variables</p>
              ) : groups.map(group => (
                <div key={group.id} className="flex flex-col">
                  <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  {group.items.map(item => {
                    const selected = boundId === item.id;
                    return (
                      <Button
                        key={item.id}
                        type="button"
                        variant={selected ? 'secondary' : 'ghost'}
                        size="sm"
                        className="justify-start"
                        onClick={() => {
                          onSelect(item);
                          setOpen(false);
                        }}
                      >
                        <Icon
                          name={TYPE_ICONS[item.type] ?? 'box'}
                          className="size-3 opacity-60"
                        />
                        <span className="truncate">{item.leaf}</span>
                        {selected && <Icon name="check" className="ml-auto size-3" />}
                      </Button>
                    );
                  })}
                </div>
              ))}
              {enabledSources.map(source => {
                const items = (source.items ?? []).filter(item => matchesQuery(item.name, query));
                const showCreate = !!source.onCreate && matchesQuery(sourceTitle(source), query || sourceTitle(source));
                if (items.length === 0 && !showCreate) return null;
                return (
                  <div key={source.id} className="flex flex-col">
                    <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {sourceTitle(source)}
                    </p>
                    {showCreate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => {
                          source.onCreate?.();
                          setOpen(false);
                        }}
                      >
                        {source.id === 'variables' ? 'Create component variable' : 'Create'}
                      </Button>
                    )}
                    {items.map(item => {
                      const selected = linkedSourceId === item.id;
                      return (
                        <Button
                          key={item.id}
                          type="button"
                          variant={selected ? 'secondary' : 'ghost'}
                          size="sm"
                          className="justify-start"
                          onClick={() => {
                            source.onSelect?.(item.id);
                            setOpen(false);
                          }}
                        >
                          {item.icon && (
                            <Icon
                              name={item.icon as IconProps['name']}
                              className="size-3 opacity-60"
                            />
                          )}
                          <span className="truncate">{item.name}</span>
                          {selected && <Icon name="check" className="ml-auto size-3" />}
                        </Button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {(boundId || linkedSourceId) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={handleRemove}
              >
                Remove binding
              </Button>
            )}
            {boundOption && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  setSheetTarget({
                    collectionId: boundOption.kind === 'color' ? 'colors' : 'site',
                    itemId: boundOption.sourceId,
                  });
                  setOpen(false);
                }}
              >
                Edit variable
              </Button>
            )}
            {onManage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  onManage();
                  setOpen(false);
                }}
              >
                Edit component variables
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <VariableItemSheet
        open={!!sheetTarget}
        onOpenChange={(next) => {
          if (!next) setSheetTarget(null);
        }}
        collectionId={sheetCollection}
        itemId={sheetTarget?.itemId ?? null}
        folders={sheetFolders}
        modes={sheetModes}
        initialType={sheetTarget?.itemId ? undefined : createType}
        initialValue={sheetTarget?.itemId ? undefined : createSeed}
        lockType={!sheetTarget?.itemId && lockTypeForProperty(property)}
        onCreated={handleCreated}
      />
    </>
  );
}
