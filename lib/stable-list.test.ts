import assert from 'node:assert/strict';
import test from 'node:test';

import { stableList } from '@/lib/stable-list';

const HOMEPAGE_ID = '96cedd66-d4df-4aa8-aa80-a9b74d27c698';

test('a missing list is the same reference on every selector read', () => {
  assert.equal(stableList(undefined), stableList(null));
  assert.equal(stableList<string>(undefined), stableList<string>(undefined));
  assert.notEqual([] as string[], [] as string[]);
});

test('homepage fetches and a null layer list do not change between snapshot reads', () => {
  const pages = [{ id: HOMEPAGE_ID, settings: {} as { fetches?: string[] } }];
  const readFetches = () => stableList(
    pages.find((page) => page.id === HOMEPAGE_ID)?.settings.fetches,
  );
  assert.equal(readFetches(), readFetches());

  const drafts: Record<string, { layers: string[] | null }> = {
    [HOMEPAGE_ID]: { layers: null },
  };
  const readLayers = () => stableList(drafts[HOMEPAGE_ID]?.layers);
  assert.equal(readLayers(), readLayers());
  assert.equal(stableList<string>(undefined), readLayers());
});

test('a stored list is returned as-is', () => {
  const fetches = ['hero'];
  assert.equal(stableList(fetches), fetches);
});
