import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  assert.equal(
    publicLayoutAssetPath('/projects/kolbo-school/layouts/previews/hero-001.webp'),
    '/ycode/layouts/previews/hero-001.webp',
  );
  assert.equal(
    publicLayoutAssetPath('/projects/kolbo-school/layouts/previews/features-001.webp'),
    '/ycode/layouts/previews/features-001.webp',
  );
});

test('an editor rewrite of the same file still reaches the public asset', () => {
  assert.equal(
    publicLayoutAssetPath('/editor/layouts/assets/hero-background-1.webp'),
    '/ycode/layouts/assets/hero-background-1.webp',
  );
  assert.equal(
    publicLayoutAssetPath('/editor/layouts/previews/hero-001-2.webp'),
    '/ycode/layouts/previews/hero-001-2.webp',
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
  assert.equal(
    publicLayoutAssetPath('/projects/kolbo-school/layouts/previews/../assets/hero-background-1.webp'),
    null,
  );
});

test('the image optimizer maps layout files to the same public path', () => {
  const source = fs.readFileSync(
    'node_modules/@opennextjs/cloudflare/dist/cli/templates/images.js',
    'utf8',
  );
  assert.match(source, /function publicLayoutAssetPath\(pathname\)/);
  assert.match(source, /layouts\\\/\(\?:assets\|previews\)/);
  assert.match(source, /publicLayoutAssetPath\(parseResult\.url\)/);
});
