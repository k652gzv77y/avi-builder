import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { applySecurityHeaders } from '@/lib/security-headers-server';

const PUBLIC_API_PREFIXES = [
  '/editor/api/setup/',
  '/editor/api/supabase/',
  '/editor/api/auth/',
  '/editor/api/v1/',
  '/editor/api/domains/cloudflare/',
  '/ycode/api/setup/',
  '/ycode/api/supabase/',
  '/ycode/api/auth/',
  '/ycode/api/v1/',
  '/ycode/api/domains/cloudflare/',
];

const PUBLIC_COLLECTION_ITEM_SUFFIXES = ['/items/filter', '/items/load-more'];

const PUBLIC_API_EXACT = [
  '/editor/api/revalidate',
  '/editor/api/oauth/register',
  '/editor/api/oauth/token',
  '/editor/api/domains/cloudflare/callback',
  '/editor/api/supabase/oauth/callback',
  '/ycode/api/revalidate',
  '/ycode/api/oauth/register',
  '/ycode/api/oauth/token',
  '/ycode/api/domains/cloudflare/callback',
  '/ycode/api/supabase/oauth/callback',
];

const BUILDER_HOSTNAME = process.env.YCODE_BUILDER_HOSTNAME || 'avibuilder.com';
const PROJECTS_ROOT = '/projects';
const PROJECTS_AUTH_CALLBACK = `${PROJECTS_ROOT}/auth/callback`;
const RESERVED_PROJECT_SLUGS = new Set(['oauth', 'auth']);
const LEGACY_BUILDER_HOSTNAMES = (process.env.YCODE_LEGACY_BUILDER_HOSTNAMES || 'ycode.kolboschool.com')
  .split(',')
  .map((hostname) => hostname.trim().toLowerCase())
  .filter(Boolean);

function getRequestHostname(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  return host.split(',')[0].trim().split(':')[0].toLowerCase();
}

function isBuilderHost(hostname: string): boolean {
  return hostname === BUILDER_HOSTNAME || hostname === `www.${BUILDER_HOSTNAME}`;
}

function getBuilderPath(pathname: string, hostname: string): string | null {
  if (!isBuilderHost(hostname)) return null;
  if (pathname === PROJECTS_AUTH_CALLBACK) return '/editor/api/auth/callback';
  if (pathname === '/projects/oauth/cloudflare/callback') return '/editor/api/domains/cloudflare/callback';
  if (pathname === '/projects/oauth/supabase/callback') return '/editor/api/supabase/oauth/callback';
  if (pathname === PROJECTS_ROOT) return null;
  const match = pathname.match(/^\/projects\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  if (RESERVED_PROJECT_SLUGS.has(match[1])) return null;
  const rest = match[2] || '';
  if (rest.startsWith('/auth/')) return null;
  // Site preview routes stay under /ycode/preview (app/(site)/ycode/preview)
  if (rest === '/preview' || rest.startsWith('/preview/')) {
    return `/ycode${rest}`;
  }
  return rest ? `/editor${rest}` : '/editor';
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
  if ((pathname === '/editor/api/form-submissions' || pathname === '/ycode/api/form-submissions') && method === 'POST') {
    return true;
  }

  if (PUBLIC_API_EXACT.includes(pathname)) return true;
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;

  if (method === 'POST' && (pathname.startsWith('/editor/api/collections/') || pathname.startsWith('/ycode/api/collections/')) &&
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
  const onBuilder = isBuilderHost(hostname);
  const builderPath = getBuilderPath(pathname, hostname);
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const projectSlug = projectMatch && !RESERVED_PROJECT_SLUGS.has(projectMatch[1])
    ? projectMatch[1]
    : null;
  const projectPrefix = projectSlug ? `/projects/${projectSlug}` : '/projects';

  if (LEGACY_BUILDER_HOSTNAMES.includes(hostname)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  if (onBuilder && pathname === '/') {
    return NextResponse.redirect(new URL(PROJECTS_ROOT, request.url));
  }

  if (onBuilder && (pathname.endsWith('/welcome') || pathname === '/welcome')) {
    return NextResponse.redirect(new URL(projectSlug ? `/projects/${projectSlug}` : PROJECTS_ROOT, request.url));
  }

  if (!onBuilder && (pathname.startsWith('/projects') || pathname.startsWith('/ycode') || pathname.endsWith('/welcome'))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const effectivePathname = builderPath ?? pathname;

  // Legacy /ycode paths. Preview stays on /ycode/preview.
  // Product pages redirect to /projects/:slug; API/MCP rewrite to /editor handlers.
  if (!builderPath && pathname.startsWith('/ycode') && !pathname.startsWith('/ycode/preview')) {
    const isApiOrMcp = pathname.startsWith('/ycode/api') || pathname.startsWith('/ycode/mcp');
    if (!isApiOrMcp && onBuilder) {
      const rest = pathname.replace(/^\/ycode/, '') || '';
      const target = projectSlug ? `/projects/${projectSlug}${rest}` : PROJECTS_ROOT;
      return NextResponse.redirect(new URL(target + request.nextUrl.search, request.url));
    }
    const rewritten = pathname.replace(/^\/ycode/, '/editor');
    const response = NextResponse.rewrite(new URL(rewritten + request.nextUrl.search, request.url));
    response.headers.set('x-pathname', rewritten);
    if (projectSlug) {
      response.headers.set('x-avi-project-slug', projectSlug);
    }
    return response;
  }

  if (effectivePathname === '/editor/mcp' || effectivePathname.startsWith('/editor/mcp/')
      || effectivePathname === '/ycode/mcp' || effectivePathname.startsWith('/ycode/mcp/')) {
    const mcpPath = effectivePathname.replace(/^\/ycode\/mcp/, '/editor/mcp');
    const response = NextResponse.rewrite(new URL(mcpPath + request.nextUrl.search, request.url));
    response.headers.set('x-pathname', mcpPath);
    if (projectSlug) {
      response.headers.set('x-avi-project-slug', projectSlug);
    }
    return response;
  }

  const skipPreviewAuth = process.env.DISABLE_PREVIEW_AUTH === 'true'
    && effectivePathname.startsWith('/ycode/preview');

  if (!skipPreviewAuth && (
    effectivePathname.startsWith('/editor/api')
    || effectivePathname.startsWith('/ycode/api')
    || effectivePathname.startsWith('/ycode/preview')
    || effectivePathname.startsWith('/api/templates')
  )) {
    const authRequest = builderPath
      ? new NextRequest(new URL(effectivePathname + request.nextUrl.search, request.url), request)
      : request;
    const authResponse = await verifyApiAuth(authRequest);
    if (authResponse) {
      if (authResponse.status === 401) {
        if (effectivePathname.startsWith('/ycode/preview')) {
          return NextResponse.redirect(new URL(projectPrefix, request.url));
        }
        return authResponse;
      }
      authResponse.headers.set('x-pathname', effectivePathname);
      if (projectSlug) {
        authResponse.headers.set('x-avi-project-slug', projectSlug);
      }
      if (builderPath) {
        const rewriteUrl = request.nextUrl.clone();
        rewriteUrl.pathname = effectivePathname;
        return NextResponse.rewrite(rewriteUrl, { headers: authResponse.headers });
      }
      return authResponse;
    }
  }

  const isPublicPage = !effectivePathname.startsWith('/ycode')
    && !effectivePathname.startsWith('/editor')
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

  const response = builderPath
    ? NextResponse.rewrite(new URL(effectivePathname + request.nextUrl.search, request.url))
    : NextResponse.next();

  response.headers.set('x-pathname', effectivePathname);
  if (projectSlug) {
    response.headers.set('x-avi-project-slug', projectSlug);
  }

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
