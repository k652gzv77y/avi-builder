'use client';

import { create } from 'zustand';

import type { ActionTransition } from '@/types';

/**
 * Live variant chosen by an interaction. The editor canvas reads the variant
 * so Set Variant can swap a component tree without writing the choice back
 * onto the layer. Playback is only for preview and published pages: the
 * canvas keeps the swap immediate so selection is left alone.
 */
export interface VariantPlayback {
  token: number;
  transition: ActionTransition;
}

interface InteractionPreviewState {
  variantByLayerId: Record<string, string>;
  playbackByLayerId: Record<string, VariantPlayback>;
  setVariant: (layerId: string, variantId: string, playback?: VariantPlayback) => void;
  clearVariant: (layerId: string, playback?: VariantPlayback) => void;
  clearVariants: () => void;
}

export const useInteractionPreviewStore = create<InteractionPreviewState>((set) => ({
  variantByLayerId: {},
  playbackByLayerId: {},
  setVariant: (layerId, variantId, playback) => set(state => {
    const sameVariant = state.variantByLayerId[layerId] === variantId;
    const samePlayback = playback
      ? state.playbackByLayerId[layerId]?.token === playback.token
      : true;
    if (sameVariant && samePlayback) return state;
    return {
      variantByLayerId: sameVariant
        ? state.variantByLayerId
        : { ...state.variantByLayerId, [layerId]: variantId },
      playbackByLayerId: playback
        ? { ...state.playbackByLayerId, [layerId]: playback }
        : state.playbackByLayerId,
    };
  }),
  clearVariant: (layerId, playback) => set(state => {
    const showing = state.variantByLayerId[layerId];
    if (!showing && !playback) return state;
    const variantByLayerId = { ...state.variantByLayerId };
    delete variantByLayerId[layerId];
    return {
      variantByLayerId,
      playbackByLayerId: playback
        ? { ...state.playbackByLayerId, [layerId]: playback }
        : state.playbackByLayerId,
    };
  }),
  clearVariants: () => set({ variantByLayerId: {}, playbackByLayerId: {} }),
}));
