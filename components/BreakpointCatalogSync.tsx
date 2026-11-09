'use client';

import { useMemo } from 'react';
import { resolveBreakpointCatalog, setClientBreakpointCatalog } from '@/lib/breakpoint-utils';

/** Publish the saved breakpoint catalog before canvas and animation code reads it. */
export default function BreakpointCatalogSync({ value }: { value: unknown }) {
  const catalog = useMemo(() => resolveBreakpointCatalog(value), [value]);
  setClientBreakpointCatalog(catalog);
  return null;
}
