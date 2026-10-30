import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sanitizeCookieOptions } from './auth-flow';
import { credentials } from './credentials';
import { parseSupabaseConfig } from './supabase-config-parser';
import type { SupabaseConfig } from '@/types';

/**
 * Create a Supabase server client for use in Next.js route handlers.
 *
 * Reads stored credentials, parses the config, and wires up cookie
 * getAll/setAll so chunked auth cookies round-trip in route handlers.
 *
 * Returns null if Supabase is not configured (expected during setup).
 */
export async function createRouteClient() {
  const config = await credentials.get<SupabaseConfig>('supabase_config');
  if (!config) return null;

  const parsed = parseSupabaseConfig(config);
  const cookieStore = await cookies();

  return createServerClient(parsed.projectUrl, parsed.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, sanitizeCookieOptions(options, process.env.NODE_ENV === 'production'));
          } catch {
            // Server Components cannot write cookies. Route handlers can.
          }
        });
      },
    },
  });
}
