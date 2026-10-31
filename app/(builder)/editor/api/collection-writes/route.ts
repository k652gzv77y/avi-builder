import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase-auth';
import { planCollectionWrite } from '@/lib/collection-write';
import type { WriteField } from '@/lib/collection-write';
import { applyCollectionWrite } from '@/lib/repositories/collectionWriteRepository';
import type { CollectionField, CollectionFieldType } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /projects/:slug/api/collection-writes
 *
 * Insert or update a published collection item from a form. Uses the
 * signed-in user's Supabase client so RLS policies apply. Anonymous
 * requests are rejected.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json(
        { error: 'Sign in to save this form' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const collectionId = typeof body.collection_id === 'string' ? body.collection_id : '';
    const mode = body.mode === 'update' ? 'update' : 'insert';
    const payload = body.payload && typeof body.payload === 'object' ? body.payload as Record<string, unknown> : null;
    const matchFieldId = typeof body.match_field_id === 'string' ? body.match_field_id : undefined;

    if (!payload) {
      return NextResponse.json({ error: 'Missing form payload' }, { status: 400 });
    }

    const { data: fields, error: fieldError } = await auth.client
      .from('collection_fields')
      .select('id, key, name, fillable, is_computed, type')
      .eq('collection_id', collectionId)
      .eq('is_published', true)
      .is('deleted_at', null);

    if (fieldError) {
      return NextResponse.json({ error: fieldError.message }, { status: 403 });
    }

    const writeFields: WriteField[] = ((fields || []) as Pick<CollectionField, 'id' | 'key' | 'name' | 'fillable' | 'is_computed' | 'type'>[]).map((field) => ({
      id: field.id,
      key: field.key,
      name: field.name,
      fillable: field.fillable,
      is_computed: field.is_computed,
      type: field.type as CollectionFieldType,
    }));

    const plan = planCollectionWrite({
      collectionId,
      mode,
      payload,
      fields: writeFields,
      matchFieldId,
    });

    if (!plan.ok) {
      return NextResponse.json({ error: plan.error }, { status: 400 });
    }

    const result = await applyCollectionWrite(auth.client, plan);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      data: { item_id: result.itemId, mode: result.mode },
    });
  } catch (error) {
    console.error('Collection write failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save' },
      { status: 500 },
    );
  }
}
