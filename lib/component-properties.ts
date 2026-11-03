/**
 * Framer-style component property controls.
 *
 * Number, boolean, enum, and color controls bind a layer to visibility, fill,
 * opacity, or text. Array and object controls group those scalars; a frame can
 * repeat its children for each array item. A slot frame shows its own children
 * as fallback until an instance replaces them. Clearing an override restores
 * the component value.
 */

import type {
  ArrayItemValue,
  ArrayPropertyValue,
  BooleanPropertyValue,
  ColorPropertyValue,
  ComponentVariable,
  ComponentVariableValue,
  ControlBindingKey,
  EnumOption,
  EnumPropertyValue,
  Layer,
  NumberPropertyValue,
  ObjectPropertyValue,
  ScalarPropertyValue,
  SlotPropertyValue,
  StructuredField,
  StructuredFieldType,
  TextPropertyValue,
  ComponentPropertyType,
} from '@/types';
import { remapInteractionTargets } from '@/lib/interactions-framer';
import { applyBreakpointDesign } from '@/lib/layout-model';
import { generateId } from '@/lib/utils';
import { EMPTY_OVERRIDES, type OverrideValueKey } from '@/lib/variable-utils';

export const CONTROL_BINDING_KEYS: readonly ControlBindingKey[] = ['visible', 'fill', 'opacity', 'text'];

export const CONTROL_BINDING_LABELS: Record<ControlBindingKey, string> = {
  visible: 'Visible',
  fill: 'Color',
  opacity: 'Opacity',
  text: 'Content',
};

const CONTROL_TYPE_FOR_BINDING: Record<ControlBindingKey, ComponentPropertyType | 'enum-or-number'> = {
  visible: 'boolean',
  fill: 'color',
  opacity: 'number',
  text: 'enum-or-number',
};

export function isNumberPropertyValue(value: unknown): value is NumberPropertyValue {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'number' && typeof record.value === 'number' && Number.isFinite(record.value);
}

export function isBooleanPropertyValue(value: unknown): value is BooleanPropertyValue {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'boolean' && typeof record.value === 'boolean';
}

export function isEnumPropertyValue(value: unknown): value is EnumPropertyValue {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'enum' && typeof record.value === 'string';
}

export function isColorPropertyValue(value: unknown): value is ColorPropertyValue {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'color' && typeof record.value === 'string';
}

export function isTextPropertyValue(value: unknown): value is TextPropertyValue {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'text' && typeof record.value === 'string';
}

export function isObjectPropertyValue(value: unknown): value is ObjectPropertyValue {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'object' && !!record.value && typeof record.value === 'object' && !Array.isArray(record.value);
}

export function isArrayPropertyValue(value: unknown): value is ArrayPropertyValue {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'array' && Array.isArray(record.items);
}

export function isSlotPropertyValue(value: unknown): value is SlotPropertyValue {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'slot' && Array.isArray(record.layers);
}

export function isScalarPropertyValue(value: unknown): value is ScalarPropertyValue {
  return isTextPropertyValue(value)
    || isNumberPropertyValue(value)
    || isBooleanPropertyValue(value)
    || isEnumPropertyValue(value)
    || isColorPropertyValue(value);
}

export function overrideCategory(variable: Pick<ComponentVariable, 'type'>): OverrideValueKey {
  if (variable.type === 'rich_text') return 'rich_text';
  if (
    variable.type === 'image'
    || variable.type === 'link'
    || variable.type === 'audio'
    || variable.type === 'video'
    || variable.type === 'icon'
    || variable.type === 'variant'
    || variable.type === 'stack'
    || variable.type === 'number'
    || variable.type === 'boolean'
    || variable.type === 'enum'
    || variable.type === 'color'
    || variable.type === 'array'
    || variable.type === 'object'
    || variable.type === 'slot'
  ) {
    return variable.type;
  }
  return 'text';
}

/** `variableId` or `variableId.fieldId` for a field inside an array or object. */
export function parseBindingId(bindingId: string): { variableId: string; fieldId?: string } {
  const dot = bindingId.indexOf('.');
  if (dot === -1) return { variableId: bindingId };
  return { variableId: bindingId.slice(0, dot), fieldId: bindingId.slice(dot + 1) };
}

export function fieldBindingId(variableId: string, fieldId: string): string {
  return `${variableId}.${fieldId}`;
}

export interface ControlBindingChoice {
  id: string;
  name: string;
}

function fieldMatchesBinding(key: ControlBindingKey, field: StructuredField): boolean {
  if (key === 'visible') return field.type === 'boolean';
  if (key === 'fill') return field.type === 'color';
  if (key === 'opacity') return field.type === 'number';
  return field.type === 'text' || field.type === 'enum' || field.type === 'number';
}

/** Top-level controls plus array/object fields a layer property can bind to. */
export function controlBindingChoices(key: ControlBindingKey, variables: ComponentVariable[]): ControlBindingChoice[] {
  const choices: ControlBindingChoice[] = [];
  for (const variable of variables) {
    const expected = CONTROL_TYPE_FOR_BINDING[key];
    const topLevel = expected === 'enum-or-number'
      ? variable.type === 'enum' || variable.type === 'number'
      : variable.type === expected;
    if (topLevel) choices.push({ id: variable.id, name: variable.name });
    if (variable.type !== 'array' && variable.type !== 'object') continue;
    for (const field of variable.fields ?? []) {
      if (!fieldMatchesBinding(key, field)) continue;
      choices.push({
        id: fieldBindingId(variable.id, field.id),
        name: `${variable.name} · ${field.name}`,
      });
    }
  }
  return choices;
}

export function controlsForBinding(key: ControlBindingKey, variables: ComponentVariable[]): ComponentVariable[] {
  const expected = CONTROL_TYPE_FOR_BINDING[key];
  return variables.filter((variable) => {
    if (expected === 'enum-or-number') return variable.type === 'enum' || variable.type === 'number';
    return variable.type === expected;
  });
}

export function clampNumber(value: number, variable: Pick<ComponentVariable, 'min' | 'max'>): number {
  let next = value;
  if (typeof variable.min === 'number') next = Math.max(variable.min, next);
  if (typeof variable.max === 'number') next = Math.min(variable.max, next);
  return next;
}

function fieldMapsEqual(
  a: Record<string, ScalarPropertyValue> | undefined,
  b: Record<string, ScalarPropertyValue> | undefined,
): boolean {
  const left = a ?? {};
  const right = b ?? {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (!propertyValuesEqual(left[key], right[key])) return false;
  }
  return true;
}

export function propertyValuesEqual(a: ComponentVariableValue | undefined, b: ComponentVariableValue | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (isNumberPropertyValue(a) && isNumberPropertyValue(b)) return a.value === b.value;
  if (isBooleanPropertyValue(a) && isBooleanPropertyValue(b)) return a.value === b.value;
  if (isEnumPropertyValue(a) && isEnumPropertyValue(b)) return a.value === b.value;
  if (isColorPropertyValue(a) && isColorPropertyValue(b)) return a.value.trim().toLowerCase() === b.value.trim().toLowerCase();
  if (isTextPropertyValue(a) && isTextPropertyValue(b)) return a.value === b.value;
  if (isObjectPropertyValue(a) && isObjectPropertyValue(b)) return fieldMapsEqual(a.value, b.value);
  if (isArrayPropertyValue(a) && isArrayPropertyValue(b)) {
    if (a.items.length !== b.items.length) return false;
    return a.items.every((item, index) => fieldMapsEqual(item.value, b.items[index]?.value));
  }
  if (isSlotPropertyValue(a) && isSlotPropertyValue(b)) {
    return JSON.stringify(a.layers) === JSON.stringify(b.layers);
  }
  return false;
}

function bucketValue(
  overrides: Layer['componentOverrides'] | undefined,
  category: OverrideValueKey,
  variableId: string,
): ComponentVariableValue | undefined {
  const bucket = overrides?.[category] as Record<string, ComponentVariableValue> | undefined;
  return bucket?.[variableId];
}

/** The instance override for this variable, when one is stored. */
export function propertyOverride(
  variable: ComponentVariable,
  overrides: Layer['componentOverrides'] | undefined,
): ComponentVariableValue | undefined {
  return bucketValue(overrides, overrideCategory(variable), variable.id);
}

export function isPropertyOverridden(
  variable: ComponentVariable,
  overrides: Layer['componentOverrides'] | undefined,
): boolean {
  return propertyOverride(variable, overrides) !== undefined;
}

/** Override when present, otherwise the control's default. */
export function readPropertyValue(
  variable: ComponentVariable,
  overrides: Layer['componentOverrides'] | undefined,
): ComponentVariableValue | undefined {
  return propertyOverride(variable, overrides) ?? variable.default_value;
}

export function clearPropertyOverride(
  overrides: Layer['componentOverrides'] | undefined,
  variable: ComponentVariable,
): NonNullable<Layer['componentOverrides']> {
  const category = overrideCategory(variable);
  const bucket = { ...(overrides?.[category] as Record<string, ComponentVariableValue> | undefined ?? {}) };
  delete bucket[variable.id];
  return {
    ...EMPTY_OVERRIDES,
    ...overrides,
    [category]: bucket,
  };
}

export function enumLabel(
  variable: Pick<ComponentVariable, 'options'>,
  value: ComponentVariableValue | undefined,
  field?: StructuredField,
): string | undefined {
  if (!isEnumPropertyValue(value)) return undefined;
  const options = field?.options ?? variable.options;
  const match = options?.find((option) => option.id === value.value);
  return match?.label ?? value.value;
}

/** Text a number, enum, or text control writes onto a bound text layer. */
export function boundTextForValue(
  variable: ComponentVariable,
  value: ComponentVariableValue | undefined,
  field?: StructuredField,
): string | undefined {
  if (isTextPropertyValue(value)) return value.value;
  if ((field?.type === 'enum' || variable.type === 'enum') && isEnumPropertyValue(value)) {
    return enumLabel(variable, value, field);
  }
  if ((field?.type === 'number' || variable.type === 'number') && isNumberPropertyValue(value)) {
    return String(value.value);
  }
  return undefined;
}

function findVariable(variables: ComponentVariable[] | undefined, variableId: string): ComponentVariable | undefined {
  return variables?.find((variable) => variable.id === variableId);
}

interface BoundResolution {
  variable: ComponentVariable;
  value: ComponentVariableValue;
  field?: StructuredField;
}

interface ItemContext {
  variableId: string;
  fields: Record<string, ScalarPropertyValue>;
}

function resolveBoundValue(
  bindingId: string,
  overrides: Layer['componentOverrides'] | undefined,
  variables: ComponentVariable[] | undefined,
  item?: ItemContext,
): BoundResolution | undefined {
  const parsed = parseBindingId(bindingId);
  const variable = findVariable(variables, parsed.variableId);
  if (!variable) return undefined;

  if (parsed.fieldId) {
    const field = variable.fields?.find((entry) => entry.id === parsed.fieldId);
    if (item && item.variableId === parsed.variableId) {
      const scalar = item.fields[parsed.fieldId];
      if (!isScalarPropertyValue(scalar)) return undefined;
      return { variable, value: scalar, field };
    }
    if (variable.type === 'array') return undefined;
    if (variable.type !== 'object') return undefined;
    const objectValue = readPropertyValue(variable, overrides);
    if (!isObjectPropertyValue(objectValue)) return undefined;
    const scalar = objectValue.value[parsed.fieldId];
    if (!isScalarPropertyValue(scalar)) return undefined;
    return { variable, value: scalar, field };
  }

  const value = readPropertyValue(variable, overrides);
  if (value === undefined) return undefined;
  return { variable, value };
}

function withDynamicStyle(layer: Layer, key: string, value: string | null): Layer {
  const styles = { ...(layer._dynamicStyles ?? {}) };
  if (value === null || value === '') delete styles[key];
  else styles[key] = value;
  return {
    ...layer,
    _dynamicStyles: Object.keys(styles).length > 0 ? styles : undefined,
  };
}

function applyVisibility(layer: Layer, visible: boolean, ephemeral: boolean): Layer {
  const hidden = !visible;
  const hiddenMatches = (layer.settings?.hidden === true) === hidden;
  const display = layer._dynamicStyles?.display;
  const inlineMatches = !ephemeral || (hidden ? display === 'none' : !display);
  if (hiddenMatches && inlineMatches) return layer;

  const next: Layer = {
    ...layer,
    settings: { ...layer.settings, hidden },
  };
  if (!ephemeral) return next;
  return withDynamicStyle(next, 'display', visible ? null : 'none');
}

function applyFill(layer: Layer, color: string, ephemeral: boolean): Layer {
  const current = layer.design?.backgrounds?.backgroundColor;
  const inline = layer._dynamicStyles?.backgroundColor;
  if (current === color && (!ephemeral || inline === color)) return layer;

  const styled = applyBreakpointDesign(
    layer,
    [{ category: 'backgrounds', property: 'backgroundColor', value: color }],
    'desktop',
  );
  const next: Layer = { ...layer, ...styled };
  if (!ephemeral) return next;
  return withDynamicStyle(next, 'backgroundColor', color);
}

function applyOpacity(layer: Layer, value: number, ephemeral: boolean): Layer {
  const clamped = Math.max(0, Math.min(100, value));
  const current = layer.design?.effects?.opacity;
  const inline = layer._dynamicStyles?.opacity;
  const inlineValue = String(clamped / 100);
  if (current === String(clamped) && (!ephemeral || inline === inlineValue)) return layer;

  const styled = applyBreakpointDesign(
    layer,
    [{ category: 'effects', property: 'opacity', value: String(clamped) }],
    'desktop',
  );
  const next: Layer = { ...layer, ...styled };
  if (!ephemeral) return next;
  return withDynamicStyle(next, 'opacity', inlineValue);
}

function applyBoundText(layer: Layer, content: string): Layer {
  const text = layer.variables?.text;
  if (text?.type === 'dynamic_text' && text.data?.content === content && !('id' in text && text.id)) {
    return layer;
  }
  return {
    ...layer,
    variables: {
      ...layer.variables,
      text: { type: 'dynamic_text', data: { content } },
    },
  };
}

export interface ApplyControlOptions {
  /**
   * When true (resolve / preview / publish), also stamp inline styles so a
   * hidden or recolored layer paints even if its utility class is missing.
   * Write-through onto saved layers leaves this off.
   */
  ephemeral?: boolean;
  /** Array item whose fields satisfy `variableId.fieldId` bindings. */
  item?: ItemContext;
}

/**
 * Apply this layer's property-control bindings.
 * Returns the same layer when nothing is bound.
 */
export function applyControlBindings(
  layer: Layer,
  overrides: Layer['componentOverrides'] | undefined,
  variables: ComponentVariable[] | undefined,
  options?: ApplyControlOptions,
): Layer {
  const bindings = layer.controlBindings;
  if (!bindings) return layer;
  const ephemeral = options?.ephemeral !== false;
  let next = layer;

  if (bindings.visible) {
    const resolved = resolveBoundValue(bindings.visible, overrides, variables, options?.item);
    if (resolved && isBooleanPropertyValue(resolved.value)) {
      next = applyVisibility(next, resolved.value.value, ephemeral);
    }
  }

  if (bindings.fill) {
    const resolved = resolveBoundValue(bindings.fill, overrides, variables, options?.item);
    if (resolved && isColorPropertyValue(resolved.value) && resolved.value.value.trim()) {
      next = applyFill(next, resolved.value.value.trim(), ephemeral);
    }
  }

  if (bindings.opacity) {
    const resolved = resolveBoundValue(bindings.opacity, overrides, variables, options?.item);
    if (resolved && isNumberPropertyValue(resolved.value)) {
      next = applyOpacity(next, clampNumber(resolved.value.value, resolved.field ?? resolved.variable), ephemeral);
    }
  }

  if (bindings.text) {
    const resolved = resolveBoundValue(bindings.text, overrides, variables, options?.item);
    if (resolved) {
      const content = boundTextForValue(resolved.variable, resolved.value, resolved.field);
      if (content !== undefined) next = applyBoundText(next, content);
    }
  }

  if (next !== layer) {
    next = { ...next, controlBindings: bindings };
  }
  return next;
}

/**
 * Push one control's value onto every layer bound to it.
 * Returns the original array when nothing matched.
 */
export function applyControlValueToBoundLayers(
  layers: Layer[],
  variableId: string,
  value: ComponentVariableValue,
  variables: ComponentVariable[],
): Layer[] {
  const variable = variables.find((item) => item.id === variableId);
  if (!variable) return layers;
  const withValue = variables.map((item) => (
    item.id === variableId ? { ...item, default_value: value } : item
  ));
  let changed = false;

  const visit = (layer: Layer): Layer => {
    const bindings = layer.controlBindings;
    const linked = !!bindings && CONTROL_BINDING_KEYS.some((key) => bindingTargetsVariable(bindings[key], variableId));
    let next = layer;
    if (linked) {
      const only: Partial<Record<ControlBindingKey, string>> = {};
      for (const key of CONTROL_BINDING_KEYS) {
        const binding = bindings?.[key];
        if (binding && bindingTargetsVariable(binding, variableId)) only[key] = binding;
      }
      const applied = applyControlBindings(
        { ...layer, controlBindings: only },
        undefined,
        withValue,
        { ephemeral: false },
      );
      next = { ...applied, controlBindings: bindings };
      if (next.classes !== layer.classes || next.design !== layer.design || next.settings !== layer.settings || next.variables !== layer.variables) {
        changed = true;
      } else {
        next = layer;
      }
    }

    if (layer.children?.length) {
      const children = layer.children.map(visit);
      if (children.some((child, index) => child !== layer.children?.[index])) {
        changed = true;
        next = { ...(next === layer ? layer : next), children };
      }
    }
    return next;
  };

  const nextLayers = layers.map(visit);
  return changed ? nextLayers : layers;
}

function bindingTargetsVariable(bindingId: string | undefined, variableId: string): boolean {
  if (!bindingId) return false;
  if (bindingId === variableId) return true;
  return parseBindingId(bindingId).variableId === variableId;
}

export function stripControlBinding(layer: Layer, variableId: string): Layer {
  let next = layer;
  let changed = false;

  if (layer.controlBindings) {
    const bindings = { ...layer.controlBindings };
    let removed = false;
    for (const key of CONTROL_BINDING_KEYS) {
      if (bindingTargetsVariable(bindings[key], variableId)) {
        delete bindings[key];
        removed = true;
      }
    }
    if (removed) {
      changed = true;
      next = {
        ...next,
        controlBindings: Object.keys(bindings).length > 0 ? bindings : undefined,
      };
    }
  }

  if (next.slotVariableId === variableId) {
    changed = true;
    const { slotVariableId: _omit, ...rest } = next;
    next = rest;
  }
  if (next.repeatVariableId === variableId) {
    changed = true;
    const { repeatVariableId: _omit, ...rest } = next;
    next = rest;
  }

  return changed ? next : layer;
}

export function bindingKeyForVariable(variable: ComponentVariable): ControlBindingKey | null {
  if (variable.type === 'boolean') return 'visible';
  if (variable.type === 'color') return 'fill';
  if (variable.type === 'number') return 'opacity';
  if (variable.type === 'enum') return 'text';
  return null;
}

export function defaultEnumOptions(): EnumOption[] {
  return [
    { id: 'option-1', label: 'Option 1' },
    { id: 'option-2', label: 'Option 2' },
  ];
}

export function defaultScalarValue(field: StructuredField): ScalarPropertyValue {
  if (field.type === 'number') return { type: 'number', value: typeof field.min === 'number' ? field.min : 0 };
  if (field.type === 'boolean') return { type: 'boolean', value: true };
  if (field.type === 'color') return { type: 'color', value: '#000000' };
  if (field.type === 'enum') return { type: 'enum', value: field.options?.[0]?.id ?? '' };
  return { type: 'text', value: '' };
}

function scalarForField(
  field: StructuredField,
  previous: ScalarPropertyValue | undefined,
): ScalarPropertyValue {
  if (!previous || previous.type !== field.type) return defaultScalarValue(field);
  if (field.type === 'enum' && isEnumPropertyValue(previous)) {
    const stillThere = field.options?.some((option) => option.id === previous.value);
    if (!stillThere) return defaultScalarValue(field);
  }
  return previous;
}

export function defaultObjectValue(fields: StructuredField[]): ObjectPropertyValue {
  const value: Record<string, ScalarPropertyValue> = {};
  for (const field of fields) value[field.id] = defaultScalarValue(field);
  return { type: 'object', value };
}

export function defaultArrayValue(fields: StructuredField[], itemId?: string): ArrayPropertyValue {
  return {
    type: 'array',
    items: [{ id: itemId ?? generateId('item'), value: defaultObjectValue(fields).value }],
  };
}

export function emptySlotValue(): SlotPropertyValue {
  return { type: 'slot', layers: [] };
}

/** Keep field values that still match the schema and fill in the rest. */
export function reconcileStructuredValue(
  type: 'object',
  fields: StructuredField[],
  previous: ComponentVariableValue | undefined,
): ObjectPropertyValue;
export function reconcileStructuredValue(
  type: 'array',
  fields: StructuredField[],
  previous: ComponentVariableValue | undefined,
): ArrayPropertyValue;
export function reconcileStructuredValue(
  type: 'array' | 'object',
  fields: StructuredField[],
  previous: ComponentVariableValue | undefined,
): ObjectPropertyValue | ArrayPropertyValue {
  if (type === 'object') {
    const current = isObjectPropertyValue(previous) ? previous.value : {};
    const value: Record<string, ScalarPropertyValue> = {};
    for (const field of fields) value[field.id] = scalarForField(field, current[field.id]);
    return { type: 'object', value };
  }
  const items = isArrayPropertyValue(previous) && previous.items.length > 0
    ? previous.items
    : [{ id: generateId('item'), value: {} }];
  return {
    type: 'array',
    items: items.map((item) => {
      const value: Record<string, ScalarPropertyValue> = {};
      for (const field of fields) value[field.id] = scalarForField(field, item.value[field.id]);
      return { id: item.id, value };
    }),
  };
}

/** Write one field into an object, or into the first array item. */
export function withFieldValue(
  variable: ComponentVariable,
  fieldId: string,
  next: ScalarPropertyValue,
): ComponentVariableValue | undefined {
  if (variable.type === 'object') {
    const current = isObjectPropertyValue(variable.default_value)
      ? variable.default_value
      : defaultObjectValue(variable.fields ?? []);
    return { type: 'object', value: { ...current.value, [fieldId]: next } };
  }
  if (variable.type === 'array') {
    const current = isArrayPropertyValue(variable.default_value)
      ? variable.default_value
      : defaultArrayValue(variable.fields ?? []);
    if (current.items.length === 0) return current;
    const [first, ...rest] = current.items;
    return {
      type: 'array',
      items: [{ ...first, value: { ...first.value, [fieldId]: next } }, ...rest],
    };
  }
  return undefined;
}

export function previewTextForBinding(variables: ComponentVariable[], bindingId: string): string | undefined {
  const parsed = parseBindingId(bindingId);
  const variable = variables.find((item) => item.id === parsed.variableId);
  if (!variable) return undefined;
  if (!parsed.fieldId) return boundTextForValue(variable, readPropertyValue(variable, undefined));
  const field = variable.fields?.find((item) => item.id === parsed.fieldId);
  if (!field) return undefined;
  if (variable.type === 'object' && isObjectPropertyValue(variable.default_value)) {
    return boundTextForValue(variable, variable.default_value.value[field.id], field);
  }
  if (variable.type === 'array' && isArrayPropertyValue(variable.default_value)) {
    const first = variable.default_value.items[0]?.value[field.id];
    return boundTextForValue(variable, first, field);
  }
  return undefined;
}

export function findSlotFallback(layers: Layer[], variableId: string): Layer[] | undefined {
  for (const layer of layers) {
    if (layer.slotVariableId === variableId) return layer.children ?? [];
    if (layer.children?.length) {
      const found = findSlotFallback(layer.children, variableId);
      if (found) return found;
    }
  }
  return undefined;
}

export function cloneLayersWithNewIds(layers: Layer[]): Layer[] {
  const visit = (layer: Layer): Layer => ({
    ...layer,
    id: generateId('lyr'),
    children: layer.children?.map(visit),
  });
  return layers.map((layer) => visit(JSON.parse(JSON.stringify(layer)) as Layer));
}

export function createSlotTextLayer(text = 'Text'): Layer {
  return {
    id: generateId('lyr'),
    name: 'text',
    classes: '',
    settings: { tag: 'p' },
    variables: { text: { type: 'dynamic_text', data: { content: text } } },
  };
}

export function createSlotFrame(): Layer {
  return {
    id: generateId('lyr'),
    name: 'div',
    classes: 'flex flex-col',
    design: { layout: { isActive: true, display: 'Flex', flexDirection: 'column' } },
    children: [],
  };
}

/** Slot override layers, when the instance replaced the fallback. */
export function slotReplacementLayers(
  layer: Layer,
  overrides: Layer['componentOverrides'] | undefined,
): Layer[] | undefined {
  if (!layer.slotVariableId) return undefined;
  const value = overrides?.slot?.[layer.slotVariableId];
  if (!isSlotPropertyValue(value)) return undefined;
  return value.layers;
}

export function scopeSlotLayers(layers: Layer[], prefix: string): Layer[] {
  const visit = (layer: Layer): Layer => ({
    ...layer,
    id: `${prefix}--${layer.id}`,
    _originalLayerId: layer._originalLayerId || layer.id,
    children: layer.children?.map(visit),
  });
  return layers.map(visit);
}

function suffixLayerTree(layer: Layer, suffix: string): Layer {
  const map = new Map<string, string>();
  const collect = (node: Layer) => {
    map.set(node.id, `${node.id}__${suffix}`);
    node.children?.forEach(collect);
  };
  collect(layer);
  const mapId = (id: string) => map.get(id) ?? id;
  const visit = (node: Layer): Layer => ({
    ...node,
    id: mapId(node.id),
    interactions: node.interactions?.map((interaction) => ({
      ...remapInteractionTargets(interaction, mapId),
      id: `${interaction.id}__${suffix}`,
    })),
    children: node.children?.map(visit),
  });
  return visit(JSON.parse(JSON.stringify(layer)) as Layer);
}

/**
 * Clone a repeater's children once per array item and bake that item's fields.
 * Returns the same layer when it is not a repeater.
 */
export function expandRepeatedLayer(
  layer: Layer,
  overrides: Layer['componentOverrides'] | undefined,
  variables: ComponentVariable[] | undefined,
): Layer {
  if (!layer.repeatVariableId) return layer;
  const variable = variables?.find((item) => item.id === layer.repeatVariableId && item.type === 'array');
  if (!variable) return layer;
  const value = readPropertyValue(variable, overrides);
  const items: ArrayItemValue[] = isArrayPropertyValue(value) ? value.items : [];
  const template = layer.children ?? [];
  if (items.length === 0 || template.length === 0) return { ...layer, children: [] };

  const children: Layer[] = [];
  for (const item of items) {
    for (const child of template) {
      const cloned = suffixLayerTree(child, item.id);
      children.push(applyControlBindings(cloned, overrides, variables, {
        ephemeral: true,
        item: { variableId: variable.id, fields: item.value },
      }));
    }
  }
  return { ...layer, children };
}

/**
 * Replace slot fallbacks and expand array repeaters on an instance tree.
 * `resolveNested` expands component instances that were placed in a slot.
 * The component's own canvas does not call this, so authors keep editing one template.
 */
export function applyStructuredLayers(
  layers: Layer[],
  overrides: Layer['componentOverrides'] | undefined,
  variables: ComponentVariable[] | undefined,
  resolveNested: (layers: Layer[]) => Layer[],
): Layer[] {
  let changed = false;
  const next = layers.map((layer) => {
    let current = layer;
    const replacement = slotReplacementLayers(layer, overrides);
    if (replacement) {
      const scoped = scopeSlotLayers(replacement, layer.id);
      const resolved = scoped.length > 0 ? resolveNested(scoped) : [];
      const { slotVariableId: _omit, ...rest } = current;
      current = { ...rest, children: resolved };
    }
    if (current.repeatVariableId) {
      const expanded = expandRepeatedLayer(current, overrides, variables);
      const { repeatVariableId: _omit, ...rest } = expanded;
      current = rest;
    }
    if (current.children?.length) {
      const children = applyStructuredLayers(current.children, overrides, variables, resolveNested);
      if (children !== current.children) current = { ...current, children };
    }
    if (current !== layer) changed = true;
    return current;
  });
  return changed ? next : layers;
}

export function isStructuredFieldType(value: string): value is StructuredFieldType {
  return value === 'text' || value === 'number' || value === 'boolean' || value === 'enum' || value === 'color';
}
