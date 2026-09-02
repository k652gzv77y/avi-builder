/**
 * Settings navigation items for the settings sidebar.
 * Extracted for reuse and to allow cloud overlay to filter items.
 */

export interface SettingsNavItem {
  id: string;
  label: string;
  path: string;
}

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { id: 'general', label: 'General', path: '/projects/kolbo-school/settings/general' },
  { id: 'agent', label: 'Agent', path: '/projects/kolbo-school/settings/agent' },
  { id: 'users', label: 'Users', path: '/projects/kolbo-school/settings/users' },
  { id: 'redirects', label: 'Redirects', path: '/projects/kolbo-school/settings/redirects' },
  { id: 'security', label: 'Security', path: '/projects/kolbo-school/settings/security' },
  { id: 'email', label: 'Email', path: '/projects/kolbo-school/settings/email' },
  { id: 'templates', label: 'Templates', path: '/projects/kolbo-school/settings/templates' },
  { id: 'updates', label: 'Updates', path: '/projects/kolbo-school/settings/updates' },
];
