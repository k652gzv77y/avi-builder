import assert from 'node:assert/strict';
import test from 'node:test';

import { responseFromLayoutAsset } from '@/lib/layout-asset-response';
import type { LayoutAssetFetcher } from '@/lib/layout-asset-response';

function request(method = 'GET'): Request {
  return new Request('https://avibuilder.com/projects/kolbo-school/layouts/assets/hero-background-1.webp', {
    method,
  });
}

test('a layout file response is the ASSETS body, not a Next document', async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const fetcher: LayoutAssetFetcher = {
    fetch: async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      assert.equal(
        new URL(url).pathname,
        '/ycode/layouts/assets/hero-background-1.webp',
      );
      return new Response(bytes, {
        status: 200,
        headers: { 'content-type': 'image/webp' },
      });
    },
  };

  const response = await responseFromLayoutAsset(
    request(),
    '/ycode/layouts/assets/hero-background-1.webp',
    fetcher,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test('a missing layout file is a plain 404', async () => {
  const fetcher: LayoutAssetFetcher = {
    fetch: async () => new Response('<html id="__next_error__">', {
      status: 404,
      headers: { 'content-type': 'text/html' },
    }),
  };

  const response = await responseFromLayoutAsset(
    request(),
    '/ycode/layouts/assets/missing.webp',
    fetcher,
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(await response.text(), 'Not found');
});

test('HEAD does not return a body', async () => {
  const fetcher: LayoutAssetFetcher = {
    fetch: async (input) => {
      const method = input instanceof Request ? input.method : 'GET';
      assert.equal(method, 'HEAD');
      return new Response(new Uint8Array([9]), {
        status: 200,
        headers: { 'content-type': 'image/webp' },
      });
    },
  };

  const response = await responseFromLayoutAsset(
    request('HEAD'),
    '/ycode/layouts/previews/hero-001.webp',
    fetcher,
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
});
