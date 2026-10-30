/**
 * Pure helpers for builder sign-in.
 *
 * The OAuth callback and the email form both have to agree on which URL is
 * safe to return to, and the email form must not treat a persisted session
 * as a failure when a later auth event reports an error.
 */

export const AUTH_ERROR_PARAM = 'auth_error';

const PROJECTS_ROOT = '/projects';
const RETURN_ORIGIN = 'https://avibuilder.com';

export interface AuthSessionLike {
  user?: unknown;
}

export interface CookieWriteOptions {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path: string;
  sameSite: 'lax' | 'strict' | 'none';
  secure: boolean;
}

/** Same-origin builder path, or the projects root when the value is not safe. */
export function getSafeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return PROJECTS_ROOT;
  if (value.includes('\\') || value.includes('://')) return PROJECTS_ROOT;

  let target: URL;
  try {
    target = new URL(value, RETURN_ORIGIN);
  } catch {
    return PROJECTS_ROOT;
  }

  if (target.origin !== RETURN_ORIGIN) return PROJECTS_ROOT;
  if (target.pathname !== PROJECTS_ROOT && !target.pathname.startsWith(`${PROJECTS_ROOT}/`)) {
    return PROJECTS_ROOT;
  }

  return `${target.pathname}${target.search}`;
}

/** Path to resume after OAuth, without a previous auth error stuck in the query. */
export function builderReturnPath(pathname: string, search = ''): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.delete('error');
  params.delete('error_description');
  params.delete(AUTH_ERROR_PARAM);
  const query = params.toString();
  const path = pathname || PROJECTS_ROOT;
  return getSafeNextPath(query ? `${path}?${query}` : path);
}

/** Login URL that carries a short auth error without using Supabase's `error` query key. */
export function authFailurePath(next: string | null | undefined, message: string): string {
  const safe = getSafeNextPath(next);
  const target = new URL(safe, RETURN_ORIGIN);
  target.searchParams.set(AUTH_ERROR_PARAM, message);
  return `${target.pathname}${target.search}`;
}

export function formatAuthError(code: string | null | undefined): string | null {
  if (!code) return null;
  const value = code.trim();
  if (!value) return null;
  if (value === 'auth' || value === 'server') {
    return 'Sign-in could not be completed. Please try again.';
  }
  if (value === 'config') return 'Sign-in is not configured yet.';
  if (value === 'access_denied') return 'Sign-in was cancelled.';
  if (value.length > 180) return 'Sign-in could not be completed. Please try again.';
  return value;
}

/**
 * Origin the browser should land on after the callback.
 * Cloudflare Workers often see an internal request URL, so prefer the
 * forwarded host when it is a public hostname.
 */
export function getPublicOrigin(input: {
  url: string;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  host?: string | null;
}): string {
  const requestOrigin = new URL(input.url).origin;
  const host = (input.forwardedHost || input.host || '').split(',')[0]?.trim() || '';
  if (!host) return requestOrigin;

  const hostname = host.split(':')[0]?.toLowerCase() || '';
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
    return requestOrigin;
  }

  const proto = (input.forwardedProto || 'https').split(',')[0]?.trim().replace(/:$/, '') || 'https';
  return `${proto}://${host}`;
}

/**
 * INITIAL_SESSION is emitted asynchronously and can arrive after password
 * sign-in with the empty snapshot it loaded earlier. Applying it signs the
 * user back out of the UI even though the cookie session is already stored.
 */
export function shouldApplyAuthEvent(
  event: string,
  session: AuthSessionLike | null,
  currentUser: unknown,
): boolean {
  if (event === 'INITIAL_SESSION' && !session?.user && currentUser) return false;
  return true;
}

/**
 * Password sign-in writes the session before some follow-up auth calls report
 * an error. A readable session means the sign-in succeeded.
 */
export function resolveSignInResult(
  errorMessage: string | null,
  attemptSession: AuthSessionLike | null,
  storedSession: AuthSessionLike | null,
): { error: string | null } {
  if (attemptSession?.user || storedSession?.user) return { error: null };
  return { error: errorMessage || 'Sign in failed' };
}

/** Copy every Set-Cookie header. Headers.get() collapses duplicates and drops chunks. */
export function copySetCookieHeaders(from: Headers, to: Headers): void {
  const cookies = typeof from.getSetCookie === 'function' ? from.getSetCookie() : [];
  if (cookies.length > 0) {
    for (const cookie of cookies) to.append('set-cookie', cookie);
    return;
  }

  const single = from.get('set-cookie');
  if (single) to.append('set-cookie', single);
}

/** Keep only the cookie attributes NextResponse and cookies().set accept. */
export function sanitizeCookieOptions(
  options: object | undefined,
  secureDefault: boolean,
): CookieWriteOptions {
  const source = (options ?? {}) as Record<string, unknown>;
  const sameSiteRaw = source.sameSite;
  const sameSite = sameSiteRaw === 'strict' || sameSiteRaw === 'none' || sameSiteRaw === 'lax'
    ? sameSiteRaw
    : 'lax';

  const sanitized: CookieWriteOptions = {
    path: typeof source.path === 'string' && source.path ? source.path : '/',
    sameSite,
    secure: typeof source.secure === 'boolean' ? source.secure : secureDefault,
  };

  if (typeof source.domain === 'string' && source.domain) sanitized.domain = source.domain;
  if (source.expires instanceof Date) sanitized.expires = source.expires;
  if (typeof source.httpOnly === 'boolean') sanitized.httpOnly = source.httpOnly;
  if (typeof source.maxAge === 'number') sanitized.maxAge = source.maxAge;

  return sanitized;
}
