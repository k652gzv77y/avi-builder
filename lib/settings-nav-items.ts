import { getProjectSlugFromPath as slugFromPath } from '@/lib/project-url';
export interface SettingsNavItem {
  id: string;
  label: string;
  path: string;
}

export function getProjectSlugFromPath(pathname: string | null): string {
  return slugFromPath(pathname) || 'project';
}

export function getSettingsNavItems(slug = 'project'): SettingsNavItem[] {
  const root = `/projects/${slug}/settings`;
  return [
    { id: 'general', label: 'General', path: `${root}/general` },
    { id: 'domains', label: 'Domains', path: `${root}/domains` },
    { id: 'cms', label: 'CMS / Supabase', path: `${root}/cms` },
    { id: 'agent', label: 'Agent', path: `${root}/agent` },
    { id: 'users', label: 'Users', path: `${root}/users` },
    { id: 'redirects', label: 'Redirects', path: `${root}/redirects` },
    { id: 'security', label: 'Security', path: `${root}/security` },
    { id: 'email', label: 'Email', path: `${root}/email` },
    { id: 'templates', label: 'Templates', path: `${root}/templates` },
    { id: 'updates', label: 'Updates', path: `${root}/updates` },
  ];
}

export const SETTINGS_NAV_ITEMS = getSettingsNavItems();
