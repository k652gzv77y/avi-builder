'use client';

/**
 * Figma-style variables spreadsheet.
 *
 * Collections are tables. Rows are variables. Columns are modes (Value, Dark, …).
 * Colors use color_variables; Site and Assets use global_variables.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useGlobalsStore } from '@/stores/useGlobalsStore';
import { useColorVariablesStore } from '@/stores/useColorVariablesStore';
import { useAssetsStore } from '@/stores/useAssetsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { ASSET_CATEGORIES, getOptimizedImageUrl, isAssetOfType } from '@/lib/asset-utils';
import { FIELD_TYPES } from '@/lib/collection-field-utils';
import { extractPlainTextFromTiptap } from '@/lib/tiptap-utils';
import ColorFieldInput from './ColorFieldInput';
import type { GlobalVariable, GlobalVariableType } from '@/types';
import {
  COLOR_MODE_VALUES_SETTING_KEY,
  DEFAULT_MODE_ID,
  VARIABLE_COLLECTIONS,
  VARIABLE_MODES_SETTING_KEY,
  normalizeModes,
  slugifyVariableName,
  type ColorModeValuesSetting,
  type VariableCollectionId,
  type VariableMode,
  type VariableModesSetting,
} from '@/lib/variable-collections';

const SITE_TYPES: GlobalVariableType[] = ['text', 'number', 'date', 'color', 'link', 'rich_text'];

interface VariablesSpreadsheetProps {
  collectionId: VariableCollectionId;
  canManageSchema?: boolean;
  timezone: string;
  createRequestId?: number;
  onCreateRequestHandled?: () => void;
}

function typeLabel(type: string): string {
  return FIELD_TYPES.find((t) => t.value === type)?.label ?? type;
}

function VariableImageCell({ assetId, onPick }: { assetId: string | null; onPick: () => void }) {
  const getAsset = useAssetsStore((s) => s.getAsset);
  const asset = assetId ? getAsset(assetId) : null;
  const isSvg = !!asset?.content || !!(asset?.mime_type && isAssetOfType(asset.mime_type, ASSET_CATEGORIES.ICONS));
  const imageUrl = asset?.public_url ?? null;

  return (
    <button
      type="button"
      onClick={onPick}
      className="flex items-center gap-2 min-w-0 w-full text-left h-8 px-1 rounded-md hover:bg-secondary/50"
    >
      <div className="relative size-6 rounded-[5px] overflow-hidden bg-secondary/40 shrink-0">
        {asset && (isSvg || imageUrl) && <div className="absolute inset-0 opacity-10 bg-checkerboard" />}
        {isSvg && asset?.content ? (
          <div
            className="relative w-full h-full flex items-center justify-center p-0.5 text-foreground"
            dangerouslySetInnerHTML={{ __html: asset.content }}
          />
        ) : imageUrl ? (
          <img src={getOptimizedImageUrl(imageUrl)} alt="" className="relative w-full h-full object-contain" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon name="image" className="size-3 text-muted-foreground" />
          </div>
        )}
      </div>
      <span className="truncate text-xs text-muted-foreground">
        {asset?.filename || 'Choose file'}
      </span>
    </button>
  );
}

function ColorSwatch({ value }: { value: string }) {
  const hex = value?.split('/')[0] || 'transparent';
  return (
    <span
      className="size-4 rounded-[4px] border border-black/10 shrink-0"
      style={{ background: hex }}
    />
  );
}

export default function VariablesSpreadsheet({
  collectionId,
  canManageSchema = true,
  timezone: _timezone,
  createRequestId = 0,
  onCreateRequestHandled,
}: VariablesSpreadsheetProps) {
  const { globals, isLoading: globalsLoading, hasLoaded, loadGlobals, createGlobal, updateGlobal, deleteGlobal } = useGlobalsStore();
  const {
    colorVariables,
    isLoading: colorsLoading,
    createColorVariable,
    updateColorVariable,
    deleteColorVariable,
  } = useColorVariablesStore();
  const openFileManager = useEditorStore((s) => s.openFileManager);
  const getSettingByKey = useSettingsStore((s) => s.getSettingByKey);
  const saveSettings = useSettingsStore((s) => s.saveSettings);

  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'global' | 'color'; id: string } | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [newModeName, setNewModeName] = useState('');
  const [modeDialogOpen, setModeDialogOpen] = useState(false);

  useEffect(() => {
    if (!hasLoaded) loadGlobals();
  }, [hasLoaded, loadGlobals]);

  const modesSetting = (getSettingByKey(VARIABLE_MODES_SETTING_KEY) || {}) as VariableModesSetting;
  const colorModeValues = (getSettingByKey(COLOR_MODE_VALUES_SETTING_KEY) || {}) as ColorModeValuesSetting;
  const modes = normalizeModes(modesSetting[collectionId]);

  const persistModes = useCallback(async (nextModes: VariableMode[]) => {
    const next: VariableModesSetting = { ...modesSetting, [collectionId]: nextModes };
    const ok = await saveSettings({ [VARIABLE_MODES_SETTING_KEY]: next });
    if (!ok) toast.error('Could not save modes');
  }, [collectionId, modesSetting, saveSettings]);

  const persistColorModeValues = useCallback(async (next: ColorModeValuesSetting) => {
    const ok = await saveSettings({ [COLOR_MODE_VALUES_SETTING_KEY]: next });
    if (!ok) toast.error('Could not save color value');
  }, [saveSettings]);

  const siteGlobals = useMemo(
    () => globals.filter((g) => SITE_TYPES.includes(g.type)),
    [globals],
  );
  const assetGlobals = useMemo(
    () => globals.filter((g) => g.type === 'image'),
    [globals],
  );

  const collectionMeta = VARIABLE_COLLECTIONS.find((c) => c.id === collectionId)!;
  const isLoading = collectionId === 'colors' ? colorsLoading : (globalsLoading && !hasLoaded);

  const rows: Array<{
    id: string;
    name: string;
    type: string;
    kind: 'global' | 'color';
    global?: GlobalVariable;
  }> = useMemo(() => {
    if (collectionId === 'colors') {
      return colorVariables.map((c) => ({
        id: c.id,
        name: c.name,
        type: 'color',
        kind: 'color' as const,
      }));
    }
    const list = collectionId === 'assets' ? assetGlobals : siteGlobals;
    return list.map((g) => ({
      id: g.id,
      name: g.name,
      type: g.type,
      kind: 'global' as const,
      global: g,
    }));
  }, [collectionId, colorVariables, assetGlobals, siteGlobals]);

  const defaultCreateType: GlobalVariableType =
    collectionId === 'assets' ? 'image' : collectionId === 'colors' ? 'color' : 'text';

  const handleCreate = async (type?: GlobalVariableType) => {
    if (collectionId === 'colors') {
      const created = await createColorVariable('New color', '#808080');
      if (created) {
        setEditingNameId(created.id);
        setNameDraft(created.name);
      }
      return;
    }
    const variableType = type || defaultCreateType;
    const created = await createGlobal({
      name: variableType === 'image' ? 'New image' : 'New variable',
      type: variableType,
      key: slugifyVariableName(`var-${Date.now()}`),
      value: variableType === 'number' ? '0' : variableType === 'color' ? '#808080' : '',
      order: globals.length,
    });
    if (created) {
      setEditingNameId(created.id);
      setNameDraft(created.name);
    }
  };

  useEffect(() => {
    if (!createRequestId) return;
    void handleCreate();
    onCreateRequestHandled?.();
    // Only fire when the sidebar + button asks for a new variable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createRequestId]);

  const commitName = async (row: (typeof rows)[number]) => {
    const name = nameDraft.trim() || row.name;
    setEditingNameId(null);
    if (name === row.name) return;
    if (row.kind === 'color') {
      await updateColorVariable(row.id, { name });
    } else {
      await updateGlobal(row.id, { name, key: slugifyVariableName(name) });
    }
  };

  const getGlobalModeValue = (global: GlobalVariable, modeId: string): string => {
    if (modeId === DEFAULT_MODE_ID) return global.value || '';
    return global.data?.valuesByMode?.[modeId] || '';
  };

  const setGlobalModeValue = async (global: GlobalVariable, modeId: string, value: string) => {
    if (modeId === DEFAULT_MODE_ID) {
      await updateGlobal(global.id, { value });
      return;
    }
    await updateGlobal(global.id, {
      data: {
        ...global.data,
        valuesByMode: { ...(global.data?.valuesByMode || {}), [modeId]: value },
      },
    });
  };

  const getColorModeValue = (colorId: string, modeId: string, fallback: string): string => {
    if (modeId === DEFAULT_MODE_ID) return fallback;
    return colorModeValues[colorId]?.[modeId] || '';
  };

  const setColorModeValue = async (colorId: string, modeId: string, value: string, fallbackName?: string) => {
    if (modeId === DEFAULT_MODE_ID) {
      await updateColorVariable(colorId, { value });
      return;
    }
    await persistColorModeValues({
      ...colorModeValues,
      [colorId]: { ...(colorModeValues[colorId] || {}), [modeId]: value },
    });
    void fallbackName;
  };

  const handleAddMode = async () => {
    const name = newModeName.trim();
    if (!name) return;
    const id = slugifyVariableName(name);
    if (modes.some((m) => m.id === id)) {
      toast.error('A mode with that name already exists');
      return;
    }
    await persistModes([...modes, { id, name }]);
    setNewModeName('');
    setModeDialogOpen(false);
  };

  const handleRenameMode = async (modeId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await persistModes(modes.map((m) => (m.id === modeId ? { ...m, name: trimmed } : m)));
  };

  const handleDeleteMode = async (modeId: string) => {
    if (modeId === DEFAULT_MODE_ID) return;
    await persistModes(modes.filter((m) => m.id !== modeId));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'color') {
      await deleteColorVariable(deleteTarget.id);
    } else {
      await deleteGlobal(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  const pickImage = (global: GlobalVariable, modeId: string) => {
    openFileManager(
      (asset) => {
        const isImage = asset.mime_type && (
          isAssetOfType(asset.mime_type, ASSET_CATEGORIES.IMAGES)
          || isAssetOfType(asset.mime_type, ASSET_CATEGORIES.ICONS)
        );
        if (!isImage) {
          toast.error('Please select an image');
          return false;
        }
        void setGlobalModeValue(global, modeId, asset.id);
        return undefined;
      },
      getGlobalModeValue(global, modeId) || null,
      [ASSET_CATEGORIES.IMAGES, ASSET_CATEGORIES.ICONS],
    );
  };

  const renderValueCell = (row: (typeof rows)[number], mode: VariableMode) => {
    if (row.kind === 'color') {
      const color = colorVariables.find((c) => c.id === row.id);
      const value = getColorModeValue(row.id, mode.id, color?.value || '#808080');
      return (
        <div className="flex items-center gap-2 min-w-[140px]">
          <ColorFieldInput
            value={value}
            onChange={(next) => void setColorModeValue(row.id, mode.id, next)}
          />
        </div>
      );
    }

    const global = row.global!;
    const value = getGlobalModeValue(global, mode.id);

    if (global.type === 'image') {
      return <VariableImageCell assetId={value || null} onPick={() => pickImage(global, mode.id)} />;
    }
    if (global.type === 'color') {
      return (
        <ColorFieldInput
          value={value}
          onChange={(next) => void setGlobalModeValue(global, mode.id, next)}
        />
      );
    }
    if (global.type === 'number') {
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => void setGlobalModeValue(global, mode.id, e.target.value)}
          className="h-8"
        />
      );
    }
    if (global.type === 'rich_text') {
      let preview = '';
      try {
        preview = extractPlainTextFromTiptap(JSON.parse(value || '{}'));
      } catch {
        preview = value;
      }
      return (
        <span className="text-xs text-muted-foreground truncate">{preview || 'Empty'}</span>
      );
    }
    return (
      <Input
        value={value}
        onChange={(e) => void setGlobalModeValue(global, mode.id, e.target.value)}
        placeholder="—"
        className="h-8"
      />
    );
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="p-4 flex items-center justify-between border-b gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name={collectionMeta.icon} className="size-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="font-medium leading-tight">{collectionMeta.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{collectionMeta.description}</div>
          </div>
        </div>
        {canManageSchema && (
          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu open={modeDialogOpen} onOpenChange={setModeDialogOpen}>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost">
                  <Icon name="plus" />
                  Mode
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2">
                <Label className="text-[11px] text-muted-foreground px-1">New mode name</Label>
                <div className="flex gap-1.5 mt-1.5">
                  <Input
                    value={newModeName}
                    onChange={(e) => setNewModeName(e.target.value)}
                    placeholder="Dark"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleAddMode();
                    }}
                  />
                  <Button size="sm" onClick={() => void handleAddMode()}>Add</Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            {collectionId === 'site' ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="secondary">
                    <Icon name="plus" />
                    Variable
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {SITE_TYPES.map((type) => (
                    <DropdownMenuItem key={type} onClick={() => void handleCreate(type)}>
                      <Icon name={(FIELD_TYPES.find((t) => t.value === type)?.icon || 'text') as 'text'} className="size-3" />
                      {typeLabel(type)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => void handleCreate()}>
                <Icon name="plus" />
                Variable
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <Empty>
              <EmptyTitle>No variables yet</EmptyTitle>
              <EmptyDescription>
                Add a row. Bind it to color, type, padding, or size from the inspector.
              </EmptyDescription>
            </Empty>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b text-left">
                <th className="px-4 py-2 font-medium text-muted-foreground w-[220px]">Name</th>
                <th className="px-4 py-2 font-medium text-muted-foreground w-[120px]">Type</th>
                {modes.map((mode) => (
                  <th key={mode.id} className="px-4 py-2 font-medium text-muted-foreground min-w-[180px]">
                    {canManageSchema && mode.id !== DEFAULT_MODE_ID ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="hover:text-foreground">
                            {mode.name}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => {
                              const name = window.prompt('Rename mode', mode.name);
                              if (name) void handleRenameMode(mode.id, name);
                            }}
                          >
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => void handleDeleteMode(mode.id)}>
                            Delete mode
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      mode.name
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ContextMenu key={row.id}>
                  <ContextMenuTrigger asChild>
                    <tr className="border-b hover:bg-secondary/20">
                      <td className="px-4 py-2">
                        {editingNameId === row.id ? (
                          <Input
                            autoFocus
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            onBlur={() => void commitName(row)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') setEditingNameId(null);
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="flex items-center gap-2 text-left w-full"
                            onDoubleClick={() => {
                              setEditingNameId(row.id);
                              setNameDraft(row.name);
                            }}
                          >
                            {row.type === 'color' && row.kind === 'color' && (
                              <ColorSwatch value={colorVariables.find((c) => c.id === row.id)?.value || ''} />
                            )}
                            <span className="truncate">{row.name}</span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {collectionId === 'site' && row.global && canManageSchema ? (
                          <Select
                            value={row.global.type}
                            onValueChange={(type) => void updateGlobal(row.id, { type: type as GlobalVariableType, value: '' })}
                          >
                            <SelectTrigger className="h-8 w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SITE_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>{typeLabel(type)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs">{typeLabel(row.type)}</span>
                        )}
                      </td>
                      {modes.map((mode) => (
                        <td key={mode.id} className="px-4 py-1.5 align-middle">
                          {renderValueCell(row, mode)}
                        </td>
                      ))}
                    </tr>
                  </ContextMenuTrigger>
                  {canManageSchema && (
                    <ContextMenuContent>
                      <ContextMenuItem
                        onClick={() => {
                          setEditingNameId(row.id);
                          setNameDraft(row.name);
                        }}
                      >
                        Rename
                      </ContextMenuItem>
                      <ContextMenuItem
                        variant="destructive"
                        onClick={() => setDeleteTarget({ kind: row.kind, id: row.id })}
                      >
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  )}
                </ContextMenu>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete variable?"
        description="Layers bound to this variable will keep their fallback value."
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
