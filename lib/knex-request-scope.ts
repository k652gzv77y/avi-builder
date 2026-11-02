/**
 * Values that must not leak across concurrent Cloudflare requests.
 *
 * `AsyncLocalStorage.enterWith` is the wrong tool here. Two requests started
 * together can observe one store, so a Knex client saved that way is reused
 * on a socket that belongs to the other request. Workers then abort with
 * error 1101 and the HTTP response is no longer JSON.
 *
 * OpenNext already runs each request inside `AsyncLocalStorage.run` and
 * exposes that store from `getCloudflareContext()`. The store object is a
 * new object per request, so a WeakMap keyed by it stays inside the request
 * and disappears with it.
 */

const slots = new WeakMap<object, Map<string, unknown>>();

export function readRequestValue<T>(request: object, key: string): T | null {
  const bag = slots.get(request);
  if (!bag || !bag.has(key)) return null;
  return bag.get(key) as T;
}

export function writeRequestValue(request: object, key: string, value: unknown): void {
  if (value === null || value === undefined) {
    slots.get(request)?.delete(key);
    return;
  }

  let bag = slots.get(request);
  if (!bag) {
    bag = new Map();
    slots.set(request, bag);
  }
  bag.set(key, value);
}
