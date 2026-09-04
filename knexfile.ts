import type { Knex } from 'knex';
import path from 'path';
import { credentials } from './lib/credentials.ts';
import { parseSupabaseConfig } from './lib/supabase-config-parser.ts';
import type { SupabaseConfig } from './types/index.ts';
import { isCloudflareRuntime } from './lib/platform/runtime.ts';

/**
 * Knex Configuration for Avi Builder Supabase Migrations
 *
 * This configuration is used to run migrations programmatically
 * against the user's Supabase PostgreSQL database.
 */

/**
 * Load Supabase credentials from centralized storage
 * Uses environment variables on Vercel, file-based storage locally
 */
async function getSupabaseConnectionParams() {
  if (isCloudflareRuntime()) {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const hyperdrive = getCloudflareContext().env.HYPERDRIVE as { connectionString?: string } | undefined;

    if (hyperdrive?.connectionString) {
      return { connectionString: hyperdrive.connectionString };
    }

    if (process.env.REQUIRE_HYPERDRIVE === 'true') {
      throw new Error('Cloudflare Hyperdrive is required but the HYPERDRIVE binding is missing.');
    }
  }

  const config = await credentials.get<SupabaseConfig>('supabase_config');

  if (!config?.connectionUrl || !config?.dbPassword) {
    throw new Error('Supabase not configured. Please run setup first.');
  }

  const connectionParams = parseSupabaseConfig(config);
  const isSelfHosted = !!config.supabaseUrl;

  return {
    host: connectionParams.dbHost,
    port: connectionParams.dbPort,
    database: connectionParams.dbName,
    user: connectionParams.dbUser,
    password: connectionParams.dbPassword,
    ssl: isSelfHosted ? false : { rejectUnauthorized: false },
  };
}

const createConfig = (): Knex.Config => {
  const isConstrainedRuntime = process.env.VERCEL === '1' || isCloudflareRuntime();

  return {
    client: 'pg',
    connection: async () => {
      const connectionParams = await getSupabaseConnectionParams();

      return connectionParams;
    },
    migrations: {
      directory: path.join(process.cwd(), 'database/migrations'),
      extension: 'ts',
      tableName: 'migrations',
    },
    pool: isConstrainedRuntime ? {
      min: 0,
      max: 1,
      acquireTimeoutMillis: 10000,
      createTimeoutMillis: 10000,
      idleTimeoutMillis: 1000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    } : {
      min: 0,
      max: 3,
      idleTimeoutMillis: 30000,
    },
  };
};

const config: { [key: string]: Knex.Config } = {
  development: createConfig(),
  production: createConfig(),
};

export default config;
