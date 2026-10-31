/**
 * Native collection writes for forms.
 *
 * Sprint 3 Collection List, Detail, and Fetch only read. A form can insert
 * or update a collection item. The route uses the signed-in Supabase client
 * (anon key + session), so collection RLS applies. Anonymous visitors are
 * rejected. The service-role client is not used for this path.
 *
 * Form input `name` attributes match a field key, or the field name when
 * the field has no key. Non-fillable and computed fields are ignored.
 */

import type { CollectionFieldType, CollectionWriteSettings, FormSettings } from '@/types';

const SKIPPED_TYPES = new Set<CollectionFieldType>(['count', 'status']);

export interface WriteField {
  id: string;
  key: string | null;
  name: string;
  fillable: boolean;
  is_computed: boolean;
  type: CollectionFieldType;
}

export interface CollectionWritePlan {
  ok: true;
  mode: 'insert' | 'update';
  collectionId: string;
  values: Record<string, string>;
  match?: { fieldId: string; value: string };
}

export interface CollectionWriteFailure {
  ok: false;
  error: string;
}

export function fieldInputKey(field: Pick<WriteField, 'key' | 'name'>): string {
  if (field.key && field.key.trim()) return field.key.trim();
  return field.name.trim().toLowerCase().replace(/\s+/g, '-');
}

function stringifyPayloadValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    const parts = value.filter((item): item is string => typeof item === 'string');
    return parts.length > 0 ? parts.join(', ') : null;
  }
  return null;
}

function writableFields(fields: WriteField[]): WriteField[] {
  return fields.filter((field) => field.fillable && !field.is_computed && !SKIPPED_TYPES.has(field.type));
}

export function planCollectionWrite(input: {
  collectionId: string;
  mode: 'insert' | 'update';
  payload: Record<string, unknown>;
  fields: WriteField[];
  matchFieldId?: string;
}): CollectionWritePlan | CollectionWriteFailure {
  const collectionId = input.collectionId.trim();
  if (!collectionId) return { ok: false, error: 'Choose a collection' };
  if (input.mode !== 'insert' && input.mode !== 'update') {
    return { ok: false, error: 'Choose insert or update' };
  }

  const fields = writableFields(input.fields);
  const byKey = new Map(fields.map((field) => [fieldInputKey(field), field]));
  const values: Record<string, string> = {};

  for (const [key, raw] of Object.entries(input.payload)) {
    const field = byKey.get(key);
    if (!field) continue;
    const value = stringifyPayloadValue(raw);
    if (value === null) continue;
    values[field.id] = value;
  }

  if (Object.keys(values).length === 0) {
    return { ok: false, error: 'No fillable fields matched the form' };
  }

  if (input.mode === 'insert') {
    return { ok: true, mode: 'insert', collectionId, values };
  }

  const matchField = fields.find((field) => field.id === input.matchFieldId);
  if (!matchField) return { ok: false, error: 'Choose the field used to find the item' };
  const matchValue = values[matchField.id];
  if (!matchValue) {
    return { ok: false, error: `The form is missing ${fieldInputKey(matchField)}` };
  }

  return {
    ok: true,
    mode: 'update',
    collectionId,
    values,
    match: { fieldId: matchField.id, value: matchValue },
  };
}

export interface FormPost {
  path: string;
  body: Record<string, unknown>;
}

/**
 * Where a published form posts. Collection writes and sign-in stay on
 * project-scoped paths (`/api/...` passed through projectsPath).
 */
export function resolveFormPost(
  settings: FormSettings | undefined,
  payload: Record<string, unknown>,
  meta: { formId: string; pageUrl?: string },
): FormPost {
  if (settings?.form_type === 'supabase_sign_in') {
    return {
      path: '/api/auth/sign-in',
      body: {
        email: typeof payload.email === 'string' ? payload.email : '',
        password: typeof payload.password === 'string' ? payload.password : '',
      },
    };
  }

  const write = settings?.collection_write;
  if (write?.enabled && write.collection_id) {
    return {
      path: '/api/collection-writes',
      body: {
        collection_id: write.collection_id,
        mode: write.mode,
        match_field_id: write.match_field_id,
        payload,
      },
    };
  }

  return {
    path: '/api/form-submissions',
    body: {
      form_id: meta.formId,
      payload,
      metadata: { page_url: meta.pageUrl },
      email: settings?.email_notification,
    },
  };
}

export function collectionWriteFromSettings(
  settings: CollectionWriteSettings | undefined,
): CollectionWriteSettings {
  return {
    enabled: settings?.enabled === true,
    collection_id: settings?.collection_id || '',
    mode: settings?.mode === 'update' ? 'update' : 'insert',
    match_field_id: settings?.match_field_id,
  };
}
