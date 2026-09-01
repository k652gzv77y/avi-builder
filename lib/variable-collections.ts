/**
 * Figma-style variable collections.
 *
 * Colors live in `color_variables`. Site and asset variables live in
 * `global_variables`. Extra mode columns (Light / Dark / …) are stored in
 * settings so we do not need a second variables table.
 */

export const VARIABLE_COLLECTION_IDS = ['colors', 'site', 'assets'] as const;
export type VariableCollectionId = (typeof VARIABLE_COLLECTION_IDS)[number];

export interface VariableMode {
  id: string;
  name: string;
}

export const DEFAULT_MODE_ID = 'default';
export const DEFAULT_MODE: VariableMode = { id: DEFAULT_MODE_ID, name: 'Value' };

export const VARIABLE_COLLECTIONS: {
  id: VariableCollectionId;
  name: string;
  description: string;
  icon: 'droplet' | 'globe' | 'image';
}[] = [
  { id: 'colors', name: 'Colors', description: 'Color tokens', icon: 'droplet' },
  { id: 'site', name: 'Site', description: 'Text, numbers, links', icon: 'globe' },
  { id: 'assets', name: 'Assets', description: 'Images used as variables', icon: 'image' },
];

const SITE_VARIABLE_TYPES = new Set(['text', 'number', 'date', 'color', 'link', 'rich_text']);

export function getVariableCollectionItemCount(
  id: VariableCollectionId,
  colorCount: number,
  globals: Array<{ type: string }>,
): number {
  if (id === 'colors') return colorCount;
  if (id === 'assets') return globals.filter((global) => global.type === 'image').length;
  return globals.filter((global) => SITE_VARIABLE_TYPES.has(global.type)).length;
}

export const VARIABLE_MODES_SETTING_KEY = 'variable_modes';
export const COLOR_MODE_VALUES_SETTING_KEY = 'color_variable_mode_values';

export type VariableModesSetting = Partial<Record<VariableCollectionId, VariableMode[]>>;
export type ColorModeValuesSetting = Record<string, Record<string, string>>;

export function normalizeModes(modes: VariableMode[] | undefined | null): VariableMode[] {
  if (!modes || modes.length === 0) return [{ ...DEFAULT_MODE }];
  const hasDefault = modes.some((mode) => mode.id === DEFAULT_MODE_ID);
  return hasDefault ? modes : [{ ...DEFAULT_MODE }, ...modes];
}

export function slugifyVariableName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'variable';
}
