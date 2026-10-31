/**
 * Published-route session gate.
 *
 * Password protection stays in lib/page-auth.ts. This gate is the Supabase
 * session check: a page with auth.requireSession sends anonymous visitors
 * to its sign-in path. The sign-in page itself is not redirected, so a
 * sign-in form can live there without a loop.
 */

import type { Page } from '@/types';

export const DEFAULT_SIGN_IN_PATH = '/sign-in';

export interface SessionGate {
  required: boolean;
  signInPath: string;
  /** True when this request should redirect to the sign-in page. */
  redirect: boolean;
  location: string;
}

export function normalizeSignInPath(value: string | undefined): string {
  const trimmed = (value || '').trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return DEFAULT_SIGN_IN_PATH;
  const path = trimmed.split('?')[0].split('#')[0];
  return path || DEFAULT_SIGN_IN_PATH;
}

/** Only same-site paths. Rejects protocol-relative and absolute URLs. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('://')) return null;
  return value;
}

export function signInNextFromLocation(search: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return safeNextPath(params.get('next'));
}

export function sessionRedirectTarget(signInPath: string, currentPath: string): string {
  const next = encodeURIComponent(currentPath || '/');
  const joiner = signInPath.includes('?') ? '&' : '?';
  return `${signInPath}${joiner}next=${next}`;
}

export function sessionGate(page: Pick<Page, 'settings'>, currentPath: string): SessionGate {
  const required = page.settings?.auth?.requireSession === true;
  const signInPath = normalizeSignInPath(page.settings?.auth?.signInPath);
  const path = currentPath.split('?')[0].split('#')[0] || '/';
  const redirect = required && path !== signInPath;
  return {
    required,
    signInPath,
    redirect,
    location: redirect ? sessionRedirectTarget(signInPath, path) : path,
  };
}

/**
 * Redirect anonymous visitors when the page requires a Supabase session.
 * Uses the cookie session client, which is the same client RLS sees.
 */
export async function enforceSessionGate(
  page: Pick<Page, 'settings'>,
  currentPath: string,
): Promise<void> {
  const decision = sessionGate(page, currentPath);
  if (!decision.redirect) return;

  const { connection } = await import('next/server');
  await connection();

  const { getAuthUser } = await import('@/lib/supabase-auth');
  const auth = await getAuthUser();
  if (auth) return;

  const { redirect } = await import('next/navigation');
  redirect(decision.location);
}
