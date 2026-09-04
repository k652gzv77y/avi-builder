/**
 * Project URL helpers
 *
 * Builder URLs are always /projects/:slug/...
 * Derive the slug from the current path — never hardcode a project name.
 */

const RESERVED_PROJECT_SLUGS = new Set(['oauth', 'auth']);
const PROJECTS_FALLBACK = '/projects';

/** Set by proxy.ts on rewritten /projects/:slug requests so server routes can resolve the slug. */
export const PROJECT_SLUG_HEADER = 'x-avi-project-slug';

export function getProjectSlugFromPath(pathname: string | null | undefined): string | null {
  const match = pathname?.match(/^\/projects\/([^/]+)/);
  if (!match) return null;
  if (RESERVED_PROJECT_SLUGS.has(match[1])) return null;
  return match[1];
}

export function getProjectSlugFromHeaders(headers: Headers | null | undefined): string | null {
  const value = headers?.get(PROJECT_SLUG_HEADER);
  return value && !RESERVED_PROJECT_SLUGS.has(value) ? value : null;
}

/** Last known slug for this isolate (SSR header or client URL). */
let rememberedProjectSlug: string | null = null;

export function rememberProjectSlug(slug: string | null | undefined): void {
  if (slug && !RESERVED_PROJECT_SLUGS.has(slug)) {
    rememberedProjectSlug = slug;
  }
}

/** Current project slug from the browser URL (client-only). */
export function getCurrentProjectSlug(): string | null {
  if (typeof window === 'undefined') return rememberedProjectSlug;
  return getProjectSlugFromPath(window.location.pathname) ?? rememberedProjectSlug;
}

/**
 * Build a /projects/:slug... path using the slug from the current URL,
 * optional pathname, or the proxy project-slug header.
 * `suffix` may be empty (project root) or start with `/`
 * (e.g. `/api/pages`, `/layers/abc`).
 */
export function projectsPath(
  suffix = '',
  pathnameOrHeaders?: string | null | Headers,
): string {
  let slug: string | null = null;

  if (pathnameOrHeaders instanceof Headers) {
    slug = getProjectSlugFromHeaders(pathnameOrHeaders);
  } else {
    slug = getProjectSlugFromPath(pathnameOrHeaders ?? null);
  }

  slug = slug ?? getCurrentProjectSlug();

  // Rewrites send /projects/:slug → /editor. During SSR there is no window, so
  // throwing here 500s the canvas (login form Link, etc). Never throw.
  if (!slug) {
    if (!suffix) return PROJECTS_FALLBACK;
    const path = suffix.startsWith('/') ? suffix : `/${suffix}`;
    return path.startsWith('/projects') ? path : `${PROJECTS_FALLBACK}${path}`;
  }

  if (!suffix) return `/projects/${slug}`;
  const path = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return `/projects/${slug}${path}`;
}

/** Safe variant for non-critical UI that can fall back when outside a project. */
export function projectsPathOr(suffix: string, fallbackSlug: string, pathname?: string | null): string {
  try {
    return projectsPath(suffix, pathname);
  } catch {
    const path = suffix.startsWith('/') ? suffix : `/${suffix}`;
    return `/projects/${fallbackSlug}${path}`;
  }
}
