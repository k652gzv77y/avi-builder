import { isValidUUID } from '@/lib/utils';

/** PostgREST `.single()` matched zero rows. */
const POSTGREST_NO_ROWS = 'PGRST116';

/**
 * Postgres `invalid_text_representation`. Raised when a non-uuid is compared
 * to the `ai_chats.id` uuid primary key (`invalid input syntax for type uuid`).
 */
const POSTGRES_INVALID_TEXT = '22P02';

/**
 * True when an id cannot be a saved chat. Ids are minted in the browser and
 * only written on the first successful save, so a non-uuid (or any other
 * value that cannot match the primary key) is "not saved yet", not a failure.
 */
export function isAbsentAiChatId(id: string): boolean {
  return !isValidUUID(id);
}

/**
 * True when a Supabase/Postgres error means the chat row is not there.
 * `22P02` is included so a malformed id is a not-found, not a 500.
 */
export function isAbsentAiChatError(code: string | null | undefined): boolean {
  return code === POSTGREST_NO_ROWS || code === POSTGRES_INVALID_TEXT;
}

/**
 * True when GET /api/ai/chats/:id reported that no row exists. Callers should
 * keep the empty local chat instead of showing a load error.
 */
export function isUnsavedAiChatResponse(response: { status?: number }): boolean {
  return response.status === 404;
}
