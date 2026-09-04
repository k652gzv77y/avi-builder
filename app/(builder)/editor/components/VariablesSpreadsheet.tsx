'use client';

/**
 * Variable collections table.
 *
 * Matches the CMS collection list: search, multi-select, click a row to open
 * the item sheet, and Framer-style folders for grouping color styles.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
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
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { useGlobalsStore } from '@/stores/useGlobalsStore';
import { useColorVariablesStore } from '@/stores/useColorVariablesStore';
import { useAssetsStore } from '@/stores/useAssetsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { ASSET_CATEGORIES, getOptimizedImageUrl, isAssetOfType } from '@/lib/asset-utils';
import { extractPlainTextFromTiptap } from '@/lib/tiptap-utils';
import { cn } from '@/lib/utils';
import type { GlobalVariable } from '@/types';
import VariableItemSheet from './VariableItemSheet';
import {
  COLOR_MODE_VALUES_SETTING_KEY,
  DEFAULT_MODE_ID,
  SITE_VARIABLE_TYPE_VALUES,
  VARIABLE_COLLECTIONS,
  VARIABLE_FOLDERS_SETTING_KEY,
  VARIABLE_MODES_SETTING_KEY,
  joinVariablePath,
  normalizeModes,
  parseVariablePath,
  renameVariableFolder,
  slugifyVariableName,
  stripVariableFolder,
  type ColorModeValuesSetting,
  type VariableCollectionId,
  type VariableFoldersSetting,
  type VariableMode,
  type VariableModesSetting,
} from '@/lib/variable-collections';

interface VariablesSpreadsheetProps {
  collectionId: VariableCollectionId;
  canManageSchema?: boolean;
  timezone: string;
}

interface VariableRow {
  id: string;
  name: string;
  folder: string | null;
  leaf: string;
  type: string;
  kind: 'global' | 'color';
  global?: GlobalVariable;
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

function ImagePreview({ assetId }: { assetId: string | null }) {
  const getAsset = useAssetsStore((state) => state.getAsset);
  const asset = assetId ? getAsset(assetId) : null;
  const isSvg = !!asset?.content || !!(asset?.mime_type && isAssetOfType(asset.mime_type, ASSET_CATEGORIES.ICONS));
  const imageUrl = asset?.public_url ?? null;

  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="relative size-6 rounded-[5px] overflow-hidden bg-secondary/40 shrink-0">
        {asset && (isSvg || imageUrl) && <span className="absolute inset-0 opacity-10 bg-checkerboard" />}
        {isSvg && asset?.content ? (
          <span
            className="relative w-full h-full flex items-center justify-center p-0.5 text-foreground [&>svg]:size-full"
            dangerouslySetInnerHTML={{ __html: asset.content }}
          />
        ) : imageUrl ? (
          <img
            src={getOptimizedImageUrl(imageUrl)} alt=""
            className="relative w-full h-full object-contain"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center">
            <Icon name="image" className="size-3 text-muted-foreground" />
          </span>
        )}
      </span>
      <span className="truncate text-muted-foreground">{asset?.filename || '—'}</span>
    </span>
  );
}

export default function VariablesSpreadsheet({
  collectionId,
  canManageSchema = true,
  timezone: _timezone,
}: VariablesSpreadsheetProps) {
  const { globals, isLoading: globalsLoading, hasLoaded, loadGlobals, updateGlobal, deleteGlobal } = useGlobalsStore();
  const {
    colorVariables,
    isLoading: colorsLoading,
    updateColorVariable,
    deleteColorVariable,
  } = useColorVariablesStore();
  const getSettingByKey = useSettingsStore((state) => state.getSettingByKey);
  const saveSettings = useSettingsStore((state) => state.saveSettings);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [sheetItemId, setSheetItemId] = useState<string | null | undefined>(undefined);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newModeName, setNewModeName] = useState('');
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [renameFolder, setRenameFolder] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');

  useEffect(() => {
    if (!hasLoaded) void loadGlobals();
  }, [hasLoaded, loadGlobals]);

  useEffect(() => {
    setSearchQuery('');
    setSelectedIds(new Set());
    setSheetItemId(undefined);
  }, [collectionId]);

  const modesSetting = (getSettingByKey(VARIABLE_MODES_SETTING_KEY) || {}) as VariableModesSetting;
  const colorModeValues = (getSettingByKey(COLOR_MODE_VALUES_SETTING_KEY) || {}) as ColorModeValuesSetting;
  const foldersSetting = (getSettingByKey(VARIABLE_FOLDERS_SETTING_KEY) || {}) as VariableFoldersSetting;
  const modes = normalizeModes(modesSetting[collectionId]);
  const storedFolders = foldersSetting[collectionId] || [];

  const persistModes = useCallback(async (nextModes: VariableMode[]) => {
    const next: VariableModesSetting = { ...modesSetting, [collectionId]: nextModes };
    const ok = await saveSettings({ [VARIABLE_MODES_SETTING_KEY]: next });
    if (!ok) toast.error('Could not save modes');
  }, [collectionId, modesSetting, saveSettings]);

  const persistFolders = useCallback(async (nextFolders: string[]) => {
    const unique = [...new Set(nextFolders.map((folder) => folder.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const next: VariableFoldersSetting = { ...foldersSetting, [collectionId]: unique };
    const ok = await saveSettings({ [VARIABLE_FOLDERS_SETTING_KEY]: next });
    if (!ok) toast.error('Could not save folders');
  }, [collectionId, foldersSetting, saveSettings]);

  const siteTypeSet = useMemo(() => new Set<string>(SITE_VARIABLE_TYPE_VALUES), []);
  const siteGlobals = useMemo(
    () => globals.filter((item) => siteTypeSet.has(item.type)),
    [globals, siteTypeSet],
  );
  const assetGlobals = useMemo(
    () => globals.filter((item) => item.type === 'image'),
    [globals],
  );

  const collectionMeta = VARIABLE_COLLECTIONS.find((item) => item.id === collectionId)!;
  const isLoading = collectionId === 'colors' ? colorsLoading : (globalsLoading && !hasLoaded);

  const rows: VariableRow[] = useMemo(() => {
    const toRow = (id: string, name: string, type: string, kind: VariableRow['kind'], global?: GlobalVariable): VariableRow => {
      const path = parseVariablePath(name);
      return { id, name, folder: path.folder, leaf: path.leaf, type, kind, global };
    };
    if (collectionId === 'colors') {
      return colorVariables.map((item) => toRow(item.id, item.name, 'color', 'color'));
    }
    const list = collectionId === 'assets' ? assetGlobals : siteGlobals;
    return list.map((item) => toRow(item.id, item.name, item.type, 'global', item));
  }, [collectionId, colorVariables, assetGlobals, siteGlobals]);

  const folders = useMemo(() => {
    const fromRows = rows.map((row) => row.folder).filter((folder): folder is string => !!folder);
    return [...new Set([...storedFolders, ...fromRows])].sort((a, b) => a.localeCompare(b));
  }, [rows, storedFolders]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => (
      row.leaf.toLowerCase().includes(query)
      || row.name.toLowerCase().includes(query)
      || (row.folder && row.folder.toLowerCase().includes(query))
    ));
  }, [rows, searchQuery]);

  const grouped = useMemo(() => {
    const ungrouped: VariableRow[] = [];
    const byFolder = new Map<string, VariableRow[]>();
    for (const folder of folders) byFolder.set(folder, []);
    for (const row of filteredRows) {
      if (row.folder && byFolder.has(row.folder)) {
        byFolder.get(row.folder)!.push(row);
      } else if (row.folder) {
        byFolder.set(row.folder, [row]);
      } else {
        ungrouped.push(row);
      }
    }
    const folderEntries = [...byFolder.entries()]
      .filter(([folder, items]) => items.length > 0 || (folders.includes(folder) && !searchQuery.trim()))
      .sort(([a], [b]) => a.localeCompare(b));
    return { ungrouped, folderEntries };
  }, [filteredRows, folders, searchQuery]);

  const visibleIds = useMemo(() => {
    const ids: string[] = grouped.ungrouped.map((row) => row.id);
    for (const [folder, items] of grouped.folderEntries) {
      if (collapsedFolders.has(folder)) continue;
      ids.push(...items.map((row) => row.id));
    }
    return ids;
  }, [grouped, collapsedFolders]);

  const getModeValue = (row: VariableRow, mode: VariableMode): string => {
    if (row.kind === 'color') {
      const color = colorVariables.find((item) => item.id === row.id);
      if (mode.id === DEFAULT_MODE_ID) return color?.value || '';
      return colorModeValues[row.id]?.[mode.id] || '';
    }
    const global = row.global;
    if (!global) return '';
    if (mode.id === DEFAULT_MODE_ID) return global.value || '';
    return global.data?.valuesByMode?.[mode.id] || '';
  };

  const renderPreview = (row: VariableRow, mode: VariableMode) => {
    const value = getModeValue(row, mode);
    if (row.type === 'color' || row.kind === 'color') {
      if (!value) return <span className="text-muted-foreground">—</span>;
      return (
        <span className="flex items-center gap-2 min-w-0">
          <ColorSwatch value={value} />
          <span className="truncate text-muted-foreground">{value.split('/')[0]}</span>
        </span>
      );
    }
    if (row.type === 'image') return <ImagePreview assetId={value || null} />;
    if (row.type === 'rich_text') {
      let preview = '';
      try {
        preview = extractPlainTextFromTiptap(JSON.parse(value || '{}'));
      } catch {
        preview = value;
      }
      return <span className="truncate text-muted-foreground">{preview || '—'}</span>;
    }
    return <span className="truncate text-muted-foreground">{value || '—'}</span>;
  };

  const openItem = (id: string | null) => setSheetItemId(id);
  const handleSelectAll = () => {
    if (selectedIds.size === visibleIds.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(visibleIds));
  };
  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateFolder = async () => {
    const folder = newFolderName.trim();
    if (!folder) return;
    if (folders.includes(folder)) {
      toast.error('A folder with that name already exists');
      return;
    }
    await persistFolders([...folders, folder]);
    setNewFolderName('');
    setFolderDialogOpen(false);
  };

  const handleRenameFolder = async () => {
    if (!renameFolder) return;
    const nextName = renameFolderValue.trim();
    if (!nextName || nextName === renameFolder) {
      setRenameFolder(null);
      return;
    }
    const affected = rows.filter((row) => row.folder === renameFolder);
    await Promise.all(affected.map((row) => {
      const name = renameVariableFolder(row.name, renameFolder, nextName);
      return row.kind === 'color'
        ? updateColorVariable(row.id, { name })
        : updateGlobal(row.id, { name, key: slugifyVariableName(name) });
    }));
    await persistFolders([...folders.filter((folder) => folder !== renameFolder), nextName]);
    setRenameFolder(null);
  };

  const handleDeleteFolder = async (folder: string) => {
    const affected = rows.filter((row) => row.folder === folder);
    await Promise.all(affected.map((row) => {
      const name = stripVariableFolder(row.name, folder);
      return row.kind === 'color'
        ? updateColorVariable(row.id, { name })
        : updateGlobal(row.id, { name, key: slugifyVariableName(name) });
    }));
    await persistFolders(folders.filter((item) => item !== folder));
  };

  const moveToFolder = async (row: VariableRow, folder: string | null) => {
    const name = joinVariablePath(folder, row.leaf);
    if (row.kind === 'color') await updateColorVariable(row.id, { name });
    else await updateGlobal(row.id, { name, key: slugifyVariableName(name) });
  };

  const handleAddMode = async () => {
    const name = newModeName.trim();
    if (!name) return;
    const id = slugifyVariableName(name);
    if (modes.some((mode) => mode.id === id)) {
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
    await persistModes(modes.map((mode) => (mode.id === modeId ? { ...mode, name: trimmed } : mode)));
  };

  const handleDeleteMode = async (modeId: string) => {
    if (modeId === DEFAULT_MODE_ID) return;
    await persistModes(modes.filter((mode) => mode.id !== modeId));
  };

  const confirmDelete = async () => {
    if (!deleteIds) return;
    const idSet = new Set(deleteIds);
    await Promise.all(rows.filter((row) => idSet.has(row.id)).map((row) => (
      row.kind === 'color' ? deleteColorVariable(row.id) : deleteGlobal(row.id)
    )));
    setSelectedIds(new Set());
    setDeleteIds(null);
  };

  const renderRow = (row: VariableRow) => (
    <ContextMenu key={row.id}>
      <ContextMenuTrigger asChild>
        <tr
          className="border-b hover:bg-secondary/50 cursor-pointer"
          onClick={() => openItem(row.id)}
        >
          <td className="pl-5 pr-3 py-3 w-12" onClick={(event) => event.stopPropagation()}>
            <Checkbox
              checked={selectedIds.has(row.id)}
              onCheckedChange={() => toggleSelected(row.id)}
              onClick={(event) => event.stopPropagation()}
            />
          </td>
          <td className="px-4 py-5">
            <span className="truncate">{row.leaf}</span>
          </td>
          {modes.map((mode) => (
            <td key={mode.id} className="px-4 py-5 text-muted-foreground">
              {renderPreview(row, mode)}
            </td>
          ))}
        </tr>
      </ContextMenuTrigger>
      {canManageSchema && (
        <ContextMenuContent>
          <ContextMenuItem onClick={() => openItem(row.id)}>Open</ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Move to folder</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => void moveToFolder(row, null)}>No folder</ContextMenuItem>
              {folders.map((folder) => (
                <ContextMenuItem key={folder} onClick={() => void moveToFolder(row, folder)}>
                  {folder}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => setDeleteIds([row.id])}>
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  );

  const hasRows = filteredRows.length > 0 || grouped.folderEntries.length > 0;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="p-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-1.5">
          <InputGroup className="w-full max-w-72">
            <InputGroupInput
              placeholder="Search..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <InputGroupAddon>
              <Icon name="search" className="size-3" />
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDeleteIds([...selectedIds])}
            >
              Delete
              <Badge variant="secondary" className="text-[10px] px-1.5">{selectedIds.size}</Badge>
            </Button>
          )}
          {canManageSchema && (
            <>
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
                      onChange={(event) => setNewModeName(event.target.value)}
                      placeholder="Dark"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void handleAddMode();
                      }}
                    />
                    <Button size="sm" onClick={() => void handleAddMode()}>Add</Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm" variant="ghost"
                onClick={() => setFolderDialogOpen(true)}
              >
                <Icon name="folder" />
                Folder
              </Button>
              <Button
                size="sm" variant="secondary"
                onClick={() => openItem(null)}
              >
                <Icon name="plus" />
                New Item
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto flex flex-col min-w-0">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Spinner />
          </div>
        ) : !hasRows ? (
          <div className="flex items-center justify-center p-12">
            <Empty>
              <EmptyTitle>No {collectionMeta.name.toLowerCase()} yet</EmptyTitle>
              <EmptyDescription>
                {searchQuery ? 'No variables match that search.' : 'Click + New Item to add one.'}
              </EmptyDescription>
            </Empty>
          </div>
        ) : (
          <table className="border-0 whitespace-nowrap text-xs min-w-full align-top border-separate border-spacing-0 [&>tbody>tr>td]:border-b [&>tbody>tr>td]:max-w-56">
            <thead>
              <tr>
                <th className="pl-5 pr-3 py-5 text-left font-normal w-12 sticky top-0 z-10 bg-background border-b border-border">
                  <Checkbox
                    checked={visibleIds.length > 0 && selectedIds.size === visibleIds.length}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="px-4 py-5 text-left font-normal sticky top-0 z-10 bg-background border-b border-border">
                  Name
                </th>
                {modes.map((mode) => (
                  <th key={mode.id} className="px-4 py-5 text-left font-normal sticky top-0 z-10 bg-background border-b border-border">
                    {canManageSchema && mode.id !== DEFAULT_MODE_ID ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="hover:opacity-50">
                            {mode.name}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => {
                              const next = window.prompt('Rename mode', mode.name);
                              if (next) void handleRenameMode(mode.id, next);
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
              {grouped.folderEntries.map(([folder, items]) => {
                const collapsed = collapsedFolders.has(folder);
                return [
                  <ContextMenu key={`folder-${folder}`}>
                    <ContextMenuTrigger asChild>
                      <tr
                        className="border-b bg-secondary/20 hover:bg-secondary/40 cursor-pointer"
                        onClick={() => {
                          setCollapsedFolders((current) => {
                            const next = new Set(current);
                            if (next.has(folder)) next.delete(folder);
                            else next.add(folder);
                            return next;
                          });
                        }}
                      >
                        <td className="pl-5 pr-3 py-3 w-12">
                          <Icon name={collapsed ? 'chevronRight' : 'chevronDown'} className="size-3 text-muted-foreground" />
                        </td>
                        <td className="px-4 py-3" colSpan={modes.length + 1}>
                          <span className="flex items-center gap-2 font-medium">
                            <Icon name="folder" className="size-3.5 text-muted-foreground" />
                            {folder}
                            <span className="text-muted-foreground font-normal">{items.length}</span>
                          </span>
                        </td>
                      </tr>
                    </ContextMenuTrigger>
                    {canManageSchema && (
                      <ContextMenuContent>
                        <ContextMenuItem
                          onClick={() => {
                            setRenameFolder(folder);
                            setRenameFolderValue(folder);
                          }}
                        >
                          Rename folder
                        </ContextMenuItem>
                        <ContextMenuItem variant="destructive" onClick={() => void handleDeleteFolder(folder)}>
                          Delete folder
                        </ContextMenuItem>
                      </ContextMenuContent>
                    )}
                  </ContextMenu>,
                  ...(!collapsed ? items.map(renderRow) : []),
                ];
              })}
              {grouped.ungrouped.map(renderRow)}
            </tbody>
          </table>
        )}
      </div>

      {sheetItemId !== undefined && (
        <VariableItemSheet
          open
          onOpenChange={(open) => {
            if (!open) setSheetItemId(undefined);
          }}
          collectionId={collectionId}
          itemId={sheetItemId}
          folders={folders}
          modes={modes}
        />
      )}

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              autoFocus
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Brand Colors"
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleCreateFolder();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary" size="sm"
                onClick={() => setFolderDialogOpen(false)}
              >Cancel</Button>
              <Button size="sm" onClick={() => void handleCreateFolder()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameFolder} onOpenChange={(open) => { if (!open) setRenameFolder(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              autoFocus
              value={renameFolderValue}
              onChange={(event) => setRenameFolderValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleRenameFolder();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary" size="sm"
                onClick={() => setRenameFolder(null)}
              >Cancel</Button>
              <Button size="sm" onClick={() => void handleRenameFolder()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteIds}
        onOpenChange={(open) => { if (!open) setDeleteIds(null); }}
        title={`Delete ${deleteIds?.length || 0} item${deleteIds?.length === 1 ? '' : 's'}?`}
        description="Layers bound to these variables will keep their fallback value."
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
