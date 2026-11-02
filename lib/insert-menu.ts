/**
 * Searchable insert catalog for the element library.
 * Quick insert is Frame, Stack, Text, Image, and Collection List.
 * Typing filters those plus the rest of the library and components.
 */

export type InsertKind = 'element' | 'component' | 'layout';

export interface InsertEntry {
  id: string;
  label: string;
  kind: InsertKind;
  /** Element template key, component id, or layout key. */
  template: string;
  keywords: string[];
  quick: boolean;
}

export const QUICK_INSERT: readonly InsertEntry[] = [
  {
    id: 'frame',
    label: 'Frame',
    kind: 'element',
    template: 'frame',
    keywords: ['frame', 'box', 'div'],
    quick: true,
  },
  {
    id: 'stack',
    label: 'Stack',
    kind: 'element',
    template: 'stack',
    keywords: ['stack', 'flex', 'row', 'column'],
    quick: true,
  },
  {
    id: 'text',
    label: 'Text',
    kind: 'element',
    template: 'text',
    keywords: ['text', 'paragraph', 'type'],
    quick: true,
  },
  {
    id: 'image',
    label: 'Image',
    kind: 'element',
    template: 'image',
    keywords: ['image', 'picture', 'photo'],
    quick: true,
  },
  {
    id: 'collection',
    label: 'Collection List',
    kind: 'element',
    template: 'collection',
    keywords: ['collection', 'cms', 'list', 'repeat'],
    quick: true,
  },
];

const QUICK_TEMPLATES = new Set(QUICK_INSERT.map(entry => entry.template));

export function buildInsertCatalog(
  elements: Array<{ template: string; label: string }>,
  components: Array<{ id: string; name: string }>,
  layouts: string[] = [],
): InsertEntry[] {
  const rest = elements
    .filter(item => item.template && !QUICK_TEMPLATES.has(item.template))
    .map((item): InsertEntry => ({
      id: `element:${item.template}`,
      label: item.label || item.template,
      kind: 'element',
      template: item.template,
      keywords: [item.label, item.template],
      quick: false,
    }));

  const componentEntries = components.map((component): InsertEntry => ({
    id: `component:${component.id}`,
    label: component.name,
    kind: 'component',
    template: component.id,
    keywords: [component.name, 'component'],
    quick: false,
  }));

  const layoutEntries = layouts.map((key): InsertEntry => ({
    id: `layout:${key}`,
    label: key,
    kind: 'layout',
    template: key,
    keywords: [key, 'layout'],
    quick: false,
  }));

  return [...QUICK_INSERT, ...rest, ...componentEntries, ...layoutEntries];
}

/** Empty query keeps the quick row. A query searches the whole catalog. */
export function filterInsertEntries(entries: InsertEntry[], query: string): InsertEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return entries.filter(entry => entry.quick);
  return entries.filter(entry => {
    const haystack = [entry.label, entry.template, ...entry.keywords].join(' ').toLowerCase();
    return haystack.includes(normalized);
  });
}

export function nextInsertIndex(current: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  const wrapped = (current + delta) % count;
  return wrapped < 0 ? wrapped + count : wrapped;
}
