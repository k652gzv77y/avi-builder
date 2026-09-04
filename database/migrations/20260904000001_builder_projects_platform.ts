import type { Knex } from 'knex';

/**
 * Documents the live control-plane tables (already applied on Avi Builder Supabase).
 * Safe to run again: IF NOT EXISTS / additive columns only.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE builder_projects
      ADD COLUMN IF NOT EXISTS supabase_project_ref text,
      ADD COLUMN IF NOT EXISTS supabase_project_name text,
      ADD COLUMN IF NOT EXISTS supabase_project_url text
  `);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS builder_project_invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES builder_projects(id) ON DELETE CASCADE,
      email text NOT NULL,
      role text NOT NULL CHECK (role IN ('owner','editor','commenter','viewer')),
      invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      accepted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (project_id, email)
    )
  `);

  await knex.raw(`ALTER TABLE builder_project_invites ENABLE ROW LEVEL SECURITY`);
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS builder_project_domains_hostname_idx
      ON builder_project_domains (hostname)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS builder_project_invites');
}
