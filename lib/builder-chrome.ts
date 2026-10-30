/**
 * Shared chrome measurements for the Avi Builder editor shell.
 * Overlays (insert panel, page settings, preview) must stay aligned
 * with the slim header and left tool rail.
 */
export const BUILDER_HEADER_HEIGHT_PX = 40;
export const BUILDER_RAIL_WIDTH_PX = 44;

export function builderOverlayLeft(sidebarWidth: number): number {
  return BUILDER_RAIL_WIDTH_PX + sidebarWidth;
}
