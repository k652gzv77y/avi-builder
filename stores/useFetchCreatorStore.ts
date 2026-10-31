'use client';

import { create } from 'zustand';

interface FetchCreatorState {
  open: boolean;
  onCreated: ((fetchId: string) => void) | null;
  request: (onCreated: (fetchId: string) => void) => void;
  close: () => void;
}

export const useFetchCreatorStore = create<FetchCreatorState>((set) => ({
  open: false,
  onCreated: null,
  request: (onCreated) => set({ open: true, onCreated }),
  close: () => set({ open: false, onCreated: null }),
}));
