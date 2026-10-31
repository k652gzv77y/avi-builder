'use client';

/**
 * Binds interaction actions for the document that owns this node.
 * The editor canvas mounts it with live={false} so scroll can change
 * variants without stealing clicks from selection.
 */

import { useEffect, useRef } from 'react';
import { bindInteractionActions } from '@/lib/interaction-runtime';
import type { Layer } from '@/types';

interface InteractionActionRuntimeProps {
  layers: Layer[];
  live: boolean;
}

export default function InteractionActionRuntime({ layers, live }: InteractionActionRuntimeProps) {
  const markerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const doc = markerRef.current?.ownerDocument;
    if (!doc) return undefined;
    return bindInteractionActions(doc, layers, { live });
  }, [layers, live]);

  return <div ref={markerRef} hidden />;
}
