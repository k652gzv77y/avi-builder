import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { applySecurityHeaders } from '@/lib/security-headers-server';

const PUBLIC_API_PREFIXES = [
  '/ycode/api/setup/',
  '/ycode/api/supabase/',
  '/ycode/api/auth/',
  '/ycode/api/v1/',
];

const PUBLIC_COLLECTION_ITEM_SUFFIXES = ['/items/filter', '/items/load-more'];

const PUBLIC_API_EXACT = [
  '/ycode/api/revalidate',
  '/ycode/api/oauth/register',
  '/ycode/api/oauth/token',
];

const BUILDER_HOSTNAME = process.env.AVI_BUILDER_HOSTNAME || process.env.YCODE_BUILDER_HOSTNAME || 'avibuilder.com';
const LEGACY_BUILDER_HOSTNAMES = (process.env.AVI_LEGACY_BUILDER_HOSTNAMES || process.env.YCODE_LEGACY_BUILDER_HOSTNAMES || 'ycode.kolboschool.com')
  .split(',')
  .map((hostname) => hostname.trim().toLowerCase())
  .filter(Boolean);

function getRequestHostname(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  return host.split(',')[0].trim().split(':')[0].toLowerCase();
}

function redirectToHost(request: NextRequest, hostname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.protocol = 'https:';
  url.host = hostname;
  return NextResponse.redirect(url);
}

function isBuilderHostname(hostname: string): boolean {
  return hostname === BUILDER_HOSTNAME || LEGACY_BUILDER_HOSTNAMES.includes(hostname);
}

function isBuilderInfrastructurePath(pathname: string): boolean {
  return pathname === '/'
    || pathname.startsWith('/projects')
    || pathname.startsWith('/ycode')
    || pathname.startsWith('/editor')
    || pathname.startsWith('/login')
    || pathname.startsWith('/_next')
    || pathname.startsWith('/a/')
    || pathname === '/favicon.ico'
    || pathname.startsWith('/.well-known/');
}

function getSupabaseEnvConfig(): { url: string; anonKey: string } | null {
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY;
  const connectionUrl = process.env.SUPABASE_CONNECTION_URL;

  if (!anonKey || !connectionUrl) return null;

  if (process.env.SUPABASE_URL) {
    return {
      url: process.env.SUPABASE_URL.replace(/\/+$/, ''),
      anonKey,
    };
  }

  const match = connectionUrl.match(/\/\/postgres\.([a-z0-9]+):/);
  if (!match) return null;

  return {
    url: `https://${match[1]}.supabase.co`,
    anonKey,
  };
}

function isPublicApiRoute(pathname: string, method: string): boolean {
  if (pathname === '/ycode/api/form-submissions' && method === 'POST') {
    return true;
  }

  if (PUBLIC_API_EXACT.includes(pathname)) return true;
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;

  if (method === 'POST' && pathname.startsWith('/ycode/api/collections/') &&
      PUBLIC_COLLECTION_ITEM_SUFFIXES.some(suffix => pathname.endsWith(suffix))) {
    return true;
  }

  return false;
}

async function verifyApiAuth(request: NextRequest): Promise<NextResponse | null> {
  if (isPublicApiRoute(request.nextUrl.pathname, request.method)) {
    return null;
  }

  const config = getSupabaseEnvConfig();
  if (!config) return null;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  const authResponse = NextResponse.next({ request });
  response.cookies.getAll().forEach((cookie) => {
    authResponse.cookies.set(cookie.name, cookie.value);
  });

  return authResponse;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = getRequestHostname(request);

  if (LEGACY_BUILDER_HOSTNAMES.includes(hostname)) {
    return redirectToHost(request, BUILDER_HOSTNAME);
  }

  // Builder host serves the account + canvas. Published project domains never do.
  if (isBuilderHostname(hostname) && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/projects';
    return NextResponse.redirect(url);
  }

  if (!isBuilderHostname(hostname) && pathname.startsWith('/ycode')) {
    return redirectToHost(request, BUILDER_HOSTNAME);
  }

  if (!isBuilderHostname(hostname) && pathname.startsWith('/projects')) {
    return redirectToHost(request, BUILDER_HOSTNAME);
  }

  if (pathname === '/ycode/mcp' || pathname.startsWith('/ycode/mcp/')) {
    const response = NextResponse.next();
    response.headers.set('x-pathname', pathname);
    return response;
  }

  const skipPreviewAuth = process.env.DISABLE_PREVIEW_AUTH === 'true'
    && pathname.startsWith('/ycode/preview');

  if (!skipPreviewAuth && (pathname.startsWith('/ycode/api') || pathname.startsWith('/ycode/preview') || pathname.startsWith('/api/templates'))) {
    const authResponse = await verifyApiAuth(request);
    if (authResponse) {
      if (authResponse.status === 401) {
        if (pathname.startsWith('/ycode/preview')) {
          return NextResponse.redirect(new URL('/projects', request.url));
        }
        return authResponse;
      }
      authResponse.headers.set('x-pathname', pathname);
      return authResponse;
    }
  }

  const isPublicPage = !isBuilderInfrastructurePath(pathname)
    && !pathname.startsWith('/api')
    && !pathname.startsWith('/dynamic');
  const hasPaginationParams = Array.from(request.nextUrl.searchParams.keys())
    .some((key) => key.startsWith('p_'));

  if (isPublicPage && hasPaginationParams) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = pathname === '/' ? '/dynamic' : `/dynamic${pathname}`;

    const rewriteResponse = NextResponse.rewrite(rewriteUrl);
    rewriteResponse.headers.set('x-pathname', pathname);
    await applySecurityHeaders(rewriteResponse);
    return rewriteResponse;
  }

  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);

  if (isPublicPage) {
    await applySecurityHeaders(response);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
