'use client';

/**
 * Component Variables Dialog
 *
 * Dialog for managing text variables in a component
 * Used when editing components to expose text content as variables
 */

import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import RichTextEditor from './RichTextEditor';
import ExpandableRichTextEditor from './ExpandableRichTextEditor';
import ImageSettings, { type ImageSettingsValue } from './ImageSettings';
import LinkSettings, { type LinkSettingsValue } from './LinkSettings';
import AudioSettings, { type AudioSettingsValue } from './AudioSettings';
import VideoSettings, { type VideoSettingsValue } from './VideoSettings';
import IconSettings, { type IconSettingsValue } from './IconSettings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useComponentsStore } from '@/stores/useComponentsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { createTextComponentVariableValue, extractTiptapFromComponentVariable } from '@/lib/variable-utils';
import { collectVariantVariableOptions } from '@/lib/component-variant-utils';
import { isStackVariableValue } from '@/lib/component-bindings';
import { defaultArrayValue, defaultObjectValue, emptySlotValue, isEnumPropertyValue, variantPropertyDefault } from '@/lib/component-properties';
import { cn, generateId } from '@/lib/utils';
import { VARIABLE_TYPE_ICONS } from './ComponentVariableLabel';
import StackVariableControl from './StackVariableControl';
import PropertyControlInput from './PropertyControlInput';
import StructuredPropertyEditor from './structured-property-editor';
import VariantPropertyMatrix from './variant-property-matrix';
import { Separator } from '@/components/ui/separator';
import type { ComponentPropertyType, ComponentVariable, ComponentVariableValue, EnumOption, StructuredField, VariantSettingsValue } from '@/types';

function EnumOptionsEditor({
  options,
  onChange,
}: {
  options: EnumOption[];
  onChange: (options: EnumOption[]) => void;
}) {
  const [draft, setDraft] = useState(options);
  const draftRef = React.useRef(options);
  draftRef.current = draft;

  useEffect(() => {
    setDraft(options);
    draftRef.current = options;
  }, [options]);

  const updateDraft = (next: EnumOption[]) => {
    draftRef.current = next;
    setDraft(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {draft.map((option, index) => (
        <div key={option.id} className="flex items-center gap-1">
          <Input
            value={option.label}
            aria-label={`Option ${index + 1}`}
            onChange={(event) => {
              const label = event.target.value;
              updateDraft(draftRef.current.map((item) => (
                item.id === option.id ? { ...item, label } : item
              )));
            }}
            onBlur={() => onChange(draftRef.current)}
          />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-label={`Remove ${option.label || 'option'}`}
            disabled={draft.length <= 1}
            onClick={() => onChange(draft.filter((item) => item.id !== option.id))}
          >
            <Icon name="x" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => onChange([...draft, { id: generateId('opt'), label: `Option ${draft.length + 1}` }])}
      >
        <Icon name="plus" />
        Add option
      </Button>
    </div>
  );
}

/** Sortable variable item in the sidebar list. */
function SortableVariableItem({
  variable,
  isSelected,
  onSelect,
  onDelete,
}: {
  variable: ComponentVariable;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({
    id: variable.id,
    animateLayoutChanges: () => false,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  };

  const iconName = (variable.type && VARIABLE_TYPE_ICONS[variable.type]) || 'text';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <Button
        variant={isSelected ? 'secondary' : 'ghost'}
        className="w-full justify-start group"
        onClick={onSelect}
      >
        <Icon name={iconName} className="size-3 shrink-0" />
        <span className="truncate flex-1 text-left">{variable.name}</span>
        <span
          role="button"
          tabIndex={-1}
          className={cn(
            'ml-auto text-muted-foreground/50 hover:text-muted-foreground',
            isSelected ? '' : 'opacity-0 group-hover:opacity-100',
          )}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label={`Delete ${variable.name}`}
        >
          <Icon name="x" className="size-3.5" />
        </span>
      </Button>
    </div>
  );
}

interface ComponentVariablesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  componentId: string | null;
  initialVariableId?: string | null;
}

export default function ComponentVariablesDialog({
  open,
  onOpenChange,
  componentId,
  initialVariableId,
}: ComponentVariablesDialogProps) {
  const getComponentById = useComponentsStore((state) => state.getComponentById);
  const addTextVariable = useComponentsStore((state) => state.addTextVariable);
  const addRichTextVariable = useComponentsStore((state) => state.addRichTextVariable);
  const addImageVariable = useComponentsStore((state) => state.addImageVariable);
  const addLinkVariable = useComponentsStore((state) => state.addLinkVariable);
  const addAudioVariable = useComponentsStore((state) => state.addAudioVariable);
  const addVideoVariable = useComponentsStore((state) => state.addVideoVariable);
  const addIconVariable = useComponentsStore((state) => state.addIconVariable);
  const addVariantVariable = useComponentsStore((state) => state.addVariantVariable);
  const addPropertyVariable = useComponentsStore((state) => state.addPropertyVariable);
  const updateTextVariable = useComponentsStore((state) => state.updateTextVariable);
  const setVariantPropertyDefault = useComponentsStore((state) => state.setVariantPropertyDefault);
  const editingVariantId = useEditorStore((state) => state.editingComponentVariantId);
  const reorderVariables = useComponentsStore((state) => state.reorderVariables);
  const deleteTextVariable = useComponentsStore((state) => state.deleteTextVariable);
  const allComponents = useComponentsStore((state) => state.components);
  const fields = useCollectionsStore((state) => state.fields);
  const collections = useCollectionsStore((state) => state.collections);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const [selectedVariableId, setSelectedVariableId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPlaceholder, setEditingPlaceholder] = useState('');
  const [editingDefaultValue, setEditingDefaultValue] = useState<any>(null);
  const [defaultsVariantId, setDefaultsVariantId] = useState<string | null>(null);

  // Get component and its variables
  const component = componentId ? getComponentById(componentId) : undefined;
  const textVariables = component?.variables || [];

  // Get the currently selected variable
  const selectedVariable = textVariables.find((v) => v.id === selectedVariableId);
  const variants = component?.variants ?? [];
  const primaryVariantId = variants[0]?.id ?? null;
  const activeDefaultsVariantId = defaultsVariantId && variants.some((variant) => variant.id === defaultsVariantId)
    ? defaultsVariantId
    : (editingVariantId && variants.some((variant) => variant.id === editingVariantId)
      ? editingVariantId
      : primaryVariantId);
  const shownDefault = selectedVariable
    ? variantPropertyDefault(selectedVariable, component, activeDefaultsVariantId)
    : undefined;
  const showVariantMatrix = variants.length > 1 && !!selectedVariable && (
    selectedVariable.type === 'number'
    || selectedVariable.type === 'boolean'
    || selectedVariable.type === 'enum'
    || selectedVariable.type === 'color'
    || selectedVariable.type === 'stack'
  );
  const activeVariantOwnsDefault = !!selectedVariable
    && !!activeDefaultsVariantId
    && activeDefaultsVariantId !== primaryVariantId
    && variants.some((variant) => (
      variant.id === activeDefaultsVariantId
      && !!variant.propertyDefaults
      && selectedVariable.id in variant.propertyDefaults
    ));

  const commitVariableDefault = (
    variableId: string,
    variantId: string | null | undefined,
    value: ComponentVariableValue | null,
  ) => {
    if (!componentId) return;
    if (!variantId || !primaryVariantId || variantId === primaryVariantId) {
      void updateTextVariable(componentId, variableId, { default_value: value ?? undefined });
      return;
    }
    void setVariantPropertyDefault(componentId, variantId, variableId, value);
  };

  // Helper to get empty Tiptap doc
  const getEmptyTiptapDoc = () => ({ type: 'doc', content: [{ type: 'paragraph' }] });

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setDefaultsVariantId(null);
      const variantForOpen = editingVariantId && component?.variants?.some((variant) => variant.id === editingVariantId)
        ? editingVariantId
        : component?.variants?.[0]?.id;
      const target = initialVariableId
        ? textVariables.find((v) => v.id === initialVariableId)
        : null;

      if (target) {
        setSelectedVariableId(target.id);
        setEditingName(target.name);
        setEditingPlaceholder(target.placeholder || '');
        setEditingDefaultValue(extractTiptapFromComponentVariable(
          variantPropertyDefault(target, component, variantForOpen),
        ));
      } else if (textVariables.length > 0) {
        setSelectedVariableId(textVariables[0].id);
        setEditingName(textVariables[0].name);
        setEditingPlaceholder(textVariables[0].placeholder || '');
        setEditingDefaultValue(extractTiptapFromComponentVariable(
          variantPropertyDefault(textVariables[0], component, variantForOpen),
        ));
      } else {
        setSelectedVariableId(null);
        setEditingName('');
        setEditingPlaceholder('');
        setEditingDefaultValue(getEmptyTiptapDoc());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, componentId]);

  // Update editing values when selection changes
  useEffect(() => {
    if (selectedVariable) {
      setEditingName(selectedVariable.name);
      setEditingPlaceholder(selectedVariable.placeholder || '');
      setEditingDefaultValue(extractTiptapFromComponentVariable(
        variantPropertyDefault(selectedVariable, component, activeDefaultsVariantId),
      ));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariableId, activeDefaultsVariantId]);

  const handleAddTextVariable = async () => {
    if (!componentId) return;

    const newId = await addTextVariable(componentId, 'Text');
    if (newId) {
      setSelectedVariableId(newId);
      setEditingName('Text');
    }
  };

  const handleAddRichTextVariable = async () => {
    if (!componentId) return;

    const newId = await addRichTextVariable(componentId, 'Rich text');
    if (newId) {
      setSelectedVariableId(newId);
      setEditingName('Rich text');
    }
  };

  // Handle creating a new image variable
  const handleAddImageVariable = async () => {
    if (!componentId) return;

    const newId = await addImageVariable(componentId, 'Image');
    if (newId) {
      setSelectedVariableId(newId);
      setEditingName('Image');
    }
  };

  // Handle creating a new link variable
  const handleAddLinkVariable = async () => {
    if (!componentId) return;

    const newId = await addLinkVariable(componentId, 'Link');
    if (newId) {
      setSelectedVariableId(newId);
      setEditingName('Link');
    }
  };

  // Handle creating a new audio variable
  const handleAddAudioVariable = async () => {
    if (!componentId) return;

    const newId = await addAudioVariable(componentId, 'Audio');
    if (newId) {
      setSelectedVariableId(newId);
      setEditingName('Audio');
    }
  };

  // Handle creating a new video variable
  const handleAddVideoVariable = async () => {
    if (!componentId) return;

    const newId = await addVideoVariable(componentId, 'Video');
    if (newId) {
      setSelectedVariableId(newId);
      setEditingName('Video');
    }
  };

  // Handle creating a new icon variable
  const handleAddIconVariable = async () => {
    if (!componentId) return;

    const newId = await addIconVariable(componentId, 'Icon');
    if (newId) {
      setSelectedVariableId(newId);
      setEditingName('Icon');
    }
  };

  const handleAddVariantVariable = async () => {
    if (!componentId) return;

    const newId = await addVariantVariable(componentId, 'Variant');
    if (newId) {
      setSelectedVariableId(newId);
      setEditingName('Variant');
    }
  };

  const handleAddPropertyVariable = async (type: ComponentPropertyType) => {
    if (!componentId) return;
    const labels: Record<ComponentPropertyType, string> = {
      number: 'Number',
      boolean: 'Visible',
      enum: 'Option',
      color: 'Color',
    };
    const options: EnumOption[] | undefined = type === 'enum'
      ? [
        { id: generateId('opt'), label: 'Option 1' },
        { id: generateId('opt'), label: 'Option 2' },
      ]
      : undefined;
    const defaultValue: ComponentVariableValue = type === 'number'
      ? { type: 'number', value: 0 }
      : type === 'boolean'
        ? { type: 'boolean', value: true }
        : type === 'color'
          ? { type: 'color', value: '#000000' }
          : { type: 'enum', value: options?.[0]?.id ?? '' };

    const newId = await addPropertyVariable(componentId, {
      name: labels[type],
      type,
      default_value: defaultValue,
      ...(type === 'number' ? { min: undefined, step: 1 } : {}),
      ...(options ? { options } : {}),
    });
    if (!newId) return;
    const created = useComponentsStore.getState().getComponentById(componentId)?.variables?.find((variable) => variable.id === newId);
    setSelectedVariableId(newId);
    setEditingName(created?.name ?? labels[type]);
  };

  const handleAddStructuredVariable = async (type: 'array' | 'object' | 'slot') => {
    if (!componentId) return;
    const fields: StructuredField[] | undefined = type === 'slot'
      ? undefined
      : [{ id: generateId('fld'), name: 'Title', type: 'text' }];
    const defaultValue: ComponentVariableValue = type === 'slot'
      ? emptySlotValue()
      : type === 'object'
        ? defaultObjectValue(fields ?? [])
        : defaultArrayValue(fields ?? []);
    const labels = { array: 'List', object: 'Group', slot: 'Slot' };
    const newId = await addPropertyVariable(componentId, {
      name: labels[type],
      type,
      default_value: defaultValue,
      ...(fields ? { fields } : {}),
    });
    if (!newId) return;
    const created = useComponentsStore.getState().getComponentById(componentId)?.variables?.find((variable) => variable.id === newId);
    setSelectedVariableId(newId);
    setEditingName(created?.name ?? labels[type]);
  };

  const handlePropertyDefaultChange = (value: ComponentVariableValue) => {
    if (!selectedVariableId) return;
    commitVariableDefault(selectedVariableId, activeDefaultsVariantId, value);
  };

  const handleEnumOptionsChange = (options: EnumOption[]) => {
    if (!componentId || !selectedVariable) return;
    const current = isEnumPropertyValue(selectedVariable.default_value)
      ? selectedVariable.default_value.value
      : '';
    const nextDefault = options.some((option) => option.id === current)
      ? current
      : (options[0]?.id ?? '');
    void updateTextVariable(componentId, selectedVariable.id, {
      options,
      default_value: { type: 'enum', value: nextDefault },
    });
  };

  const handleVariantDefaultValueChange = (variantId: string) => {
    if (!selectedVariableId) return;
    const value: VariantSettingsValue = { variant_id: variantId };
    commitVariableDefault(selectedVariableId, activeDefaultsVariantId, value);
  };

  // Handle image default value change (via ImageSettings standalone mode)
  const handleImageDefaultValueChange = (value: ImageSettingsValue) => {
    if (!selectedVariableId) return;
    commitVariableDefault(selectedVariableId, activeDefaultsVariantId, value);
  };

  // Handle link default value change (via LinkSettings standalone mode)
  const handleLinkDefaultValueChange = (value: LinkSettingsValue | null) => {
    if (!selectedVariableId) return;
    commitVariableDefault(selectedVariableId, activeDefaultsVariantId, value);
  };

  const handleAudioDefaultValueChange = (value: AudioSettingsValue) => {
    if (!selectedVariableId) return;
    commitVariableDefault(selectedVariableId, activeDefaultsVariantId, value);
  };

  const handleVideoDefaultValueChange = (value: VideoSettingsValue) => {
    if (!selectedVariableId) return;
    commitVariableDefault(selectedVariableId, activeDefaultsVariantId, value);
  };

  const handleIconDefaultValueChange = (value: IconSettingsValue) => {
    if (!selectedVariableId) return;
    commitVariableDefault(selectedVariableId, activeDefaultsVariantId, value);
  };

  // Handle updating variable name (debounced)
  const handleNameChange = (value: string) => {
    setEditingName(value);
  };

  // Save name on blur
  const handleNameBlur = async () => {
    if (!componentId || !selectedVariableId || !editingName.trim()) return;
    if (selectedVariable && selectedVariable.name !== editingName.trim()) {
      await updateTextVariable(componentId, selectedVariableId, { name: editingName.trim() });
    }
  };

  // Save placeholder on blur
  const handlePlaceholderBlur = async () => {
    if (!componentId || !selectedVariableId) return;
    const trimmed = editingPlaceholder.trim();
    if (selectedVariable && (selectedVariable.placeholder || '') !== trimmed) {
      await updateTextVariable(componentId, selectedVariableId, { placeholder: trimmed || undefined });
    }
  };

  // Handle updating default value (local state only)
  const handleDefaultValueChange = (tiptapContent: any) => {
    setEditingDefaultValue(tiptapContent);
  };

  // Save default value on blur
  const handleDefaultValueBlur = async (tiptapContent: any) => {
    if (!componentId || !selectedVariableId) return;

    // Check if value has changed
    const currentTiptap = extractTiptapFromComponentVariable(shownDefault);

    // Simple comparison - stringify and compare
    if (JSON.stringify(currentTiptap) === JSON.stringify(tiptapContent)) {
      return; // No change, skip API call
    }

    // Wrap Tiptap content in proper ComponentVariableValue structure (text variable)
    const variableValue = createTextComponentVariableValue(tiptapContent);
    commitVariableDefault(selectedVariableId, activeDefaultsVariantId, variableValue);
  };

  // Handle deleting a variable
  const handleDeleteVariable = async (variableId: string) => {
    if (!componentId) return;
    await deleteTextVariable(componentId, variableId);

    // Select another variable or clear selection
    const remaining = textVariables.filter((v) => v.id !== variableId);
    if (remaining.length > 0) {
      setSelectedVariableId(remaining[0].id);
      setEditingName(remaining[0].name);
    } else {
      setSelectedVariableId(null);
      setEditingName('');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!componentId || !over || active.id === over.id) return;

    const ids = textVariables.map(v => v.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(ids, oldIndex, newIndex);
    reorderVariables(componentId, reordered);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-xl h-[85vh] max-h-160"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Component Variables</DialogTitle>
        <div className="flex h-full min-h-0">
          {/* Left sidebar - variable list */}
          <div className="w-60 border-r border-border flex min-h-0 flex-col px-5">
            <header className="flex shrink-0 justify-between py-5">
              <span className="font-medium">Component variables</span>
              <div className="-my-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="xs" variant="secondary">
                      <Icon name="plus" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleAddTextVariable}>
                      <Icon name="text" className="size-3" />
                      Text
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { void handleAddPropertyVariable('number'); }}>
                      <Icon name="hash" className="size-3" />
                      Number
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { void handleAddPropertyVariable('boolean'); }}>
                      <Icon name="checkbox" className="size-3" />
                      Boolean
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { void handleAddPropertyVariable('enum'); }}>
                      <Icon name="listUnordered" className="size-3" />
                      Enum
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { void handleAddPropertyVariable('color'); }}>
                      <Icon name="color" className="size-3" />
                      Color
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { void handleAddStructuredVariable('array'); }}>
                      <Icon name="listOrdered" className="size-3" />
                      Array
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { void handleAddStructuredVariable('object'); }}>
                      <Icon name="box" className="size-3" />
                      Object
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { void handleAddStructuredVariable('slot'); }}>
                      <Icon name="layers" className="size-3" />
                      Slot
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleAddRichTextVariable}>
                      <Icon name="rich-text" className="size-3" />
                      Rich text
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleAddLinkVariable}>
                      <Icon name="link" className="size-3" />
                      Link
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleAddIconVariable}>
                      <Icon name="icon" className="size-3" />
                      Icon
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleAddImageVariable}>
                      <Icon name="image" className="size-3" />
                      Image
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleAddAudioVariable}>
                      <Icon name="audio" className="size-3" />
                      Audio
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleAddVideoVariable}>
                      <Icon name="video" className="size-3" />
                      Video
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleAddVariantVariable}>
                      <Icon name={VARIABLE_TYPE_ICONS['variant']} className="size-3" />
                      Variant
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            {/* Variable list */}
            <div className="noscrollbar min-h-0 flex-1 overflow-y-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={textVariables.map(v => v.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {textVariables.map((variable) => (
                    <SortableVariableItem
                      key={variable.id}
                      variable={variable}
                      isSelected={selectedVariableId === variable.id}
                      onSelect={() => setSelectedVariableId(variable.id)}
                      onDelete={() => handleDeleteVariable(variable.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {textVariables.length === 0 && (
                <p className="py-2 text-xs text-muted-foreground">
                  No variables yet. Click + to add one.
                </p>
              )}
            </div>
          </div>

          {/* Right panel - variable editor */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-6 pt-14">
            {selectedVariable ? (
              <>
                <div className="grid grid-cols-3">
                  <Label variant="muted">Name</Label>
                  <div className="col-span-2 *:w-full">
                    <Input
                      type="text"
                      placeholder="Variable name"
                      value={editingName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onBlur={handleNameBlur}
                    />
                  </div>
                </div>

                {(!selectedVariable.type || selectedVariable.type === 'text' || selectedVariable.type === 'rich_text') && (
                  <div className="grid grid-cols-3">
                    <Label variant="muted">Placeholder</Label>
                    <div className="col-span-2 *:w-full">
                      <Input
                        type="text"
                        placeholder="Enter text..."
                        value={editingPlaceholder}
                        onChange={(e) => setEditingPlaceholder(e.target.value)}
                        onBlur={handlePlaceholderBlur}
                      />
                    </div>
                  </div>
                )}

                <Separator className="my-0.5" />

                {variants.length > 1 && !showVariantMatrix && activeDefaultsVariantId && (
                  <div className="grid grid-cols-3 items-center">
                    <Label variant="muted">Variant</Label>
                    <div className="col-span-2 flex items-center gap-2">
                      <Select
                        value={activeDefaultsVariantId}
                        onValueChange={setDefaultsVariantId}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {variants.map((variant) => {
                            const inherited = variant.id !== primaryVariantId
                              && !(variant.propertyDefaults && selectedVariable.id in variant.propertyDefaults);
                            return (
                              <SelectItem key={variant.id} value={variant.id}>
                                {inherited ? `${variant.name} · Inherited` : variant.name}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {activeVariantOwnsDefault && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => commitVariableDefault(selectedVariable.id, activeDefaultsVariantId, null)}
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 items-start">
                  <Label variant="muted" className="pt-2">{showVariantMatrix ? 'Defaults' : 'Default'}</Label>
                  <div className="col-span-2 *:w-full">
                    {selectedVariable.type === 'link' ? (
                      <LinkSettings
                        mode="standalone"
                        value={shownDefault as LinkSettingsValue}
                        onChange={handleLinkDefaultValueChange}
                        allFields={fields}
                        collections={collections}
                      />
                    ) : selectedVariable.type === 'image' ? (
                      <ImageSettings
                        mode="standalone"
                        value={shownDefault as ImageSettingsValue}
                        onChange={handleImageDefaultValueChange}
                        allFields={fields}
                        collections={collections}
                      />
                    ) : selectedVariable.type === 'audio' ? (
                      <AudioSettings
                        mode="standalone"
                        value={shownDefault as AudioSettingsValue}
                        onChange={handleAudioDefaultValueChange}
                        allFields={fields}
                        collections={collections}
                      />
                    ) : selectedVariable.type === 'video' ? (
                      <VideoSettings
                        mode="standalone"
                        value={shownDefault as VideoSettingsValue}
                        onChange={handleVideoDefaultValueChange}
                        allFields={fields}
                        collections={collections}
                      />
                    ) : selectedVariable.type === 'icon' ? (
                      <IconSettings
                        mode="standalone"
                        value={shownDefault as IconSettingsValue}
                        onChange={handleIconDefaultValueChange}
                      />
                    ) : selectedVariable.type === 'variant' ? (() => {
                      const options = collectVariantVariableOptions(component, allComponents, selectedVariable.id);
                      const currentDefault = (shownDefault as VariantSettingsValue | undefined)?.variant_id;
                      // Group options by component for clearer labelling when
                      // the variable is generic and links across multiple
                      // nested components.
                      const componentIds = Array.from(new Set(options.map(o => o.component_id)));
                      const showComponentName = componentIds.length > 1;

                      if (options.length === 0) {
                        return (
                          <p className="text-xs text-muted-foreground py-2">
                            Link this variable from a nested component instance to choose a default variant.
                          </p>
                        );
                      }

                      return (
                        <Select
                          value={currentDefault ?? ''}
                          onValueChange={handleVariantDefaultValueChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select default variant" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((opt) => (
                              <SelectItem key={`${opt.component_id}-${opt.variant_id}`} value={opt.variant_id}>
                                {showComponentName
                                  ? `${opt.component_name} · ${opt.variant_name}`
                                  : opt.variant_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    })() : showVariantMatrix && component ? (
                      <div className="flex flex-col gap-3">
                        {selectedVariable.type === 'enum' && (
                          <EnumOptionsEditor
                            options={selectedVariable.options ?? []}
                            onChange={handleEnumOptionsChange}
                          />
                        )}
                        <VariantPropertyMatrix
                          component={component}
                          variable={selectedVariable}
                          onCommit={(variantId, value) => commitVariableDefault(selectedVariable.id, variantId, value)}
                        />
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          Each variant inherits the primary default until you change it. Reset a row to inherit again.
                          {selectedVariable.type === 'stack' && ' Tablet and phone values stay on that variant.'}
                        </p>
                      </div>
                    ) : selectedVariable.type === 'stack' && selectedVariable.stack_key ? (
                      <StackVariableControl
                        stackKey={selectedVariable.stack_key}
                        value={isStackVariableValue(shownDefault) ? shownDefault : { value: '' }}
                        onChange={(next) => commitVariableDefault(selectedVariable.id, activeDefaultsVariantId, next)}
                      />
                    ) : selectedVariable.type === 'number' || selectedVariable.type === 'boolean' || selectedVariable.type === 'enum' || selectedVariable.type === 'color' ? (
                      <div className="flex flex-col gap-3">
                        {selectedVariable.type === 'enum' && (
                          <EnumOptionsEditor
                            options={selectedVariable.options ?? []}
                            onChange={handleEnumOptionsChange}
                          />
                        )}
                        <PropertyControlInput
                          variable={selectedVariable}
                          value={shownDefault}
                          onChange={handlePropertyDefaultChange}
                        />
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          {selectedVariable.type === 'boolean' && 'Bind from Visible while editing the component.'}
                          {selectedVariable.type === 'color' && 'Bind from Fill while editing the component.'}
                          {selectedVariable.type === 'number' && 'Bind from Opacity, or from Content to show the number as text.'}
                          {selectedVariable.type === 'enum' && 'Bind from Content to show the selected option as text.'}
                        </p>
                      </div>
                    ) : selectedVariable.type === 'array' || selectedVariable.type === 'object' ? (
                      <div className="flex flex-col gap-3">
                        <StructuredPropertyEditor
                          variable={selectedVariable}
                          value={shownDefault}
                          editableSchema
                          onValueChange={handlePropertyDefaultChange}
                          onFieldsChange={(fields, next) => {
                            if (!componentId) return;
                            if (!activeDefaultsVariantId || activeDefaultsVariantId === primaryVariantId) {
                              void updateTextVariable(componentId, selectedVariable.id, {
                                fields,
                                default_value: next,
                              });
                              return;
                            }
                            void updateTextVariable(componentId, selectedVariable.id, { fields });
                            commitVariableDefault(selectedVariable.id, activeDefaultsVariantId, next);
                          }}
                        />
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          {selectedVariable.type === 'array'
                            ? 'Bind a frame to Repeat. Bind text, fill, opacity, or visibility inside it to these fields.'
                            : 'Bind text, fill, opacity, or visibility to a field in this group.'}
                        </p>
                      </div>
                    ) : selectedVariable.type === 'slot' ? (
                      <p className="text-xs text-muted-foreground py-2">
                        Link this slot from a frame in Layout. Layers inside that frame are the fallback. Instances can replace them.
                      </p>
                    ) : selectedVariable.type === 'rich_text' ? (
                      <ExpandableRichTextEditor
                        value={editingDefaultValue}
                        onChange={handleDefaultValueChange}
                        onBlur={handleDefaultValueBlur}
                        placeholder="Default value..."
                        sheetDescription={`${selectedVariable.name} default value`}
                        allFields={fields}
                        collections={collections}
                      />
                    ) : (
                      <RichTextEditor
                        value={editingDefaultValue}
                        onChange={handleDefaultValueChange}
                        onBlur={handleDefaultValueBlur}
                        placeholder="Default value..."
                        allFields={fields}
                        collections={collections}
                        withFormatting
                        showFormattingToolbar={false}
                      />
                    )}
                  </div>
                </div>

              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Select a variable or create a new one
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
