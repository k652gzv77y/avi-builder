/**
 * Concurrency limiter for Supabase (PostgREST) queries.
 *
 * Recursive collection resolution can fire dozens of HTTP requests at once
 * and exhaust the upstream Postgres pool. The cap keeps parallelism bounded.
 *
 * On Node the cap is process-wide. On Cloudflare Workers it has to be
 * per request. A queue stored on `globalThis` is shared by every request in
 * the isolate, so request B's fetch runs on request A's I/O context. Workers
 * abort that with error 1101 (or never finish the response). The editor then
 * sits on "Loading builder data…" even though earlier auth calls returned 200.
 */

import { isCloudflareRuntime } from '@/lib/platform/runtime';
import { readRequestValue, writeRequestValue } from '@/lib/knex-request-scope';

export const MAX_CONCURRENT_SUPABASE = 10;
const REQUEST_SLOT = 'supabase-limiter';

export interface LimiterState {
  running: number;
  queue: Array<() => void>;
}

export function createLimiterState(): LimiterState {
  return { running: 0, queue: [] };
}

const processLimiter = createLimiterState();

/** One semaphore per request object. A second call returns the same state. */
export function limiterForRequest(request: object): LimiterState {
  const existing = readRequestValue<LimiterState>(request, REQUEST_SLOT);
  if (existing) return existing;
  const created = createLimiterState();
  writeRequestValue(request, REQUEST_SLOT, created);
  return created;
}

/**
 * Pick the semaphore for this call.
 * Workers must not use the process-wide queue: a missing request context gets
 * a fresh state so it cannot run another request's queued fetch.
 */
export function selectLimiterState(
  cloudflare: boolean,
  request: object | null,
  shared: LimiterState = processLimiter,
): LimiterState {
  if (!cloudflare) return shared;
  if (!request) return createLimiterState();
  return limiterForRequest(request);
}

export async function runWithLimiter<T>(
  state: LimiterState,
  fn: () => Promise<T>,
  maxConcurrent: number = MAX_CONCURRENT_SUPABASE,
): Promise<T> {
  if (state.running < maxConcurrent) {
    state.running++;
  } else {
    await new Promise<void>((resolve) => {
      state.queue.push(resolve);
    });
  }

  try {
    return await fn();
  } finally {
    state.running--;
    const next = state.queue.shift();
    if (next) {
      state.running++;
      next();
    }
  }
}

type ContextGetter = () => object | null;

let contextGetter: ContextGetter | null | undefined;

async function cloudflareRequest(): Promise<object | null> {
  if (!isCloudflareRuntime()) return null;
  if (contextGetter === undefined) {
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      contextGetter = () => {
        try {
          const context = getCloudflareContext();
          return context && typeof context === 'object' ? context : null;
        } catch {
          return null;
        }
      };
    } catch {
      contextGetter = null;
    }
  }
  return contextGetter ? contextGetter() : null;
}

async function currentLimiterState(): Promise<LimiterState> {
  if (!isCloudflareRuntime()) return processLimiter;
  const request = await cloudflareRequest();
  return selectLimiterState(true, request, processLimiter);
}

export async function withLimit<T>(fn: () => Promise<T>): Promise<T> {
  const state = await currentLimiterState();
  return runWithLimiter(state, fn);
}
