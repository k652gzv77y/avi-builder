/**
 * Collection insert/update for a signed-in visitor.
 *
 * The caller passes the session Supabase client (anon key + user JWT).
 * Writes run as that user, so collection RLS allows or rejects them.
 * Do not pass the service-role client.
 */

import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CollectionWritePlan } from '@/lib/collection-write';

export interface CollectionWriteResult {
  ok: true;
  itemId: string;
  mode: 'insert' | 'update';
}

export interface CollectionWriteRejected {
  ok: false;
  status: number;
  error: string;
}

async function upsertValues(
  client: SupabaseClient,
  itemId: string,
  values: Record<string, string>,
): Promise<string | null> {
  const fieldIds = Object.keys(values);
  if (fieldIds.length === 0) return null;

  const { data: existing, error: readError } = await client
    .from('collection_item_values')
    .select('id, field_id')
    .eq('item_id', itemId)
    .eq('is_published', true)
    .is('deleted_at', null)
    .in('field_id', fieldIds);

  if (readError) return readError.message;

  const existingId = new Map((existing || []).map((row) => [row.field_id as string, row.id as string]));
  const now = new Date().toISOString();
  const rows = fieldIds.map((fieldId) => ({
    id: existingId.get(fieldId) ?? randomUUID(),
    item_id: itemId,
    field_id: fieldId,
    value: values[fieldId],
    is_published: true,
    updated_at: now,
    created_at: now,
  }));

  const { error } = await client
    .from('collection_item_values')
    .upsert(rows, { onConflict: 'id,is_published' });

  return error ? error.message : null;
}

export async function applyCollectionWrite(
  client: SupabaseClient,
  plan: CollectionWritePlan,
): Promise<CollectionWriteResult | CollectionWriteRejected> {
  if (plan.mode === 'insert') {
    const itemId = randomUUID();
    const now = new Date().toISOString();
    const { error } = await client.from('collection_items').insert({
      id: itemId,
      collection_id: plan.collectionId,
      manual_order: 0,
      is_publishable: true,
      is_published: true,
      created_at: now,
      updated_at: now,
    });
    if (error) return { ok: false, status: 403, error: error.message };

    const valueError = await upsertValues(client, itemId, plan.values);
    if (valueError) return { ok: false, status: 403, error: valueError };
    return { ok: true, itemId, mode: 'insert' };
  }

  if (!plan.match) return { ok: false, status: 400, error: 'Update needs a match field' };

  const { data: matches, error: matchError } = await client
    .from('collection_item_values')
    .select('item_id')
    .eq('field_id', plan.match.fieldId)
    .eq('value', plan.match.value)
    .eq('is_published', true)
    .is('deleted_at', null)
    .limit(1);

  if (matchError) return { ok: false, status: 403, error: matchError.message };
  const itemId = matches?.[0]?.item_id as string | undefined;
  if (!itemId) return { ok: false, status: 404, error: 'No matching collection item' };

  const valueError = await upsertValues(client, itemId, plan.values);
  if (valueError) return { ok: false, status: 403, error: valueError };

  await client
    .from('collection_items')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('is_published', true);

  return { ok: true, itemId, mode: 'update' };
}
