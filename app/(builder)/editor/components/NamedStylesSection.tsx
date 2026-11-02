'use client';

/**
 * Color styles and text styles in the Style section.
 *
 * Presets are layer styles (not a second store). Applying one links the layer
 * so later edits update every instance. Fit and Variables stay the words the
 * rest of the inspector already uses.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ColorPicker from './ColorPicker';
import SettingsPanel from './SettingsPanel';
import { useLiveLayerStyleUpdates } from '@/hooks/use-live-layer-style-updates';
import {
  COLOR_STYLE_GROUP,
  TEXT_STYLE_GROUP,
  applyNamedColorStyle,
  applyNamedTextStyle,
  clearNamedColorStyle,
  clearNamedTextStyle,
  colorStyleClasses,
  colorStyleDesign,
  colorStyleValue,
  isColorStyle,
  isTextStyle,
  textStylePayload,
} from '@/lib/design-styles';
import { detachStyleAcrossStores, updateStyleAcrossStores } from '@/lib/layer-style-store-utils';
import { useLayerStylesStore } from '@/stores/useLayerStylesStore';
import type { ColorStyleSlot, Layer, LayerStyle } from '@/types';

interface NamedStylesSectionProps {
  layer: Layer;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

function isTextLike(layer: Layer): boolean {
  return ['text', 'heading', 'richText', 'button', 'label'].includes(layer.name);
}

function slotColor(layer: Layer, slot: ColorStyleSlot): string {
  if (slot === 'color') return layer.design?.typography?.color || '#111827';
  if (slot === 'borderColor') return layer.design?.borders?.borderColor || '#111827';
  return layer.design?.backgrounds?.backgroundColor || '#111827';
}

interface StyleSelectProps {
  label: string;
  styles: LayerStyle[];
  value: string | undefined;
  onApply: (style: LayerStyle | null) => void;
  onCreate: () => void;
  disabled?: boolean;
}

function StyleSelect({ label, styles, value, onApply, onCreate, disabled }: StyleSelectProps) {
  return (
    <div className="grid grid-cols-3 items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="col-span-2 flex gap-1">
        <Select
          value={value || 'none'}
          onValueChange={(next) => {
            if (next === 'none') {
              onApply(null);
              return;
            }
            const style = styles.find(item => item.id === next);
            if (style) onApply(style);
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 flex-1">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {styles.map(style => (
              <SelectItem key={style.id} value={style.id}>{style.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-label={`Create ${label.toLowerCase()}`}
          onClick={onCreate}
          disabled={disabled}
        >
          +
        </Button>
      </div>
    </div>
  );
}

export function AssetStyleLists({ query, readOnly = false }: { query: string; readOnly?: boolean }) {
  const styles = useLayerStylesStore((state) => state.styles);
  const updateStyle = useLayerStylesStore((state) => state.updateStyle);
  const deleteStyle = useLayerStylesStore((state) => state.deleteStyle);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const normalized = query.trim().toLowerCase();

  const groups: Array<{ title: string; items: LayerStyle[] }> = [
    { title: 'Color styles', items: styles.filter(isColorStyle) },
    { title: 'Text styles', items: styles.filter(isTextStyle) },
  ];

  const commitRename = async (style: LayerStyle) => {
    const trimmed = renameValue.trim();
    setRenamingId(null);
    if (!trimmed || trimmed === style.name) return;
    await updateStyle(style.id, { name: trimmed });
  };

  return (
    <>
      {groups.map(group => {
        const items = normalized
          ? group.items.filter(style => style.name.toLowerCase().includes(normalized))
          : group.items;
        if (normalized && items.length === 0) return null;
        return (
          <section key={group.title} className="pt-3">
            <div className="py-2 text-xs font-medium">{group.title}</div>
            {items.length === 0 && (
              <p className="px-2 pb-2 text-xs text-muted-foreground">
                Create one from the Style section.
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {items.map(style => (
                <div key={style.id} className="flex items-center gap-2 h-8 px-2 rounded-lg hover:bg-secondary/50">
                  {isColorStyle(style) && (
                    <span
                      className="size-3 rounded-full border border-border shrink-0"
                      style={{ background: colorStyleValue(style) || 'transparent' }}
                    />
                  )}
                  {renamingId === style.id ? (
                    <Input
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onBlur={() => { void commitRename(style); }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void commitRename(style);
                        if (event.key === 'Escape') setRenamingId(null);
                      }}
                      className="h-7 text-xs"
                      aria-label={`Rename ${style.name}`}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      className="flex-1 truncate text-left text-xs"
                      onDoubleClick={() => {
                        if (readOnly) return;
                        setRenamingId(style.id);
                        setRenameValue(style.name);
                      }}
                    >
                      {style.name}
                    </button>
                  )}
                  {!readOnly && renamingId !== style.id && (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => {
                        setRenamingId(style.id);
                        setRenameValue(style.name);
                      }}
                    >
                      Rename
                    </Button>
                  )}
                  {!readOnly && (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => {
                        void deleteStyle(style.id).then((result) => {
                          if (result?.success) detachStyleAcrossStores(style.id);
                        });
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

export default function NamedStylesSection({ layer, onLayerUpdate }: NamedStylesSectionProps) {
  const styles = useLayerStylesStore((state) => state.styles);
  const createStyle = useLayerStylesStore((state) => state.createStyle);
  const updateStyle = useLayerStylesStore((state) => state.updateStyle);
  const live = useLiveLayerStyleUpdates();
  const [open, setOpen] = useState(true);
  const [renameValue, setRenameValue] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const textStyles = styles.filter(isTextStyle);
  const colorStyles = styles.filter(isColorStyle);
  const showText = isTextLike(layer);
  const showFill = !['text', 'heading'].includes(layer.name);
  const linkedText = textStyles.find(style => style.id === layer.namedTextStyleId);

  const writeLayer = (next: Layer) => {
    onLayerUpdate(layer.id, {
      classes: next.classes,
      design: next.design,
      namedTextStyleId: next.namedTextStyleId,
      colorStyleIds: next.colorStyleIds,
    });
  };

  const publishStyleChange = async (
    styleId: string,
    classes: string,
    design: LayerStyle['design'],
  ) => {
    await updateStyle(styleId, { classes, design });
    updateStyleAcrossStores(styleId, classes, design);
    live?.broadcastStyleUpdate(styleId, { classes, design });
  };

  const handleCreateText = async () => {
    const payload = textStylePayload(layer.design?.typography);
    const created = await createStyle(
      'Text style',
      payload.classes,
      payload.design,
      TEXT_STYLE_GROUP,
    );
    if (!created) return;
    live?.broadcastStyleCreate(created);
    writeLayer(applyNamedTextStyle(layer, created));
    setRenamingId(created.id);
    setRenameValue(created.name);
  };

  const handleCreateColor = async (slot: ColorStyleSlot) => {
    const value = slotColor(layer, slot);
    const created = await createStyle(
      'Color',
      colorStyleClasses(value),
      colorStyleDesign(value),
      COLOR_STYLE_GROUP,
    );
    if (!created) return;
    live?.broadcastStyleCreate(created);
    writeLayer(applyNamedColorStyle(layer, created, slot));
    setRenamingId(created.id);
    setRenameValue(created.name);
  };

  const commitRename = async (style: LayerStyle) => {
    const trimmed = renameValue.trim();
    setRenamingId(null);
    if (!trimmed || trimmed === style.name) return;
    await updateStyle(style.id, { name: trimmed });
    live?.broadcastStyleUpdate(style.id, { name: trimmed });
  };

  const renderColorRow = (slot: ColorStyleSlot, label: string) => {
    const linkedId = layer.colorStyleIds?.[slot];
    const linked = colorStyles.find(style => style.id === linkedId);
    return (
      <div key={slot} className="flex flex-col gap-2">
        <div className="grid grid-cols-3 items-center gap-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <div className="col-span-2 flex items-center gap-1">
            <Select
              value={linked?.id || 'none'}
              onValueChange={(next) => {
                if (next === 'none') {
                  writeLayer(clearNamedColorStyle(layer, slot));
                  return;
                }
                const style = colorStyles.find(item => item.id === next);
                if (style) writeLayer(applyNamedColorStyle(layer, style, slot));
              }}
            >
              <SelectTrigger className="h-8 flex-1">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {colorStyles.map(style => (
                  <SelectItem key={style.id} value={style.id}>{style.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {linked && (
              <ColorPicker
                value={colorStyleValue(linked)}
                solidOnly
                swatchOnly
                onChange={(value) => {
                  void publishStyleChange(linked.id, colorStyleClasses(value), colorStyleDesign(value));
                }}
              />
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              aria-label={`Create ${label.toLowerCase()} style`}
              onClick={() => { void handleCreateColor(slot); }}
            >
              +
            </Button>
          </div>
        </div>
        {linked && renamingId === linked.id && (
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onBlur={() => { void commitRename(linked); }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void commitRename(linked);
              if (event.key === 'Escape') setRenamingId(null);
            }}
            className="h-8"
            aria-label={`Rename ${linked.name}`}
            autoFocus
          />
        )}
        {linked && renamingId !== linked.id && (
          <button
            type="button"
            className="text-[11px] text-muted-foreground text-left"
            onClick={() => {
              setRenamingId(linked.id);
              setRenameValue(linked.name);
            }}
          >
            Rename {linked.name}
          </button>
        )}
      </div>
    );
  };

  return (
    <SettingsPanel
      title="Style" isOpen={open}
      onToggle={() => setOpen(!open)}
    >
      <div className="flex flex-col gap-3">
        {showText && (
          <div className="flex flex-col gap-2">
            <StyleSelect
              label="Text"
              styles={textStyles}
              value={linkedText?.id}
              onApply={(style) => {
                writeLayer(style ? applyNamedTextStyle(layer, style) : clearNamedTextStyle(layer));
              }}
              onCreate={() => { void handleCreateText(); }}
            />
            {linkedText && (
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const payload = textStylePayload(layer.design?.typography);
                    void publishStyleChange(linkedText.id, payload.classes, payload.design);
                  }}
                >
                  Update style
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRenamingId(linkedText.id);
                    setRenameValue(linkedText.name);
                  }}
                >
                  Rename
                </Button>
              </div>
            )}
            {linkedText && renamingId === linkedText.id && (
              <Input
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={() => { void commitRename(linkedText); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void commitRename(linkedText);
                  if (event.key === 'Escape') setRenamingId(null);
                }}
                className="h-8"
                aria-label={`Rename ${linkedText.name}`}
                autoFocus
              />
            )}
          </div>
        )}
        {showText && renderColorRow('color', 'Text color')}
        {showFill && renderColorRow('backgroundColor', 'Fill')}
        {showFill && renderColorRow('borderColor', 'Border')}
      </div>
    </SettingsPanel>
  );
}
