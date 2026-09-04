import { AsyncLocalStorage } from 'async_hooks';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { credentials } from './credentials';
import { parseSupabaseConfig } from './supabase-config-parser';
import type { SupabaseConfig, SupabaseCredentials } from '@/types';
import { withLimit } from './supabase-limiter';

export const tenantStore = new AsyncLocalStorage<string>();

export function runWithTenantId<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return tenantStore.run(tenantId, fn);
}

function envAdminPair(): { url: string; key: string } | null {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (url.startsWith('http') && key) return { url, key };
  return null;
}

async function getSupabaseCredentials(): Promise<SupabaseCredentials | null> {
  const config = await credentials.get<SupabaseConfig>('supabase_config');

  if (!config) {
    return null;
  }

  try {
    return parseSupabaseConfig(config);
  } catch (error) {
    console.error('[getSupabaseCredentials] Failed to parse config:', error);
    return null;
  }
}

export const getSupabaseConfig = getSupabaseCredentials;

const globalForSupabase = globalThis as unknown as {
  __supabaseClient?: SupabaseClient;
  __supabaseCredKey?: string;
};

export async function getSupabaseAdmin(_tenantId?: string): Promise<SupabaseClient | null> {
  const envPair = envAdminPair();
  const creds = envPair ? null : await getSupabaseCredentials();

  const projectUrl = envPair?.url || creds?.projectUrl;
  const serviceRoleKey = envPair?.key || creds?.serviceRoleKey;

  if (!projectUrl || !serviceRoleKey) {
    console.error('[getSupabaseAdmin] No credentials returned!');
    return null;
  }

  const credKey = `${projectUrl}:${serviceRoleKey}`;
  if (globalForSupabase.__supabaseClient && globalForSupabase.__supabaseCredKey === credKey) {
    return globalForSupabase.__supabaseClient;
  }

  const limitedFetch: typeof globalThis.fetch = (input, init) =>
    withLimit(() => globalThis.fetch(input, init));

  globalForSupabase.__supabaseClient = createClient(projectUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: { fetch: limitedFetch },
  });

  globalForSupabase.__supabaseCredKey = credKey;

  return globalForSupabase.__supabaseClient;
}

export async function testSupabaseConnection(
  config: SupabaseConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = parseSupabaseConfig(config);

    const client = createClient(parsed.projectUrl, parsed.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error } = await client.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    if (error) {
      console.error('[testSupabaseConnection] Failed:', { url: parsed.projectUrl, error: error.message, status: error.status });
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[testSupabaseConnection] Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

export async function getTenantIdFromHeaders(): Promise<string | null> {
  return null;
}

export async function executeSql(sql: string): Promise<{ success: boolean; error?: string }> {
  const client = await getSupabaseAdmin();

  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { error } = await client.rpc('exec_sql', { sql });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SQL execution failed',
    };
  }
}
