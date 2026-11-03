import { noCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /ycode/api/setup/migrate
 *
 * Automatically runs pending Supabase migrations using Knex, if any
 * Then runs seed data.
 *
 * Migrations and knex are loaded inside the handler. A failure while
 * evaluating that graph must still be a JSON body — an HTML 500 shell
 * makes the editor report `Unexpected token '<'`.
 */
export async function POST() {
  try {
    const { runMigrations } = await import('@/lib/services/migrationService');
    const result = await runMigrations();

    if (!result.success) {
      console.error('[setup/migrate] Migration failed:', result.error);
      return noCache(
        {
          error: result.error || 'Migration failed',
          executed: result.executed,
          failed: result.failed,
        },
        500
      );
    }

    // Run seeds after migrations
    const { runSeeds } = await import('@/lib/services/seedService');
    const seedResult = await runSeeds();
    
    if (!seedResult.success) {
      console.warn('[setup/migrate] Some seeds failed:', seedResult.results);
    }

    return noCache({
      success: true,
      executed: result.executed,
      seeds: seedResult.results,
      message: result.executed.length > 0
        ? `Successfully executed ${result.executed.length} migration(s)`
        : 'All migrations already up to date',
    });
  } catch (error) {
    console.error('[setup/migrate] Migration error:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      500
    );
  }
}
