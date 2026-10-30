import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { credentials } from '@/lib/credentials';
import { parseSupabaseConfig } from '@/lib/supabase-config-parser';
import {
  authFailurePath,
  getPublicOrigin,
  getSafeNextPath,
  sanitizeCookieOptions,
} from '@/lib/auth-flow';
import type { SupabaseConfig } from '@/types';

export const dynamic = 'force-dynamic';

function originFor(request: NextRequest): string {
  return getPublicOrigin({
    url: request.url,
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
    host: request.headers.get('host'),
  });
}

function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, originFor(request)));
}

async function readCallbackParams(request: NextRequest): Promise<{
  code: string | null;
  next: string | null;
  error: string | null;
}> {
  const url = request.nextUrl;
  let code = url.searchParams.get('code');
  let next = url.searchParams.get('next');
  let error = url.searchParams.get('error_description') || url.searchParams.get('error');

  if (request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const read = (key: string) => {
      const value = form?.get(key);
      return typeof value === 'string' && value ? value : null;
    };
    code = code || read('code');
    next = next || read('next');
    error = error || read('error_description') || read('error');
  }

  return { code, next, error };
}

/**
 * OAuth return for Supabase Auth (Apple, Google).
 *
 * Apple posts back to Supabase, which then redirects the browser here with
 * `?code=`. The PKCE exchange has to write session cookies onto this redirect
 * response. cookies() from next/headers does not reliably attach those
 * Set-Cookie headers on Cloudflare Workers.
 *
 * GET  /projects/auth/callback
 * POST /projects/auth/callback
 */
async function handleAuthCallback(request: NextRequest) {
  const { code, next, error } = await readCallbackParams(request);
  const secure = originFor(request).startsWith('https://');

  if (error) {
    return redirectTo(request, authFailurePath(next, error));
  }

  if (!code) {
    return redirectTo(request, getSafeNextPath(next));
  }

  const response = redirectTo(request, getSafeNextPath(next));

  try {
    const config = await credentials.get<SupabaseConfig>('supabase_config');
    if (!config) {
      return redirectTo(request, authFailurePath(next, 'config'));
    }

    let parsed;
    try {
      parsed = parseSupabaseConfig(config);
    } catch {
      return redirectTo(request, authFailurePath(next, 'config'));
    }

    const supabase = createServerClient(parsed.projectUrl, parsed.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(
              name,
              value,
              sanitizeCookieOptions(options, secure),
            );
          });
        },
      },
    });

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error('Auth callback error:', exchangeError.message);
      return redirectTo(request, authFailurePath(next, 'auth'));
    }

    return response;
  } catch (callbackError) {
    console.error('Auth callback failed:', callbackError);
    return redirectTo(request, authFailurePath(next, 'server'));
  }
}

export async function GET(request: NextRequest) {
  return handleAuthCallback(request);
}

export async function POST(request: NextRequest) {
  return handleAuthCallback(request);
}
