import assert from 'node:assert/strict';
import test from 'node:test';

import { publicLayoutAssetPath } from '@/lib/layout-asset-path';

test('project layout images map to the public file, not the editor app', () => {
  assert.equal(
    publicLayoutAssetPath('/projects/kolbo-school/layouts/assets/hero-background-1.webp'),
    '/ycode/layouts/assets/hero-background-1.webp',
  );
  assert.equal(
    publicLayoutAssetPath('/projects/other-site/layouts/assets/placeholder-2.webp'),
    '/ycode/layouts/assets/placeholder-2.webp',
  );
});

test('an editor rewrite of the same file still reaches the public asset', () => {
  assert.equal(
    publicLayoutAssetPath('/editor/layouts/assets/hero-background-1.webp'),
    '/ycode/layouts/assets/hero-background-1.webp',
  );
});

test('the public file path is left alone', () => {
  assert.equal(
    publicLayoutAssetPath('/ycode/layouts/assets/hero-background-1.webp'),
    null,
  );
});

test('editor pages and other project routes are not layout assets', () => {
  assert.equal(
    publicLayoutAssetPath('/projects/kolbo-school/layers/96cedd66-d4df-4aa8-aa80-a9b74d27c698'),
    null,
  );
  assert.equal(publicLayoutAssetPath('/projects/kolbo-school'), null);
  assert.equal(publicLayoutAssetPath('/editor/layers/96cedd66-d4df-4aa8-aa80-a9b74d27c698'), null);
});

test('layout asset paths cannot climb out of the asset directory', () => {
  assert.equal(
    publicLayoutAssetPath('/projects/kolbo-school/layouts/assets/../../secret.txt'),
    null,
  );
});
