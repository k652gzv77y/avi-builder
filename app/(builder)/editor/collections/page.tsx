'use client';

import BuilderApp from '../components/BuilderMain';

/**
 * Base route for collections view
 * URL: /projects/:slug/collections
 *
 * This route renders the same BuilderApp component.
 * Shows all collections or empty state when no collections exist.
 */
export default function CollectionsRoute() {
  return <BuilderApp />;
}
