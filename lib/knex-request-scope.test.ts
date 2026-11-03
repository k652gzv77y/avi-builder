import assert from 'node:assert/strict';
import test from 'node:test';
import { AsyncLocalStorage } from 'node:async_hooks';

import { readRequestValue, writeRequestValue } from '@/lib/knex-request-scope';

const requests = new AsyncLocalStorage<object>();

test('concurrent requests keep separate knex slots', async () => {
  async function remember(id: number): Promise<number | null> {
    const request = { id };
    return requests.run(request, async () => {
      writeRequestValue(request, 'knex', { id });
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
      return readRequestValue<{ id: number }>(request, 'knex')?.id ?? null;
    });
  }

  const [first, second] = await Promise.all([remember(1), remember(2)]);
  assert.equal(first, 1);
  assert.equal(second, 2);
});

test('clearing one request does not drop the other', async () => {
  const first = { id: 'a' };
  const second = { id: 'b' };
  writeRequestValue(first, 'knex', { name: 'a' });
  writeRequestValue(second, 'knex', { name: 'b' });
  writeRequestValue(first, 'knex', null);

  assert.equal(readRequestValue(first, 'knex'), null);
  assert.deepEqual(readRequestValue<{ name: string }>(second, 'knex'), { name: 'b' });
});
