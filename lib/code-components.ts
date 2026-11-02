/**
 * Code components and the light code-override surface.
 *
 * A code component is a reusable HTML template with property controls. It is
 * stored as a normal component whose primary layer is `codeComponent`, so
 * Assets can create, edit, and place it with the existing component APIs.
 * Canvas instances keep their own control values and do not use componentId,
 * so the visual component renderer does not expand them.
 *
 * Overrides are intentionally small. Sprint 4 Interactions already own
 * events (tap, hover, appear, scroll, load) and actions (set variant,
 * overlay, navigate, scroll to variant). Effects own opacity, shadow, and
 * blur. A code override may only add a class or a data-/aria- attribute.
 * It cannot set triggers, tweens, or effect design.
 */

import { generateId } from '@/lib/utils';
import type {
  CodeComponentSettings,
  CodeOverrideSettings,
  Component,
  Layer,
  PropertyControl,
  PropertyControlType,
} from '@/types';

export const PROPERTY_CONTROL_TYPES: readonly PropertyControlType[] = [
  'string',
  'number',
  'boolean',
  'color',
  'image',
  'enum',
  'link',
];

export const PROPERTY_CONTROL_LABELS: Record<PropertyControlType, string> = {
  string: 'Text',
  number: 'Number',
  boolean: 'Boolean',
  color: 'Color',
  image: 'Image',
  enum: 'Enum',
  link: 'Link',
};

const CONTROL_ID = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/;
const CLASS_TOKEN = /^[A-Za-z0-9_:%[\]/.%-]+$/;
const OVERRIDE_ATTRIBUTE = /^(?:data|aria)-[a-z0-9-]+$/;

export interface CodeComponentDefinition {
  source: string;
  controls: PropertyControl[];
}

export function isPropertyControlType(value: string): value is PropertyControlType {
  return (PROPERTY_CONTROL_TYPES as readonly string[]).includes(value);
}

export function controlIdFromName(name: string, taken: ReadonlySet<string>): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[0-9-]+/, '')
    || 'prop';
  const trimmed = base.slice(0, 40);
  if (!taken.has(trimmed)) return trimmed;
  let index = 2;
  while (taken.has(`${trimmed}-${index}`)) index += 1;
  return `${trimmed}-${index}`.slice(0, 41);
}

export function defaultControlValue(control: PropertyControl): string | number | boolean {
  if (control.defaultValue !== undefined) return control.defaultValue;
  if (control.type === 'boolean') return false;
  if (control.type === 'number') return control.min ?? 0;
  if (control.type === 'enum') return control.options?.[0] ?? '';
  if (control.type === 'color') return '#111111';
  return '';
}

export function validatePropertyControls(controls: PropertyControl[]): string | null {
  const seen = new Set<string>();
  for (const control of controls) {
    if (!CONTROL_ID.test(control.id)) {
      return `Control id "${control.id}" must start with a letter and use letters, numbers, _ or -.`;
    }
    if (seen.has(control.id)) return `Control id "${control.id}" is used more than once.`;
    seen.add(control.id);
    if (!control.name.trim()) return `Control "${control.id}" needs a name.`;
    if (!isPropertyControlType(control.type)) return `Control "${control.id}" has an unknown type.`;
    if (control.type === 'enum' && (!control.options || control.options.length === 0)) {
      return `Enum "${control.name}" needs at least one option.`;
    }
    if (control.type === 'number' && control.min !== undefined && control.max !== undefined && control.min > control.max) {
      return `Number "${control.name}" has a minimum above its maximum.`;
    }
  }
  return null;
}

export function primaryComponentLayers(component: Pick<Component, 'layers' | 'variants'>): Layer[] {
  if (component.layers && component.layers.length > 0) return component.layers;
  return component.variants?.[0]?.layers ?? [];
}

export function readCodeComponent(component: Pick<Component, 'layers' | 'variants'>): CodeComponentDefinition | null {
  const layer = primaryComponentLayers(component)[0];
  if (!layer || layer.name !== 'codeComponent') return null;
  const settings = layer.settings?.codeComponent;
  if (!settings?.controls) return null;
  return {
    source: settings.source || '',
    controls: settings.controls,
  };
}

export function isCodeComponent(component: Pick<Component, 'layers' | 'variants'>): boolean {
  return readCodeComponent(component) !== null;
}

export function codeComponentMasterLayers(definition: CodeComponentDefinition): Layer[] {
  const settings: CodeComponentSettings = {
    source: definition.source,
    controls: definition.controls,
  };
  return [{
    id: generateId('lyr'),
    name: 'codeComponent',
    classes: '',
    children: [],
    settings: { codeComponent: settings },
  }];
}

export function buildCodeComponentInstance(component: Pick<Component, 'id' | 'name' | 'layers' | 'variants'>): Layer {
  return {
    id: generateId('lyr'),
    name: 'codeComponent',
    customName: component.name,
    classes: '',
    children: [],
    settings: {
      codeComponent: {
        componentId: component.id,
        values: {},
      },
    },
  };
}

function coerceControlValue(
  control: PropertyControl,
  raw: string | number | boolean | undefined,
): string {
  const value = raw === undefined ? defaultControlValue(control) : raw;
  if (control.type === 'boolean') return value === true || value === 'true' ? 'true' : 'false';
  if (control.type === 'number') {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return String(defaultControlValue(control));
    const min = control.min ?? parsed;
    const max = control.max ?? parsed;
    return String(Math.min(max, Math.max(min, parsed)));
  }
  if (control.type === 'enum') {
    const text = String(value);
    if (control.options?.includes(text)) return text;
    return control.options?.[0] ?? '';
  }
  return String(value);
}

/** Instance values fall back to each control's default. */
export function resolveControlValues(
  controls: PropertyControl[],
  values: CodeComponentSettings['values'] | undefined,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const control of controls) {
    resolved[control.id] = coerceControlValue(control, values?.[control.id]);
  }
  return resolved;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Replace `{{controlId}}` tokens. Values are escaped so a control cannot
 * break out of the template. Unknown tokens are left in place.
 */
export function renderCodeTemplate(source: string, values: Record<string, string>): string {
  return source.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_-]*)\s*\}\}/g, (match, id: string) => {
    if (!(id in values)) return match;
    return escapeHtml(values[id] ?? '');
  });
}

export function markupForCodeLayer(
  layer: Layer,
  components: Array<Pick<Component, 'id' | 'layers' | 'variants'>> | undefined,
): string {
  const instance = layer.settings?.codeComponent;
  const component = components?.find((item) => item.id === instance?.componentId);
  const definition = component ? readCodeComponent(component) : null;
  const inlineControls = instance?.controls;
  const controls = definition?.controls ?? inlineControls ?? [];
  const source = definition?.source ?? instance?.source ?? '';
  if (!source) return '<div>Code component</div>';
  return renderCodeTemplate(source, resolveControlValues(controls, instance?.values));
}

export function sanitizeClassName(value: string): string {
  return value
    .split(/\s+/)
    .filter((token) => CLASS_TOKEN.test(token))
    .join(' ');
}

export function sanitizeCodeOverride(input: unknown): CodeOverrideSettings | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as CodeOverrideSettings;
  const className = typeof record.className === 'string' ? sanitizeClassName(record.className) : '';
  const attributes: Record<string, string> = {};
  if (record.attributes && typeof record.attributes === 'object') {
    for (const [key, value] of Object.entries(record.attributes)) {
      if (!OVERRIDE_ATTRIBUTE.test(key) || typeof value !== 'string') continue;
      const cleaned = value.replace(/[<>"]/g, '').slice(0, 200);
      if (cleaned) attributes[key] = cleaned;
    }
  }
  if (!className && Object.keys(attributes).length === 0) return null;
  return {
    className: className || undefined,
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
  };
}

export function mergeOverrideClass(className: string, override: unknown): string {
  const clean = sanitizeCodeOverride(override);
  if (!clean?.className) return className;
  return className ? `${className} ${clean.className}` : clean.className;
}

/** Mutates a React props bag with the sanitized override. */
export function applyCodeOverrideProps(
  props: { className?: unknown } & Record<string, unknown>,
  override: unknown,
): void {
  const clean = sanitizeCodeOverride(override);
  if (!clean) return;
  if (clean.className) {
    const current = typeof props.className === 'string' ? props.className : '';
    props.className = current ? `${current} ${clean.className}` : clean.className;
  }
  if (clean.attributes) {
    for (const [key, value] of Object.entries(clean.attributes)) {
      props[key] = value;
    }
  }
}
