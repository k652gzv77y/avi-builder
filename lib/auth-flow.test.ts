import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTH_ERROR_PARAM,
  authFailurePath,
  builderReturnPath,
  copySetCookieHeaders,
  formatAuthError,
  getPublicOrigin,
  getSafeNextPath,
  resolveSignInResult,
  sanitizeCookieOptions,
  shouldApplyAuthEvent,
} from '@/lib/auth-flow';

test('getSafeNextPath keeps project paths and drops open redirects', () => {
  assert.equal(getSafeNextPath('/projects'), '/projects');
  assert.equal(getSafeNextPath('/projects/kolbo-school'), '/projects/kolbo-school');
  assert.equal(getSafeNextPath('/projects/kolbo-school?tab=layers'), '/projects/kolbo-school?tab=layers');
  assert.equal(getSafeNextPath('https://evil.example/projects'), '/projects');
  assert.equal(getSafeNextPath('//evil.example/projects'), '/projects');
  assert.equal(getSafeNextPath('/settings'), '/projects');
  assert.equal(getSafeNextPath(null), '/projects');
});

test('builderReturnPath strips a previous auth error from the return URL', () => {
  assert.equal(
    builderReturnPath('/projects/kolbo-school', '?auth_error=auth&tab=layers'),
    '/projects/kolbo-school?tab=layers',
  );
  assert.equal(builderReturnPath('/welcome', ''), '/projects');
});

test('authFailurePath uses a query key Supabase does not treat as an OAuth error', () => {
  const path = authFailurePath('/projects/kolbo-school', 'auth');
  assert.equal(path, `/projects/kolbo-school?${AUTH_ERROR_PARAM}=auth`);
  assert.equal(path.includes('error_description'), false);
  assert.equal(formatAuthError('auth'), 'Sign-in could not be completed. Please try again.');
  assert.equal(formatAuthError('access_denied'), 'Sign-in was cancelled.');
  assert.equal(formatAuthError('Email not confirmed'), 'Email not confirmed');
});

test('getPublicOrigin prefers the forwarded public host', () => {
  assert.equal(getPublicOrigin({
    url: 'http://127.0.0.1:8787/editor/api/auth/callback',
    forwardedHost: 'avibuilder.com',
    forwardedProto: 'https',
  }), 'https://avibuilder.com');

  assert.equal(getPublicOrigin({
    url: 'http://localhost:3002/projects/auth/callback',
    forwardedHost: 'localhost:3002',
    forwardedProto: 'http',
  }), 'http://localhost:3002');
});

test('stale empty INITIAL_SESSION does not clear a user that just signed in', () => {
  assert.equal(shouldApplyAuthEvent('INITIAL_SESSION', null, { id: 'user-1' }), false);
  assert.equal(shouldApplyAuthEvent('INITIAL_SESSION', { user: { id: 'user-1' } }, null), true);
  assert.equal(shouldApplyAuthEvent('SIGNED_OUT', null, { id: 'user-1' }), true);
});

test('a stored session wins over a sign-in error', () => {
  assert.deepEqual(
    resolveSignInResult('Auth session missing!', null, { user: { id: 'user-1' } }),
    { error: null },
  );
  assert.deepEqual(
    resolveSignInResult('Invalid login credentials', null, null),
    { error: 'Invalid login credentials' },
  );
  assert.deepEqual(
    resolveSignInResult(null, { user: { id: 'user-1' } }, null),
    { error: null },
  );
});

test('cookie helpers keep every chunk and only supported attributes', () => {
  const from = new Headers();
  from.append('set-cookie', 'sb-auth-token.0=one; Path=/; Secure');
  from.append('set-cookie', 'sb-auth-token.1=two; Path=/; Secure');
  const to = new Headers();
  copySetCookieHeaders(from, to);
  assert.deepEqual(to.getSetCookie(), [
    'sb-auth-token.0=one; Path=/; Secure',
    'sb-auth-token.1=two; Path=/; Secure',
  ]);

  assert.deepEqual(sanitizeCookieOptions({
    path: '/',
    sameSite: 'lax',
    secure: true,
    maxAge: 3600,
    encode: () => 'ignored',
  } as object, false), {
    path: '/',
    sameSite: 'lax',
    secure: true,
    maxAge: 3600,
  });
});
