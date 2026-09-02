import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { applySecurityHeaders } from '@/lib/security-headers-server';

/**
 * Public API routes that skip authentication.
 */
const PUBLIC_API_PREFIXES = [
  '/ycode/api/setup/',    // Setup wizard — needed before any user exists
  '/ycode/api/supabase/', // Supabase config — needed for browser client init
  '/ycode/api/auth/',     // Auth callbacks and session checks
  '/ycode/api/v1/',       // Public API — has own API key auth
];

/**
 * Patterns for collection item endpoints that must be accessible on published pages
 * (load-more pagination, filter). Matched via regex since the collection ID is dynamic.
 */
const PUBLIC_COLLECTION_ITEM_SUFFIXES = ['/items/filter', '/items/load-more'];

const PUBLIC_API_EXACT = [
  '/ycode/api/revalidate', // Cache revalidation — has own secret token auth
  '/ycode/api/oauth/register', // RFC 7591 Dynamic Client Registration — anonymous
  '/ycode/api/oauth/token',    // OAuth token exchange — auth is via PKCE/refresh
];

const BUILDER_HOSTNAME = process.env.YCODE_BUILDER_HOSTNAME || 'avibuilder.com';
const DEFAULT_PROJECT_SLUG = 'kolbo-school';
const PROJECTS_PREFIX = `/projects/${DEFAULT_PROJECT_SLUG}`;
const LEGACY_BUILDER_HOSTNAMES = (process.env.YCODE_LEGACY_BUILDER_HOSTNAMES || 'ycode.kolboschool.com')
  .split(',')
  .map((hostname) => hostname.trim().toLowerCase())
  .filter(Boolean);

function getRequestHostname(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  return host.split(',')[0].trim().split(':')[0].toLowerCase();
}

function getBuilderPath(pathname: string): string | null {
  if (pathname === PROJECTS_PREFIX) return '/ycode';
  if (pathname.startsWith(`${PROJECTS_PREFIX}/`)) {
    return `/ycode${pathname.slice(PROJECTS_PREFIX.length)}`;
  }
  return null;
}

/**
 * Derive the Supabase project URL and anon key from environment variables.
 * Returns null if env vars are not set (pre-setup or local dev without .env.local).
 *
 * Uses SUPABASE_URL when set (self-hosted instances), otherwise derives from
 * the project ref in the connection string (hosted Supabase).
 */
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

  // Hosted Supabase: extract project ID from connection URL
  const match = connectionUrl.match(/\/\/postgres\.([a-z0-9]+):/);
  if (!match) return null;

  return {
    url: `https://${match[1]}.supabase.co`,
    anonKey,
  };
}

function isPublicApiRoute(pathname: string, method: string): boolean {
  // POST to form-submissions is public (website visitors submitting forms)
  if (pathname === '/ycode/api/form-submissions' && method === 'POST') {
    return true;
  }

  if (PUBLIC_API_EXACT.includes(pathname)) return true;

  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;

  // Collection item endpoints for published pages (POST only — filter, load-more)
  if (method === 'POST' && pathname.startsWith('/ycode/api/collections/') &&
      PUBLIC_COLLECTION_ITEM_SUFFIXES.some(suffix => pathname.endsWith(suffix))) {
    return true;
  }

  return false;
}

/**
 * Verify Supabase session for protected API routes.
 * Returns a 401 response if not authenticated, or null to continue.
 */
async function verifyApiAuth(request: NextRequest): Promise<NextResponse | null> {
  if (isPublicApiRoute(request.nextUrl.pathname, request.method)) {
    return null;
  }

  const config = getSupabaseEnvConfig();

  // If env vars aren't set (pre-setup or local dev without .env.local), let through
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

  // Authenticated — pass through with any refreshed cookies
  const authResponse = NextResponse.next({ request });
  response.cookies.getAll().forEach((cookie) => {
    authResponse.cookies.set(cookie.name, cookie.value);
  });

  return authResponse;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = getRequestHostname(request);
  const builderPath = getBuilderPath(pathname);

  // The Builder is an independent application. Its legacy host is retired and
  // must not redirect visitors to any project or public-site domain.
  if (LEGACY_BUILDER_HOSTNAMES.includes(hostname)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  if (hostname === BUILDER_HOSTNAME && pathname === '/') {
    return NextResponse.redirect(new URL(PROJECTS_PREFIX, request.url));
  }

  // MCP endpoints use their own token-based authentication — skip session auth.
  // Cloud overlay proxies MUST also exempt these paths to avoid login redirects.
  //   - `/ycode/mcp/<token>`: legacy URL-token endpoint (Cursor, Windsurf, etc.)
  //   - `/ycode/mcp`: OAuth Bearer-token endpoint (Claude.ai web, ChatGPT)
  const effectivePathname = builderPath ?? pathname;

  // `/ycode` is an internal route implementation detail. Public requests must
  // use the canonical project namespace; unlike a redirect, this prevents old
  // builder URLs from remaining part of the supported application surface.
  if (!builderPath && effectivePathname.startsWith('/ycode')) {
    return new NextResponse('Not Found', { status: 404 });
  }

  if (effectivePathname === '/ycode/mcp' || effectivePathname.startsWith('/ycode/mcp/')) {
    const response = builderPath
      ? NextResponse.rewrite(new URL(effectivePathname + request.nextUrl.search, request.url))
      : NextResponse.next();
    response.headers.set('x-pathname', effectivePathname);
    return response;
  }

  // Debug escape hatch: skip auth on preview routes when explicitly enabled.
  const skipPreviewAuth = process.env.DISABLE_PREVIEW_AUTH === 'true'
    && effectivePathname.startsWith('/ycode/preview');

  // Protect API and preview routes with auth. `/api/templates` lives outside the
  // `/ycode` tree (public site route group) but exposes destructive builder-only
  // operations (apply/export), so it must be gated here too.
  if (!skipPreviewAuth && (effectivePathname.startsWith('/ycode/api') || effectivePathname.startsWith('/ycode/preview') || effectivePathname.startsWith('/api/templates'))) {
    const authRequest = builderPath
      ? new NextRequest(new URL(effectivePathname + request.nextUrl.search, request.url), request)
      : request;
    const authResponse = await verifyApiAuth(authRequest);
    if (authResponse) {
      if (authResponse.status === 401) {
        if (effectivePathname.startsWith('/ycode/preview')) {
          return NextResponse.redirect(new URL(PROJECTS_PREFIX, request.url));
        }
        return authResponse;
      }
      // Authenticated — pass through
      authResponse.headers.set('x-pathname', effectivePathname);
      if (builderPath) {
        const rewriteUrl = request.nextUrl.clone();
        rewriteUrl.pathname = effectivePathname;
        return NextResponse.rewrite(rewriteUrl, { headers: authResponse.headers });
      }
      return authResponse;
    }
  }

  const isPublicPage = !effectivePathname.startsWith('/ycode')
    && !pathname.startsWith('/_next')
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

  // Create response
  const response = builderPath
    ? NextResponse.rewrite(new URL(effectivePathname + request.nextUrl.search, request.url))
    : NextResponse.next();

  // Add pathname header for layout to determine dark mode
  response.headers.set('x-pathname', effectivePathname);

  // Cache-Control for public pages is configured centrally via next.config.ts headers().

  // Apply configurable security headers to public pages only (not builder/API).
  if (isPublicPage) {
    await applySecurityHeaders(response);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
