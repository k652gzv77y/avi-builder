import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { copySetCookieHeaders } from '@/lib/auth-flow';
import {
  BRANCH_HEADER,
  parsePreviewHostname,
  projectSlugForHostname,
  redirectLocation,
} from '@/lib/domain-routing';
import { PROJECT_SLUG_HEADER, RESERVED_PROJECT_SLUGS } from '@/lib/project-url';
import { readWorkspaceGraph } from '@/lib/repositories/workspaceRepository';
import { resolveRole } from '@/lib/roles';
import { applySecurityHeaders } from '@/lib/security-headers-server';
import {
  isProjectContentApi,
  LEGACY_PROJECT_SLUG,
  routableDomains,
  usesSharedCanvas,
  canAccessProject,
  type WorkspaceActor,
} from '@/lib/workspace';

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
  if (pathname === '/projects/workspace' || pathname.startsWith('/projects/workspace/')) {
    const rest = pathname.slice('/projects/workspace'.length);
    return `/editor/api/workspace${rest}`;
  }
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

type GateUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
};

type AuthGate = { response: NextResponse | null; user: GateUser | null };

function requestHeadersFor(
  request: NextRequest,
  pathname: string,
  slug: string | null,
  branch?: string | null,
): Headers {
  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname);
  if (slug) headers.set(PROJECT_SLUG_HEADER, slug);
  if (branch) headers.set(BRANCH_HEADER, branch);
  return headers;
}

function rewriteWithProject(
  request: NextRequest,
  pathname: string,
  slug: string | null,
  branch?: string | null,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  if (branch) url.searchParams.set('branch', branch);
  const response = NextResponse.rewrite(url, {
    request: { headers: requestHeadersFor(request, pathname, slug, branch) },
  });
  response.headers.set('x-pathname', pathname);
  if (slug) response.headers.set(PROJECT_SLUG_HEADER, slug);
  if (branch) response.headers.set(BRANCH_HEADER, branch);
  return response;
}

async function readGraphFast(): Promise<Awaited<ReturnType<typeof readWorkspaceGraph>> | null> {
  try {
    return await Promise.race([
      readWorkspaceGraph(),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 800);
      }),
    ]);
  } catch {
    return null;
  }
}

async function canvasPath(path: string, slug: string): Promise<string> {
  if (path !== '/editor' && !path.startsWith('/ycode/preview')) return path;
  const graph = await readGraphFast();
  if (!graph || graph.projects.length === 0) {
    return slug === LEGACY_PROJECT_SLUG ? path : '/project-space';
  }
  const project = graph.projects.find((entry) => entry.slug === slug);
  if (!project || project.contentMode !== 'shared' || project.status === 'archived') {
    return '/project-space';
  }
  return path;
}

async function projectGate(slug: string, user: GateUser): Promise<'allow' | 'deny' | 'metadata' | 'unknown'> {
  try {
    const graph = await readGraphFast();
    if (!graph) return 'unknown';
    const actor: WorkspaceActor = {
      userId: user.id,
      email: user.email ?? '',
      appRole: resolveRole(typeof user.app_metadata?.role === 'string' ? user.app_metadata.role : null),
    };
    if (graph.legacyAdopted && graph.projects.length > 0 && !canAccessProject(graph, actor, slug)) {
      return 'deny';
    }
    return usesSharedCanvas(graph, slug) ? 'allow' : 'metadata';
  } catch {
    return 'unknown';
  }
}

async function verifyApiAuth(request: NextRequest): Promise<AuthGate> {
  if (isPublicApiRoute(request.nextUrl.pathname, request.method)) {
    return { response: null, user: null };
  }

  const config = getSupabaseEnvConfig();
  if (!config) return { response: null, user: null };

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
    return {
      response: NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      ),
      user: null,
    };
  }

  // Return the response setAll wrote. Copying name/value onto a new response
  // drops Path, Secure, and Max-Age, so the browser keeps the previous token.
  return { response, user };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = getRequestHostname(request);
  const previewHost = parsePreviewHostname(hostname);
  const onBuilder = isBuilderHost(hostname);
  let builderPath = getBuilderPath(pathname, hostname);
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  let projectSlug = projectMatch && !RESERVED_PROJECT_SLUGS.has(projectMatch[1])
    ? projectMatch[1]
    : null;
  const branchQuery = request.nextUrl.searchParams.get('branch');

  if (LEGACY_BUILDER_HOSTNAMES.includes(hostname)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  if (previewHost) {
    projectSlug = previewHost.project;
    let target = '/ycode/preview';
    const graph = await readGraphFast();
    if (graph && !usesSharedCanvas(graph, previewHost.project)) target = '/project-space';
    if (!graph && previewHost.project !== LEGACY_PROJECT_SLUG) target = '/project-space';
    const previewUrl = request.nextUrl.clone();
    previewUrl.pathname = target;
    previewUrl.searchParams.set('branch', previewHost.branch);
    const auth = await verifyApiAuth(new NextRequest(previewUrl, request));
    if (auth.response?.status === 401) {
      return NextResponse.redirect(new URL(`/projects/${previewHost.project}`, request.url));
    }
    if (auth.user) {
      const gate = await projectGate(previewHost.project, auth.user);
      if (gate === 'deny') {
        return NextResponse.json({ error: 'You do not have access to this project' }, { status: 403 });
      }
    }
    const rewrite = rewriteWithProject(request, target, previewHost.project, previewHost.branch);
    if (auth.response) copySetCookieHeaders(auth.response.headers, rewrite.headers);
    return rewrite;
  }

  if (!onBuilder) {
    try {
      const graph = await readGraphFast();
      const domains = graph ? routableDomains(graph) : [];
      const target = redirectLocation(hostname, domains);
      if (target) {
        const dest = new URL(target);
        dest.pathname = pathname;
        dest.search = request.nextUrl.search;
        return NextResponse.redirect(dest, 308);
      }
      projectSlug = projectSlugForHostname(hostname, domains) ?? projectSlug;
    } catch {
      // Custom-domain routing waits until the workspace graph can be read.
    }
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

  if (projectSlug && builderPath && (builderPath === '/editor' || builderPath.startsWith('/ycode/preview'))) {
    builderPath = await canvasPath(builderPath, projectSlug);
  }

  const projectPrefix = projectSlug ? `/projects/${projectSlug}` : '/projects';
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
    const auth = await verifyApiAuth(authRequest);
    if (auth.response?.status === 401) {
      if (effectivePathname.startsWith('/ycode/preview')) {
        return NextResponse.redirect(new URL(projectPrefix, request.url));
      }
      return auth.response;
    }
    if (auth.user && projectSlug) {
      const gate = await projectGate(projectSlug, auth.user);
      if (gate === 'deny') {
        return NextResponse.json({ error: 'You do not have access to this project' }, { status: 403 });
      }
      if (gate === 'metadata' && isProjectContentApi(effectivePathname)) {
        return NextResponse.json(
          { error: 'This project does not share the live site canvas' },
          { status: 403 },
        );
      }
    }
    if (auth.response) {
      if (builderPath) {
        const rewrite = rewriteWithProject(request, effectivePathname, projectSlug, branchQuery);
        copySetCookieHeaders(auth.response.headers, rewrite.headers);
        return rewrite;
      }
      auth.response.headers.set('x-pathname', effectivePathname);
      if (projectSlug) {
        auth.response.headers.set(PROJECT_SLUG_HEADER, projectSlug);
      }
      return auth.response;
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
    ? rewriteWithProject(request, effectivePathname, projectSlug, branchQuery)
    : NextResponse.next({
      request: { headers: requestHeadersFor(request, effectivePathname, projectSlug, branchQuery) },
    });

  response.headers.set('x-pathname', effectivePathname);
  if (projectSlug) {
    response.headers.set(PROJECT_SLUG_HEADER, projectSlug);
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
