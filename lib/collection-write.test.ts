import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fieldInputKey,
  planCollectionWrite,
  resolveFormPost,
} from '@/lib/collection-write';
import type { WriteField } from '@/lib/collection-write';
import type { FormSettings } from '@/types';

const fields: WriteField[] = [
  { id: 'field-name', key: 'name', name: 'Name', fillable: true, is_computed: false, type: 'text' },
  { id: 'field-email', key: null, name: 'Email Address', fillable: true, is_computed: false, type: 'email' },
  { id: 'field-count', key: 'count', name: 'Count', fillable: true, is_computed: true, type: 'count' },
  { id: 'field-locked', key: 'secret', name: 'Secret', fillable: false, is_computed: false, type: 'text' },
];

test('field keys fall back to a slug of the name', () => {
  assert.equal(fieldInputKey(fields[0]), 'name');
  assert.equal(fieldInputKey(fields[1]), 'email-address');
});

test('insert keeps fillable fields and drops computed or locked ones', () => {
  const plan = planCollectionWrite({
    collectionId: 'col-1',
    mode: 'insert',
    payload: { name: 'Ada', 'email-address': 'ada@example.com', count: '4', secret: 'no' },
    fields,
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(plan.mode, 'insert');
  assert.deepEqual(plan.values, {
    'field-name': 'Ada',
    'field-email': 'ada@example.com',
  });
});

test('update requires the match field to be present on the form', () => {
  const missing = planCollectionWrite({
    collectionId: 'col-1',
    mode: 'update',
    payload: { name: 'Ada' },
    fields,
    matchFieldId: 'field-email',
  });
  assert.equal(missing.ok, false);

  const ready = planCollectionWrite({
    collectionId: 'col-1',
    mode: 'update',
    payload: { name: 'Ada', 'email-address': 'ada@example.com' },
    fields,
    matchFieldId: 'field-email',
  });
  assert.equal(ready.ok, true);
  if (!ready.ok) return;
  assert.deepEqual(ready.match, { fieldId: 'field-email', value: 'ada@example.com' });
});

test('forms post to collection writes, sign-in, or submissions', () => {
  const payload = { email: 'ada@example.com', password: 'secret' };
  const signIn: FormSettings = { form_type: 'supabase_sign_in' };
  assert.equal(resolveFormPost(signIn, payload, { formId: 'form' }).path, '/api/auth/sign-in');

  const write: FormSettings = {
    collection_write: { enabled: true, collection_id: 'col-1', mode: 'insert' },
  };
  const collectionPost = resolveFormPost(write, { name: 'Ada' }, { formId: 'form' });
  assert.equal(collectionPost.path, '/api/collection-writes');
  assert.equal(collectionPost.body.collection_id, 'col-1');

  const plain = resolveFormPost({}, { name: 'Ada' }, { formId: 'form-1' });
  assert.equal(plain.path, '/api/form-submissions');
  assert.equal(plain.body.form_id, 'form-1');
});
