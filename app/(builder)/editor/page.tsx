/**
 * Base route for Avi Builder editor
 * URL: /projects/:slug (internal: /editor)
 *
 * The BuilderApp component is now rendered in layout.tsx to persist
 * across route changes. This prevents remounts and duplicate API calls.
 *
 * Collaboration features (RealtimeCursors, ActivityNotifications) are
 * integrated in BuilderMain.tsx.
 */
export default function BuilderEditorRoute() {
  return null;
}
