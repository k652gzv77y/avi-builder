/**
 * Layout template files live in `public/ycode/layouts`.
 * Seeded pages and the layout picker reference them as
 * `/projects/:slug/layouts/assets/<file>` and
 * `/projects/:slug/layouts/previews/<file>`.
 *
 * On Cloudflare, `public/` files are served by the ASSETS binding only when
 * the request path matches the file. A Next rewrite to `/ycode/layouts/...`
 * stays inside the Next server, which has no such route and returns the
 * editor 404 document. Callers must read the file from ASSETS at the public
 * path instead of rewriting.
 */

const LAYOUT_FILE_RE = /^(?:\/projects\/[^/]+|\/editor|\/ycode)?(\/layouts\/(?:assets|previews)\/[^?#]+)$/;

/**
 * Public ASSETS path for a layout file, or null when `pathname` is not one.
 * Already-public `/ycode/layouts/...` paths return null so a lookup does not loop.
 */
export function publicLayoutAssetPath(pathname: string): string | null {
  const path = pathname.split('?')[0]?.split('#')[0] ?? '';
  const match = path.match(LAYOUT_FILE_RE);
  if (!match) return null;
  const rest = match[1];
  if (rest.includes('..') || rest.includes('\\') || rest.includes('\0')) return null;
  const target = `/ycode${rest}`;
  if (target === path) return null;
  return target;
}
