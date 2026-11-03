import type { LayerInteraction } from '@/types';

/**
 * Which layer the Interactions tab should edit.
 *
 * An open event stays put when the selection is one of its animation targets,
 * so picking a tween target does not leave the event. Any other selection,
 * including a layer with no connection to that event, takes over the panel.
 * An empty selection clears it.
 */
export function nextInteractionOwnerId(
  selectedLayerId: string | null,
  ownerLayerId: string | null,
  openTriggerId: string | null,
  ownerInteractions: LayerInteraction[] | undefined,
): string | null {
  if (!selectedLayerId) return null;
  if (!ownerLayerId || selectedLayerId === ownerLayerId || !openTriggerId) {
    return selectedLayerId;
  }

  const open = ownerInteractions?.find(interaction => interaction.id === openTriggerId);
  const isTweenTarget = (open?.tweens ?? []).some(tween => tween.layer_id === selectedLayerId);
  return isTweenTarget ? ownerLayerId : selectedLayerId;
}
