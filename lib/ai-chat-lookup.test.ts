import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isAbsentAiChatError,
  isAbsentAiChatId,
  isUnsavedAiChatResponse,
} from '@/lib/ai-chat-lookup';

test('a client id that is not a uuid is treated as unsaved', () => {
  assert.equal(isAbsentAiChatId('not-a-uuid'), true);
  assert.equal(isAbsentAiChatId(''), true);
  assert.equal(isAbsentAiChatId('550e8400-e29b-41d4-a716-446655440000'), false);
});

test('a missing row and a malformed uuid are not-found, other errors are not', () => {
  assert.equal(isAbsentAiChatError('PGRST116'), true);
  assert.equal(isAbsentAiChatError('22P02'), true);
  assert.equal(isAbsentAiChatError('42501'), false);
  assert.equal(isAbsentAiChatError(undefined), false);
  assert.equal(isAbsentAiChatError(null), false);
});

test('only an HTTP 404 means the chat was not saved', () => {
  assert.equal(isUnsavedAiChatResponse({ status: 404 }), true);
  assert.equal(isUnsavedAiChatResponse({ status: 500 }), false);
  assert.equal(isUnsavedAiChatResponse({}), false);
});
