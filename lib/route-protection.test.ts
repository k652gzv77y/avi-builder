import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSignInPath,
  safeNextPath,
  sessionGate,
  signInNextFromLocation,
} from '@/lib/route-protection';
import type { Page } from '@/types';

function page(auth: Page['settings']['auth']): Pick<Page, 'settings'> {
  return { settings: { auth } as Page['settings'] };
}

test('sign-in paths stay on this site', () => {
  assert.equal(normalizeSignInPath(undefined), '/sign-in');
  assert.equal(normalizeSignInPath('https://evil.example/phish'), '/sign-in');
  assert.equal(normalizeSignInPath('//evil.example'), '/sign-in');
  assert.equal(normalizeSignInPath('/login?next=/'), '/login');
});

test('next targets reject absolute urls', () => {
  assert.equal(safeNextPath('/account'), '/account');
  assert.equal(safeNextPath('https://evil.example'), null);
  assert.equal(safeNextPath('//evil.example'), null);
  assert.equal(signInNextFromLocation('?next=/account'), '/account');
  assert.equal(signInNextFromLocation('?next=https://evil.example'), null);
});

test('a session-protected page redirects except on its own sign-in path', () => {
  const protectedPage = page({ enabled: false, password: '', requireSession: true, signInPath: '/login' });
  const away = sessionGate(protectedPage, '/members');
  assert.equal(away.redirect, true);
  assert.equal(away.location, '/login?next=%2Fmembers');

  const home = sessionGate(protectedPage, '/login');
  assert.equal(home.redirect, false);

  const open = sessionGate(page({ enabled: true, password: 'secret' }), '/members');
  assert.equal(open.required, false);
  assert.equal(open.redirect, false);
});
