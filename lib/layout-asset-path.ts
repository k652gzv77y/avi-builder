/**
 * Layout template images live in `public/ycode/layouts/assets`.
 * Seeded pages reference them as `/projects/:slug/layouts/assets/<file>`.
 *
 * The project rewrite would otherwise send that URL to
 * `/editor/layouts/assets/<file>`, which is not a page. Next answers with
 * the editor 404 document, so the canvas image request fails while the
 * homepage is drawn.
 */

const LAYOUT_ASSET_RE = /^(?:\/projects\/[^/]+|\/editor|\/ycode)?(\/layouts\/assets\/[^?#]+)$/;

/**
 * Internal path of a layout template file, or null when `pathname` is not one.
 * Already-public `/ycode/layouts/assets/...` paths return null so a rewrite
 * does not loop.
 */
export function publicLayoutAssetPath(pathname: string): string | null {
  const path = pathname.split('?')[0]?.split('#')[0] ?? '';
  const match = path.match(LAYOUT_ASSET_RE);
  if (!match) return null;
  const rest = match[1];
  if (rest.includes('..') || rest.includes('\\') || rest.includes('\0')) return null;
  const target = `/ycode${rest}`;
  if (target === path) return null;
  return target;
}
