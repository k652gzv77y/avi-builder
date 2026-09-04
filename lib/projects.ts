/**
 * Avi control-plane projects.
 * Tables already exist on the Avi Builder Supabase project:
 * builder_projects, builder_project_members, builder_project_domains.
 *
 * Builder host: avibuilder.com
 * Published hosts: rows in builder_project_domains (e.g. kolboschool.com)
 */

export type ProjectRole = 'owner' | 'editor' | 'commenter' | 'viewer';
export type DatabaseMode = 'managed' | 'external';

export type BuilderProject = {
  id: string;
  slug: string;
  name: string;
  status: string;
  database_mode: DatabaseMode;
  supabase_project_ref: string | null;
  supabase_project_name: string | null;
  supabase_project_url: string | null;
};

export type BuilderProjectDomain = {
  id: string;
  project_id: string;
  hostname: string;
  status: string;
  is_primary: boolean;
};

export const BUILDER_HOST = 'avibuilder.com';

export function isBuilderHostname(hostname: string): boolean {
  return hostname.replace(/^www\./, '') === BUILDER_HOST;
}

export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '');
}
