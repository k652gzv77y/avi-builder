'use client';

import { create } from 'zustand';

/**
 * Live variant chosen by an interaction. The editor canvas reads this so
 * Set Variant and Scroll to Variant can swap a component tree without
 * writing the choice back onto the layer.
 */
interface InteractionPreviewState {
  variantByLayerId: Record<string, string>;
  setVariant: (layerId: string, variantId: string) => void;
  clearVariant: (layerId: string) => void;
  clearVariants: () => void;
}

export const useInteractionPreviewStore = create<InteractionPreviewState>((set) => ({
  variantByLayerId: {},
  setVariant: (layerId, variantId) => set(state => {
    if (state.variantByLayerId[layerId] === variantId) return state;
    return {
      variantByLayerId: { ...state.variantByLayerId, [layerId]: variantId },
    };
  }),
  clearVariant: (layerId) => set(state => {
    if (!state.variantByLayerId[layerId]) return state;
    const variantByLayerId = { ...state.variantByLayerId };
    delete variantByLayerId[layerId];
    return { variantByLayerId };
  }),
  clearVariants: () => set({ variantByLayerId: {} }),
}));
