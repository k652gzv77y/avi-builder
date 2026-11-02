import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION_ITEM_KEYWORDS } from '@/lib/link-utils';
import {
  adjacentDetailItem,
  buildDetailNavigation,
  collectionFilterCount,
  collectionQuerySummary,
  detailItemSlug,
  detailPreviewRoute,
  filterLabel,
  findDetailNavigation,
  orderDetailItems,
  paginationChoice,
  paginationLabel,
  placeDetailNavigation,
  sortLabel,
} from '@/lib/collection-query';
import type { Layer } from '@/types';

test('pagination choice follows the enabled mode', () => {
  assert.equal(paginationChoice(null), 'off');
  assert.equal(paginationChoice({ pagination: { enabled: false, mode: 'pages', items_per_page: 10 } }), 'off');
  assert.equal(paginationChoice({ pagination: { enabled: true, mode: 'pages', items_per_page: 6 } }), 'pages');
  assert.equal(paginationChoice({ pagination: { enabled: true, mode: 'load_more', items_per_page: 6 } }), 'load_more');
});

test('filter count and labels describe the Collection List query', () => {
  assert.equal(collectionFilterCount(null), 0);
  assert.equal(collectionFilterCount({
    filters: {
      groups: [{
        id: 'g',
        conditions: [
          { id: 'a', source: 'self', operator: 'is_one_of' },
          { id: 'b', source: 'self', operator: 'is_one_of' },
        ],
      }],
    },
  }), 2);
  assert.equal(filterLabel(0), 'No filter');
  assert.equal(filterLabel(1), '1 filter');
  assert.equal(filterLabel(2), '2 filters');
  assert.equal(sortLabel('manual'), 'Manual');
  assert.equal(sortLabel('field-1', 'desc', 'Date'), 'Date descending');
  assert.equal(paginationLabel('off'), 'Off');
  assert.equal(paginationLabel('pages', 12), 'Pages, 12');
  assert.equal(paginationLabel('load_more'), 'Load more, 10');
});

test('query summary names Limit, Sort, Filter, Pagination, and Empty', () => {
  const summary = collectionQuerySummary({
    limit: 8,
    sortBy: 'title',
    sortOrder: 'asc',
    sortFieldName: 'Title',
    filterCount: 1,
    pagination: 'pages',
    itemsPerPage: 8,
    hasEmpty: false,
  });
  assert.equal(summary, 'Limit 8 · Sort Title ascending · 1 filter · Pagination Pages, 8 · No empty state');
  assert.match(collectionQuerySummary({
    filterCount: 0,
    pagination: 'off',
    hasEmpty: true,
  }), /No limit · Sort None · No filter · Pagination Off · Empty designed/);
});

test('detail preview steps items in the previous / next sort', () => {
  const items = [
    { id: 'b', manualOrder: 2, values: { title: 'Bravo' } },
    { id: 'a', manualOrder: 1, values: { title: 'Alpha' } },
    { id: 'c', manualOrder: 3, values: { title: '10' } },
  ];
  const manual = orderDetailItems(items, 'manual', 'asc');
  assert.deepEqual(manual.map(item => item.id), ['a', 'b', 'c']);
  assert.equal(adjacentDetailItem(manual, 'b', 'previous')?.id, 'a');
  assert.equal(adjacentDetailItem(manual, 'b', 'next')?.id, 'c');
  assert.equal(adjacentDetailItem(manual, 'a', 'previous'), null);
  assert.equal(adjacentDetailItem(manual, null, 'next')?.id, 'a');

  const byTitle = orderDetailItems(items, 'title', 'desc');
  assert.deepEqual(byTitle.map(item => item.id), ['b', 'a', 'c']);

  const numbers = [
    { id: 'low', manualOrder: 1, values: { n: '2' } },
    { id: 'high', manualOrder: 2, values: { n: '10' } },
  ];
  assert.deepEqual(orderDetailItems(numbers, 'n', 'asc').map(item => item.id), ['low', 'high']);
  assert.deepEqual(orderDetailItems(numbers, 'n', 'desc').map(item => item.id), ['high', 'low']);
});

test('detail route keeps the :slug token until an item slug is known', () => {
  assert.equal(detailPreviewRoute('/blog/:slug', null), '/blog/:slug');
  assert.equal(detailPreviewRoute('/blog/:slug', 'hello-world'), '/blog/hello-world');
  assert.equal(detailPreviewRoute('/:id', ''), '/:id');
  assert.equal(detailItemSlug({ slug: 'hello' }, 'slug'), 'hello');
  assert.equal(detailItemSlug({ slug: '  ' }, 'slug'), null);
});

test('previous and next controls link to the detail page keywords', () => {
  const previous = buildDetailNavigation('page-1', 'previous');
  const next = buildDetailNavigation('page-1', 'next');
  assert.equal(previous.customName, 'Previous');
  assert.equal(previous.variables?.link?.page?.id, 'page-1');
  assert.equal(previous.variables?.link?.page?.collection_item_id, COLLECTION_ITEM_KEYWORDS.PREVIOUS_ITEM);
  assert.equal(next.variables?.link?.page?.collection_item_id, COLLECTION_ITEM_KEYWORDS.NEXT_ITEM);
  assert.equal(previous.attributes?.['data-detail-nav'], 'previous');

  const body: Layer = { id: 'body', name: 'body', classes: '', children: [] };
  const placed = placeDetailNavigation([body], previous);
  assert.equal(placed[0].children?.[0].id, previous.id);
  assert.equal(findDetailNavigation(placed, 'previous')?.customName, 'Previous');
  const withNext = placeDetailNavigation(placed, next);
  assert.equal(findDetailNavigation(withNext, 'next')?.customName, 'Next');
});
