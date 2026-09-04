'use client';

/**
 * Variable item sheet
 *
 * Collection-item style details panel for a global variable. Clicking a row
 * in Colors / Site / Assets opens this sheet with name, folder, and a field
 * per mode (Light / Dark / …).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetActions,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useGlobalsStore } from '@/stores/useGlobalsStore';
import { useColorVariablesStore } from '@/stores/useColorVariablesStore';
import { useAssetsStore } from '@/stores/useAssetsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { ASSET_CATEGORIES, getOptimizedImageUrl, isAssetOfType } from '@/lib/asset-utils';
import { FIELD_TYPES } from '@/lib/collection-field-utils';
import ColorFieldInput from './ColorFieldInput';
import type { GlobalVariable, GlobalVariableType } from '@/types';
import {
  COLOR_MODE_VALUES_SETTING_KEY,
  DEFAULT_MODE_ID,
  SITE_VARIABLE_TYPE_VALUES,
  VARIABLE_COLLECTIONS,
  joinVariablePath,
  parseVariablePath,
  slugifyVariableName,
  type ColorModeValuesSetting,
  type VariableCollectionId,
  type VariableMode,
} from '@/lib/variable-collections';

const NONE_FOLDER = '__none__';

interface VariableItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: VariableCollectionId;
  itemId: string | null;
  folders: string[];
  modes: VariableMode[];
}

function typeLabel(type: string): string {
  return FIELD_TYPES.find((item) => item.value === type)?.label ?? type;
}

function ImageValueField({
  assetId,
  onPick,
}: {
  assetId: string;
  onPick: () => void;
}) {
  const getAsset = useAssetsStore((state) => state.getAsset);
  const asset = assetId ? getAsset(assetId) : null;
  const isSvg = !!asset?.content || !!(asset?.mime_type && isAssetOfType(asset.mime_type, ASSET_CATEGORIES.ICONS));
  const imageUrl = asset?.public_url ?? null;

  return (
    <button
      type="button"
      onClick={onPick}
      className="flex items-center gap-3 w-full text-left h-12 px-3 rounded-lg border bg-secondary/30 hover:bg-secondary/50"
    >
      <div className="relative size-8 rounded-[6px] overflow-hidden bg-secondary/40 shrink-0">
        {asset && (isSvg || imageUrl) && <div className="absolute inset-0 opacity-10 bg-checkerboard" />}
        {isSvg && asset?.content ? (
          <div
            className="relative w-full h-full flex items-center justify-center p-0.5 text-foreground"
            dangerouslySetInnerHTML={{ __html: asset.content }}
          />
        ) : imageUrl ? (
          <img
            src={getOptimizedImageUrl(imageUrl)} alt=""
            className="relative w-full h-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon name="image" className="size-3 text-muted-foreground" />
          </div>
        )}
      </div>
      <span className="truncate text-sm">{asset?.filename || 'Choose file'}</span>
    </button>
  );
}

export default function VariableItemSheet({
  open,
  onOpenChange,
  collectionId,
  itemId,
  folders,
  modes,
}: VariableItemSheetProps) {
  const { globals, createGlobal, updateGlobal, deleteGlobal } = useGlobalsStore();
  const {
    colorVariables,
    createColorVariable,
    updateColorVariable,
    deleteColorVariable,
  } = useColorVariablesStore();
  const openFileManager = useEditorStore((state) => state.openFileManager);
  const getSettingByKey = useSettingsStore((state) => state.getSettingByKey);
  const saveSettings = useSettingsStore((state) => state.saveSettings);

  const collectionMeta = VARIABLE_COLLECTIONS.find((collection) => collection.id === collectionId)!;
  const isColorCollection = collectionId === 'colors';
  const isAssetCollection = collectionId === 'assets';
  const defaultType: GlobalVariableType = isAssetCollection ? 'image' : 'text';

  const color = useMemo(
    () => (itemId && isColorCollection ? colorVariables.find((row) => row.id === itemId) : undefined),
    [itemId, isColorCollection, colorVariables],
  );
  const global = useMemo(
    () => (itemId && !isColorCollection ? globals.find((row) => row.id === itemId) : undefined),
    [itemId, isColorCollection, globals],
  );

  const colorModeValues = (getSettingByKey(COLOR_MODE_VALUES_SETTING_KEY) || {}) as ColorModeValuesSetting;

  const [name, setName] = useState('');
  const [folder, setFolder] = useState<string | null>(null);
  const [type, setType] = useState<GlobalVariableType>(defaultType);
  const [modeValues, setModeValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [snapshot, setSnapshot] = useState('');

  const seedFromItem = useCallback(() => {
    if (color) {
      const path = parseVariablePath(color.name);
      const values: Record<string, string> = { [DEFAULT_MODE_ID]: color.value || '#808080' };
      for (const mode of modes) {
        if (mode.id === DEFAULT_MODE_ID) continue;
        values[mode.id] = colorModeValues[color.id]?.[mode.id] || '';
      }
      setName(path.leaf);
      setFolder(path.folder);
      setType('color');
      setModeValues(values);
      setSnapshot(JSON.stringify({ name: path.leaf, folder: path.folder, type: 'color', values }));
      return;
    }
    if (global) {
      const path = parseVariablePath(global.name);
      const values: Record<string, string> = { [DEFAULT_MODE_ID]: global.value || '' };
      for (const mode of modes) {
        if (mode.id === DEFAULT_MODE_ID) continue;
        values[mode.id] = global.data?.valuesByMode?.[mode.id] || '';
      }
      setName(path.leaf);
      setFolder(path.folder);
      setType(global.type);
      setModeValues(values);
      setSnapshot(JSON.stringify({ name: path.leaf, folder: path.folder, type: global.type, values }));
      return;
    }
    const values: Record<string, string> = {};
    for (const mode of modes) {
      values[mode.id] = isColorCollection ? '#808080' : '';
    }
    const emptyType = defaultType;
    setName('');
    setFolder(null);
    setType(emptyType);
    setModeValues(values);
    setSnapshot(JSON.stringify({ name: '', folder: null, type: emptyType, values }));
  }, [color, global, modes, colorModeValues, isColorCollection, defaultType]);

  useEffect(() => {
    if (!open) return;
    seedFromItem();
    // Seed once when the sheet opens for a given item — not on every store tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemId, collectionId]);

  const currentSnapshot = JSON.stringify({ name, folder, type, values: modeValues });
  const isDirty = currentSnapshot !== snapshot;
  const isNew = !itemId;

  const persistColorModes = async (colorId: string, values: Record<string, string>) => {
    const extra: Record<string, string> = {};
    for (const mode of modes) {
      if (mode.id === DEFAULT_MODE_ID) continue;
      if (values[mode.id]) extra[mode.id] = values[mode.id];
    }
    const next: ColorModeValuesSetting = { ...colorModeValues };
    if (Object.keys(extra).length === 0) {
      delete next[colorId];
    } else {
      next[colorId] = extra;
    }
    const ok = await saveSettings({ [COLOR_MODE_VALUES_SETTING_KEY]: next });
    if (!ok) toast.error('Could not save mode values');
  };

  const handleSave = async () => {
    const leaf = name.trim() || (isColorCollection ? 'New color' : isAssetCollection ? 'New image' : 'New variable');
    const fullName = joinVariablePath(folder, leaf);
    setIsSaving(true);
    try {
      if (isColorCollection) {
        const defaultValue = modeValues[DEFAULT_MODE_ID] || '#808080';
        if (color) {
          await updateColorVariable(color.id, { name: fullName, value: defaultValue });
          await persistColorModes(color.id, modeValues);
        } else {
          const created = await createColorVariable(fullName, defaultValue);
          if (created) await persistColorModes(created.id, modeValues);
        }
      } else {
        const extra: Record<string, string | null> = {};
        for (const mode of modes) {
          if (mode.id === DEFAULT_MODE_ID) continue;
          extra[mode.id] = modeValues[mode.id] || null;
        }
        const payload = {
          name: fullName,
          key: slugifyVariableName(fullName),
          type,
          value: modeValues[DEFAULT_MODE_ID] || (type === 'number' ? '0' : ''),
          data: {
            ...(global?.data || {}),
            valuesByMode: extra,
          },
        };
        if (global) {
          await updateGlobal(global.id, payload);
        } else {
          await createGlobal({ ...payload, order: globals.length });
        }
      }
      setSnapshot(currentSnapshot);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (color) await deleteColorVariable(color.id);
    if (global) await deleteGlobal(global.id);
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && isDirty) {
      setShowUnsavedDialog(true);
      return;
    }
    onOpenChange(next);
  };

  const pickImage = (modeId: string) => {
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
        setModeValues((current) => ({ ...current, [modeId]: asset.id }));
        return undefined;
      },
      modeValues[modeId] || null,
      [ASSET_CATEGORIES.IMAGES, ASSET_CATEGORIES.ICONS],
    );
  };

  const valueType: GlobalVariableType = isColorCollection ? 'color' : type;

  const renderModeField = (mode: VariableMode) => {
    const value = modeValues[mode.id] || '';
    if (valueType === 'color') {
      return (
        <ColorFieldInput
          value={value || '#808080'}
          onChange={(next) => setModeValues((current) => ({ ...current, [mode.id]: next }))}
        />
      );
    }
    if (valueType === 'image') {
      return <ImageValueField assetId={value} onPick={() => pickImage(mode.id)} />;
    }
    if (valueType === 'number') {
      return (
        <Input
          type="number"
          value={value}
          onChange={(event) => setModeValues((current) => ({ ...current, [mode.id]: event.target.value }))}
        />
      );
    }
    if (valueType === 'date') {
      return (
        <Input
          type="date"
          value={value.slice(0, 10)}
          onChange={(event) => setModeValues((current) => ({ ...current, [mode.id]: event.target.value }))}
        />
      );
    }
    return (
      <Input
        value={value}
        onChange={(event) => setModeValues((current) => ({ ...current, [mode.id]: event.target.value }))}
        placeholder="—"
      />
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>
              {isNew ? `Create ${collectionMeta.name} Item` : `Edit ${collectionMeta.name} Item`}
            </SheetTitle>
            <SheetActions>
              {!isNew && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="secondary">
                      <Icon name="dotsHorizontal" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem variant="destructive" onClick={() => void handleDelete()}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                size="sm" onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : isNew ? 'Create' : 'Save'}
              </Button>
            </SheetActions>
          </SheetHeader>

          <div className="flex flex-col gap-6 pt-2">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input
                autoFocus={isNew}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={isColorCollection ? 'Primary' : 'Variable name'}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Folder</Label>
              <Select
                value={folder || NONE_FOLDER}
                onValueChange={(value) => setFolder(value === NONE_FOLDER ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_FOLDER}>No folder</SelectItem>
                  {folders.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {collectionId === 'site' && (
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(value) => setType(value as GlobalVariableType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITE_VARIABLE_TYPE_VALUES.map((item) => (
                      <SelectItem key={item} value={item}>{typeLabel(item)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {modes.map((mode) => (
              <div key={mode.id} className="flex flex-col gap-2">
                <Label>{mode.name}</Label>
                {renderModeField(mode)}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to discard them?"
        confirmLabel="Discard changes"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onConfirm={() => {
          setShowUnsavedDialog(false);
          onOpenChange(false);
        }}
        saveLabel="Save changes"
        onSave={() => {
          setShowUnsavedDialog(false);
          void handleSave();
        }}
      />
    </>
  );
}
