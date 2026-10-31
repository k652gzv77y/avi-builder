'use client';

import { create } from 'zustand';
import type { FetchRuntime } from '@/lib/cms-framer';

interface FetchRuntimeState extends FetchRuntime {
  tick: number;
  setRuntime: (runtime: FetchRuntime) => void;
}

export const useFetchRuntimeStore = create<FetchRuntimeState>((set) => ({
  specs: [],
  values: {},
  status: {},
  tick: 0,
  setRuntime: (runtime) => set(state => ({
    ...runtime,
    tick: state.tick + 1,
  })),
}));
