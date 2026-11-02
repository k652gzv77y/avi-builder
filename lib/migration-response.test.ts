import assert from 'node:assert/strict';
import test from 'node:test';

import { interpretMigrationResponse } from '@/lib/migration-response';

test('up to date migrations let the editor continue', () => {
  const raw = JSON.stringify({
    success: true,
    executed: [],
    seeds: {},
    message: 'All migrations already up to date',
  });
  assert.deepEqual(interpretMigrationResponse(200, raw), {
    proceed: true,
    error: null,
  });
});

test('a JSON migration error is shown instead of being swallowed', () => {
  const raw = JSON.stringify({
    error: 'Cannot connect to database. Please check your database password is configured correctly.',
    executed: [],
  });
  assert.deepEqual(interpretMigrationResponse(500, raw), {
    proceed: false,
    error: 'Cannot connect to database. Please check your database password is configured correctly.',
  });
});

test('an HTML 500 does not surface as a JSON parse exception', () => {
  const html = '<!DOCTYPE html><html><head><title>500: Internal Server Error</title></head><body>error code: 1101</body></html>';
  const outcome = interpretMigrationResponse(500, html);
  assert.equal(outcome.proceed, false);
  assert.equal(outcome.error, 'Migration failed (HTTP 500)');
  assert.equal(outcome.error?.includes('<!DOCTYPE'), false);
});
