import { getLayerName } from '@/lib/layer-display-utils';
import { findLayerById } from '@/lib/layer-utils';

import type { SnapLabeler } from '@/lib/canvas-freeform';
import type { Layer } from '@/types';

/** Names measured siblings with the same label the layers panel uses. */
export function snapLabelerFor(layers: Layer[]): SnapLabeler {
  return (layerId: string) => {
    if (!layerId) return undefined;
    const layer = findLayerById(layers, layerId);
    if (!layer) return undefined;
    return getLayerName(layer);
  };
}
