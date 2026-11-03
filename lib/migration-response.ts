/**
 * Client-safe parser for POST /api/setup/migrate.
 *
 * The Worker sometimes answered with an HTML error page (Cloudflare 1101 or
 * the Next.js 500 shell). `response.json()` then threw
 * `Unexpected token '<'` and the editor showed that parse error instead of
 * the migration failure. This stays free of next/headers, fs, and knex so
 * the checker can import it.
 */

export interface MigrationResponseBody {
  success?: boolean;
  error?: string;
  executed?: string[];
  message?: string;
}

export interface MigrationOutcome {
  proceed: boolean;
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

export function interpretMigrationResponse(status: number, raw: string): MigrationOutcome {
  let parsed: Record<string, unknown> | null = null;
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    parsed = isRecord(value) ? value : null;
  } catch {
    parsed = null;
  }

  if (!parsed) {
    return {
      proceed: false,
      error: `Migration failed (HTTP ${status})`,
    };
  }

  const errorText = typeof parsed.error === 'string' && parsed.error.trim()
    ? parsed.error
    : null;
  const succeeded = status >= 200 && status < 300 && !errorText;

  if (succeeded) {
    return { proceed: true, error: null };
  }

  return {
    proceed: false,
    error: errorText || `Migration failed (HTTP ${status})`,
  };
}
