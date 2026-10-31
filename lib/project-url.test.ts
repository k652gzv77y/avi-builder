import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectScopedPath, rememberProjectSlug } from '@/lib/project-url';

const CONFIG_SUFFIX = '/api/supabase/config';

test('supabase config URL keeps the slug when the page has no trailing slash', () => {
  const page = 'https://avibuilder.com/projects/kolbo-school';
  // A relative fetch of "api/supabase/config" resolves against the parent
  // directory and drops the slug. The config URL must not do that.
  assert.equal(
    new URL('api/supabase/config', page).pathname,
    '/projects/api/supabase/config',
  );
  assert.equal(
    projectScopedPath(CONFIG_SUFFIX, '/projects/kolbo-school'),
    '/projects/kolbo-school/api/supabase/config',
  );
  assert.equal(
    projectScopedPath(CONFIG_SUFFIX, '/projects/kolbo-school/'),
    '/projects/kolbo-school/api/supabase/config',
  );
  assert.equal(
    projectScopedPath('/api/setup/status', '/projects/kolbo-school'),
    '/projects/kolbo-school/api/setup/status',
  );
});

test('supabase config URL is not built without a project slug', () => {
  assert.equal(projectScopedPath(CONFIG_SUFFIX, '/projects'), null);
  assert.equal(projectScopedPath(CONFIG_SUFFIX, '/editor'), null);
  assert.equal(projectScopedPath(CONFIG_SUFFIX, '/projects/auth/callback'), null);
});

test('remembered slug is used when the page is the projects index', () => {
  rememberProjectSlug('kolbo-school');
  assert.equal(
    projectScopedPath(CONFIG_SUFFIX),
    '/projects/kolbo-school/api/supabase/config',
  );
});
