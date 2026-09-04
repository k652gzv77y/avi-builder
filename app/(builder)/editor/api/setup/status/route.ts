import { credentials } from '@/lib/credentials';
import { noCache } from '@/lib/api-response';
import { validateConnectionUrl } from '@/lib/supabase-config-parser';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isHostedRuntime } from '@/lib/platform/runtime';
import type { SupabaseConfig } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function hasAuthUsers(): Promise<boolean> {
  try {
    const client = await getSupabaseAdmin();
    if (!client) return false;
    const { data, error } = await client.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    if (error) return false;
    return (data.users?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const config = await credentials.get<SupabaseConfig>('supabase_config');
    const isVercel = process.env.VERCEL === '1';

    if (!config) {
      return noCache({
        is_configured: isHostedRuntime(),
        is_setup_complete: isHostedRuntime(),
        is_vercel: isVercel,
      });
    }

    try {
      validateConnectionUrl(config.connectionUrl, config.dbPassword, config.supabaseUrl);
    } catch (validationError) {
      return noCache({
        is_configured: isHostedRuntime(),
        is_setup_complete: isHostedRuntime(),
        is_vercel: isVercel,
        error: validationError instanceof Error ? validationError.message : 'Invalid connection URL',
      });
    }

    const setupComplete = isHostedRuntime() ? true : await hasAuthUsers();

    return noCache({
      is_configured: true,
      is_setup_complete: setupComplete,
      is_vercel: isVercel,
    });
  } catch {
    return noCache({
      is_configured: isHostedRuntime(),
      is_setup_complete: isHostedRuntime(),
      is_vercel: process.env.VERCEL === '1',
    });
  }
}
