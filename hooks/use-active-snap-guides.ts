'use client';

import { useSyncExternalStore } from 'react';

import { getActiveSnapGuides, subscribeActiveSnapGuides } from '@/lib/canvas-snap-session';

import type { SnapGuide } from '@/lib/canvas-freeform';

const EMPTY_GUIDES: SnapGuide[] = [];

export function useActiveSnapGuides(): SnapGuide[] {
  return useSyncExternalStore(subscribeActiveSnapGuides, getActiveSnapGuides, () => EMPTY_GUIDES);
}
