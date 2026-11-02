import { after } from 'next/server';
import knex, { Knex } from 'knex';

import knexfileConfig from '../knexfile';
import { readRequestValue, writeRequestValue } from './knex-request-scope';
import { isCloudflareRuntime } from './platform/runtime';

/**
 * Knex Client for Avi Builder Migrations
 *
 * Creates a knex instance connected to the user's Supabase PostgreSQL database
 * Uses configuration from knexfile.ts based on NODE_ENV
 *
 * On Node (local dev and the Vercel fallback) the instance is stored on
 * globalThis so it survives Next.js HMR. Without that, each hot reload
 * re-evaluates the module, resets the module-level variable to null, and
 * creates a new pool — leaking the old pool's PostgreSQL connections until
 * the database is exhausted.
 *
 * That global pool is illegal on Cloudflare Workers. A socket opened for one
 * request cannot be used by the next one ("Cannot perform I/O on behalf of a
 * different request"). Overlapping editor requests, including the migrate
 * POST, abort the isolate with error 1101 and an HTML/plaintext 500, which
 * the editor then fails to parse as JSON. Workers get a client stored on the
 * OpenNext request context and closed when that request finishes.
 */

const KNEX_SLOT = 'knex';

const globalForKnex = globalThis as unknown as { __knexInstance?: Knex };

const retired = new WeakSet<Knex>();

function createKnexClient(): Knex {
  const environment = process.env.NODE_ENV || 'development';
  const config = knexfileConfig[environment];

  if (!config) {
    throw new Error(`No knex configuration found for environment: ${environment}`);
  }

  if (!isCloudflareRuntime()) {
    return knex(config);
  }

  // Tarn's default reaper is a timer. If it fires after this request's I/O
  // context is gone, the isolate crashes the next request. The request
  // closes the pool itself; keep the timer from running first.
  const pool = typeof config.pool === 'object' && config.pool ? config.pool : {};
  return knex({
    ...config,
    pool: {
      ...pool,
      min: 0,
      max: 1,
      idleTimeoutMillis: 60_000,
      reapIntervalMillis: 60_000,
    },
  });
}

async function cloudflareRequest(): Promise<object | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const context = getCloudflareContext();
    return context && typeof context === 'object' ? context : null;
  } catch {
    return null;
  }
}

async function destroyKnex(client: Knex | null | undefined): Promise<void> {
  if (!client || retired.has(client)) return;
  retired.add(client);
  try {
    await client.destroy();
  } catch (error) {
    console.error('[knex] Error closing connection:', error);
  }
}

function scheduleCloudflareClose(client: Knex): void {
  try {
    after(() => destroyKnex(client));
  } catch (error) {
    console.error('[knex] Could not schedule Cloudflare connection close:', error);
  }
}

/**
 * Get or create knex instance
 */
export async function getKnexClient(): Promise<Knex> {
  if (isCloudflareRuntime()) {
    const request = await cloudflareRequest();
    if (request) {
      const existing = readRequestValue<Knex>(request, KNEX_SLOT);
      if (existing) return existing;
    }

    const client = createKnexClient();
    if (request) writeRequestValue(request, KNEX_SLOT, client);
    scheduleCloudflareClose(client);
    return client;
  }

  if (globalForKnex.__knexInstance) {
    return globalForKnex.__knexInstance;
  }

  globalForKnex.__knexInstance = createKnexClient();
  return globalForKnex.__knexInstance;
}

/**
 * Close knex connection
 */
export async function closeKnexClient(): Promise<void> {
  if (isCloudflareRuntime()) {
    const request = await cloudflareRequest();
    const client = request ? readRequestValue<Knex>(request, KNEX_SLOT) : null;
    if (request) writeRequestValue(request, KNEX_SLOT, null);
    await destroyKnex(client);
    return;
  }

  const client = globalForKnex.__knexInstance;
  globalForKnex.__knexInstance = undefined;
  await destroyKnex(client);
}

/**
 * Test database connection using stored credentials
 */
export async function testKnexConnection(): Promise<boolean> {
  try {
    const client = await getKnexClient();
    await client.raw('SELECT 1');
    return true;
  } catch (error) {
    console.error('[testKnexConnection] ✗ Database connection test failed:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as { code?: string }).code,
      detail: (error as { detail?: string }).detail,
    });

    // Clean up on error
    try {
      await closeKnexClient();
    } catch (closeError) {
      console.error('[testKnexConnection] Error closing failed connection:', closeError);
    }

    return false;
  }
}

/**
 * Test database connection with Supabase credentials
 * Used during setup to validate credentials before storing them
 */
export async function testSupabaseDirectConnection(credentials: {
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  ssl?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  let testClient: Knex | null = null;

  try {

    // Create a temporary knex instance with the provided credentials
    testClient = knex({
      client: 'pg',
      connection: {
        host: credentials.dbHost,
        port: credentials.dbPort,
        database: credentials.dbName,
        user: credentials.dbUser,
        password: credentials.dbPassword,
        ssl: credentials.ssl === false ? false : { rejectUnauthorized: false },
      },
      pool: {
        min: 0,
        max: 1,
      },
    });

    // Test the connection
    await testClient.raw('SELECT 1');

    return { success: true };
  } catch (error) {
    console.error('[testSupabaseDirectConnection] ✗ Database connection test failed:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as { code?: string }).code,
      detail: (error as { detail?: string }).detail,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  } finally {
    // Always clean up the test client
    if (testClient) {
      try {
        await testClient.destroy();
      } catch (closeError) {
        console.error('[testSupabaseDirectConnection] Error closing test connection:', closeError);
      }
    }
  }
}
