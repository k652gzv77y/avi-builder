/**
 * Framer-style component property controls.
 *
 * Number, boolean, enum, and color controls live on the component next to
 * the existing text/image/link variables. A layer binds one control to
 * visibility, fill, opacity, or text. An instance override replaces the
 * default; clearing the override restores the component value.
 */

import type {
  BooleanPropertyValue,
  ColorPropertyValue,
  ComponentVariable,
  ComponentVariableValue,
  ControlBindingKey,
  EnumOption,
  EnumPropertyValue,
  Layer,
  NumberPropertyValue,
  ComponentPropertyType,
} from '@/types';
import { applyBreakpointDesign } from '@/lib/layout-model';
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
  ) {
    return variable.type;
  }
  return 'text';
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

export function propertyValuesEqual(a: ComponentVariableValue | undefined, b: ComponentVariableValue | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (isNumberPropertyValue(a) && isNumberPropertyValue(b)) return a.value === b.value;
  if (isBooleanPropertyValue(a) && isBooleanPropertyValue(b)) return a.value === b.value;
  if (isEnumPropertyValue(a) && isEnumPropertyValue(b)) return a.value === b.value;
  if (isColorPropertyValue(a) && isColorPropertyValue(b)) return a.value.trim().toLowerCase() === b.value.trim().toLowerCase();
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

export function enumLabel(variable: ComponentVariable, value: ComponentVariableValue | undefined): string | undefined {
  if (!isEnumPropertyValue(value)) return undefined;
  const match = variable.options?.find((option) => option.id === value.value);
  return match?.label ?? value.value;
}

/** Text a number or enum control writes onto a bound text layer. */
export function boundTextForValue(variable: ComponentVariable, value: ComponentVariableValue | undefined): string | undefined {
  if (variable.type === 'enum') return enumLabel(variable, value);
  if (variable.type === 'number' && isNumberPropertyValue(value)) return String(value.value);
  return undefined;
}

function findVariable(variables: ComponentVariable[] | undefined, variableId: string): ComponentVariable | undefined {
  return variables?.find((variable) => variable.id === variableId);
}

function resolveBoundValue(
  variableId: string,
  overrides: Layer['componentOverrides'] | undefined,
  variables: ComponentVariable[] | undefined,
): { variable: ComponentVariable; value: ComponentVariableValue } | undefined {
  const variable = findVariable(variables, variableId);
  if (!variable) return undefined;
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
    const resolved = resolveBoundValue(bindings.visible, overrides, variables);
    if (resolved && isBooleanPropertyValue(resolved.value)) {
      next = applyVisibility(next, resolved.value.value, ephemeral);
    }
  }

  if (bindings.fill) {
    const resolved = resolveBoundValue(bindings.fill, overrides, variables);
    if (resolved && isColorPropertyValue(resolved.value) && resolved.value.value.trim()) {
      next = applyFill(next, resolved.value.value.trim(), ephemeral);
    }
  }

  if (bindings.opacity) {
    const resolved = resolveBoundValue(bindings.opacity, overrides, variables);
    if (resolved && isNumberPropertyValue(resolved.value)) {
      next = applyOpacity(next, clampNumber(resolved.value.value, resolved.variable), ephemeral);
    }
  }

  if (bindings.text) {
    const resolved = resolveBoundValue(bindings.text, overrides, variables);
    if (resolved) {
      const content = boundTextForValue(resolved.variable, resolved.value);
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
    const linked = !!bindings && CONTROL_BINDING_KEYS.some((key) => bindings[key] === variableId);
    let next = layer;
    if (linked) {
      const only: Partial<Record<ControlBindingKey, string>> = {};
      for (const key of CONTROL_BINDING_KEYS) {
        if (bindings?.[key] === variableId) only[key] = variableId;
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

export function stripControlBinding(layer: Layer, variableId: string): Layer {
  if (!layer.controlBindings) return layer;
  const bindings = { ...layer.controlBindings };
  let removed = false;
  for (const key of CONTROL_BINDING_KEYS) {
    if (bindings[key] === variableId) {
      delete bindings[key];
      removed = true;
    }
  }
  if (!removed) return layer;
  return {
    ...layer,
    controlBindings: Object.keys(bindings).length > 0 ? bindings : undefined,
  };
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
