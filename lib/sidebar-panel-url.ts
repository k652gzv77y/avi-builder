/**
 * Remember the Assets panel in the query string.
 * Pages and Layers already have their own routes; Assets stays on the design
 * canvas and only needs a flag so a refresh reopens the same panel.
 */

const ASSETS_PANEL_PARAM = 'panel';
const ASSETS_PANEL_VALUE = 'assets';

export function hasAssetsPanelQuery(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(ASSETS_PANEL_PARAM) === ASSETS_PANEL_VALUE;
}

export function syncAssetsPanelQuery(tab: string): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const current = params.get(ASSETS_PANEL_PARAM);

  if (tab === ASSETS_PANEL_VALUE) {
    if (current === ASSETS_PANEL_VALUE) return;
    params.set(ASSETS_PANEL_PARAM, ASSETS_PANEL_VALUE);
  } else if (current === ASSETS_PANEL_VALUE) {
    params.delete(ASSETS_PANEL_PARAM);
  } else {
    return;
  }

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history.replaceState(window.history.state, '', nextUrl);
}
