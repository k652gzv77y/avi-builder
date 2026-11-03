/**
 * Empty list shared by Zustand selectors.
 *
 * `useSyncExternalStore` (Zustand 5) calls the selector twice per render and
 * compares the results with `Object.is`. `value ?? []` allocates a new array
 * on every call when the page has no fetches or the draft layers are null.
 * React then treats each read as a store update and throws error #185
 * (maximum update depth) while the design panel is drawing.
 */
const EMPTY_LIST: unknown[] = [];

export function stableList<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : (EMPTY_LIST as T[]);
}
