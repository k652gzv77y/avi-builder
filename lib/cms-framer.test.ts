import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FetchSpec, Layer } from '@/types';
import {
  applyCmsRuntime,
  applyDataBindings,
  buildCollectionEmptyState,
  detailRouteToken,
  encodeCmsBindingId,
  fetchDisplayText,
  findCollectionEmptyState,
  insertSiblingAfter,
  parseCmsBindingId,
  presentFetchText,
  readContentBinding,
  fetchBindingDoc,
} from '@/lib/cms-framer';
import type { FetchRuntime } from '@/lib/cms-framer';

function spec(partial: Partial<FetchSpec> = {}): FetchSpec {
  return {
    id: 'fetch-1',
    name: 'Title',
    collection_id: 'col',
    field_id: 'field',
    field_type: 'text',
    item_source: 'first',
    preview: 'default',
    loading_text: 'Loading',
    error_text: 'Unable to load',
    ...partial,
  };
}

function runtime(partial: Partial<FetchRuntime> = {}): FetchRuntime {
  return {
    specs: [spec()],
    values: { 'fetch-1': 'Hello' },
    status: { 'fetch-1': 'ready' },
    ...partial,
  };
}

test('detail routes use a :slug token', () => {
  assert.equal(detailRouteToken('slug'), ':slug');
  assert.equal(detailRouteToken(undefined), ':slug');
  assert.equal(detailRouteToken('id'), ':id');
});

test('CMS binding ids round-trip source, layer, and field', () => {
  const id = encodeCmsBindingId('page', 'field-1');
  assert.deepEqual(parseCmsBindingId(id), { source: 'page', layerId: undefined, fieldId: 'field-1' });
  const nested = encodeCmsBindingId('collection', 'field-2', 'lyr-1');
  assert.deepEqual(parseCmsBindingId(nested), { source: 'collection', layerId: 'lyr-1', fieldId: 'field-2' });
});

test('Fetch shows Loading and Error in the editor and the value when published', () => {
  const loading = spec({ preview: 'loading' });
  assert.equal(fetchDisplayText(loading, runtime({ specs: [loading] }), true), 'Loading');
  const error = spec({ preview: 'error' });
  assert.equal(fetchDisplayText(error, runtime({ specs: [error] }), true), 'Unable to load');
  assert.equal(fetchDisplayText(error, runtime({ specs: [error] }), false), 'Hello');
  assert.equal(fetchDisplayText(spec(), runtime({ status: { 'fetch-1': 'error' }, values: {} }), false), 'Unable to load');
});

test('Fetch text binding resolves for display and stays readable as a binding', () => {
  const doc = fetchBindingDoc(spec());
  const variable = { type: 'dynamic_rich_text' as const, data: { content: doc } };
  const shown = presentFetchText(variable, runtime(), true);
  const text = (shown as { data: { content: { content: Array<{ content: Array<{ text?: string }> }> } } }).data.content.content[0].content[0].text;
  assert.equal(text, 'Hello');
  assert.equal(readContentBinding(variable)?.kind, 'fetch');
  assert.equal(readContentBinding(variable)?.name, 'Title');
});

test('CMS stack binding writes the field value onto gap', () => {
  const layer: Layer = {
    id: 'stack',
    name: 'div',
    classes: 'flex flex-col',
    design: { layout: { isActive: true, display: 'flex', flexDirection: 'column', gap: '8' } },
    dataBindings: { gap: { kind: 'cms', field_id: 'gap-field', source: 'collection' } },
  };
  const applied = applyDataBindings(layer, { collectionItemData: { 'gap-field': '24' } });
  assert.match(String(applied.classes), /gap-\[24px\]/);
});

test('Collection List empty state is a sibling shown when the list has no items', () => {
  const empty = buildCollectionEmptyState('list-1');
  assert.equal(empty.settings?.collectionEmptyFor, 'list-1');
  assert.equal(empty.attributes?.['data-collection-empty-state'], 'list-1');
  assert.equal(empty.variables?.conditionalVisibility?.groups[0].conditions[0].operator, 'has_no_items');
  assert.equal(empty.customName, 'Empty');

  const list: Layer = { id: 'list-1', name: 'div', classes: '' };
  const layers = insertSiblingAfter([list], 'list-1', empty);
  assert.ok(layers);
  assert.equal(layers?.[1].id, empty.id);
  assert.equal(findCollectionEmptyState(layers ?? [], 'list-1')?.customName, 'Empty');
});

test('published runtime substitutes Fetch text and ignores the editor preview', () => {
  const bound = spec({ preview: 'loading' });
  const layer: Layer = {
    id: 'text',
    name: 'text',
    classes: '',
    variables: {
      text: { type: 'dynamic_rich_text', data: { content: fetchBindingDoc(bound) } },
    },
  };
  const next = applyCmsRuntime([layer], runtime({ specs: [bound] }));
  const content = next[0].variables?.text;
  assert.equal(content?.type, 'dynamic_rich_text');
  const text = (content as { data: { content: { content: Array<{ content: Array<{ text?: string }> }> } } }).data.content.content[0].content[0].text;
  assert.equal(text, 'Hello');
});
