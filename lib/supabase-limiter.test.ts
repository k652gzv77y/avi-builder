import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_CONCURRENT_SUPABASE,
  limiterForRequest,
  runWithLimiter,
  selectLimiterState,
  createLimiterState,
} from '@/lib/supabase-limiter';

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('each Cloudflare request gets its own supabase queue', async () => {
  const first = {};
  const second = {};
  const shared = createLimiterState();
  const a = selectLimiterState(true, first, shared);
  const b = selectLimiterState(true, second, shared);

  assert.notEqual(a, b);
  assert.notEqual(a, shared);
  assert.equal(selectLimiterState(true, first, shared), a);

  const hold = deferred();
  const inFlight: Promise<void>[] = [];
  for (let i = 0; i < MAX_CONCURRENT_SUPABASE; i++) {
    inFlight.push(runWithLimiter(a, () => hold.promise));
  }

  let queued = false;
  const waiting = runWithLimiter(a, async () => {
    queued = true;
  });
  await Promise.resolve();
  assert.equal(queued, false);

  let otherRan = false;
  await runWithLimiter(b, async () => {
    otherRan = true;
  });
  assert.equal(otherRan, true);
  assert.equal(queued, false);

  hold.resolve();
  await Promise.all([...inFlight, waiting]);
  assert.equal(queued, true);
});

test('a missing Worker request does not join the process-wide queue', async () => {
  const shared = createLimiterState();
  shared.running = MAX_CONCURRENT_SUPABASE;

  const isolated = selectLimiterState(true, null, shared);
  assert.notEqual(isolated, shared);

  let ran = false;
  await runWithLimiter(isolated, async () => {
    ran = true;
  });
  assert.equal(ran, true);
  assert.equal(shared.queue.length, 0);
});

test('Node keeps one shared supabase queue', () => {
  const shared = createLimiterState();
  assert.equal(selectLimiterState(false, {}, shared), shared);
  assert.equal(selectLimiterState(false, null, shared), shared);
});

test('limiterForRequest is stable for one request object', () => {
  const request = { id: 'editor-init' };
  assert.equal(limiterForRequest(request), limiterForRequest(request));
});
