/**
 * Tailwind compiler inputs bundled at build time.
 *
 * `getCompiler` in cssGenerator used to `readFile` Tailwind's CSS out of
 * `node_modules`. OpenNext does not put those files on the worker filesystem,
 * so the read throws ENOENT and per-page CSS generation returns 500.
 * Known Tailwind ids are served from the generated module instead.
 */

import { compile } from 'tailwindcss';

import { TAILWIND_CUSTOM_VARIANTS } from '@/lib/tailwind-custom-variants';
import {
  TAILWIND_INDEX_CSS,
  TAILWIND_PACKAGE_NAME,
  TAILWIND_STYLESHEET_BASE,
  TAILWIND_STYLESHEET_VERSION,
  TAILWIND_STYLESHEETS,
} from '@/lib/server/generated/tailwind-stylesheets';

const NODE_MODULES_BASE = '/node_modules';

export interface BundledStylesheet {
  path: string;
  base: string;
  content: string;
}

type TailwindCompiler = {
  build: (candidates: string[]) => string;
};

let compilerCache: TailwindCompiler | null = null;

function isRelativeOrRoot(id: string): boolean {
  return id.startsWith('./') || id.startsWith('../') || id.startsWith('/') || id === '.' || id === '..';
}

/** Resolve `id` against `base` using POSIX rules. `base` is a virtual directory. */
function normalizeAbsolute(base: string, id: string): string {
  const parts: string[] = id.startsWith('/') ? [] : base.split('/').filter((part) => part.length > 0);

  for (const part of id.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  return `/${parts.join('/')}`;
}

/**
 * Map a Tailwind `loadStylesheet` id onto a key in the bundled stylesheet map.
 * Package ids (`tailwindcss/theme.css`) are used as-is. Relative ids are
 * resolved against the virtual base returned for the parent sheet.
 */
export function resolveBundledStylesheetId(id: string, base: string): string {
  const specifier = id.trim();
  if (!isRelativeOrRoot(specifier)) return specifier;

  const resolved = normalizeAbsolute(base, specifier);
  if (resolved === TAILWIND_STYLESHEET_BASE) return TAILWIND_PACKAGE_NAME;

  const packagePrefix = `${TAILWIND_STYLESHEET_BASE}/`;
  if (resolved.startsWith(packagePrefix)) {
    return `${TAILWIND_PACKAGE_NAME}/${resolved.slice(packagePrefix.length)}`;
  }

  const modulesPrefix = `${NODE_MODULES_BASE}/`;
  if (resolved.startsWith(modulesPrefix)) {
    return resolved.slice(modulesPrefix.length);
  }

  return resolved;
}

function stylesheetLocation(key: string): { path: string; base: string } {
  const inTailwind = key === TAILWIND_PACKAGE_NAME || key.startsWith(`${TAILWIND_PACKAGE_NAME}/`);
  const virtualPath = inTailwind
    ? `${TAILWIND_STYLESHEET_BASE}/${key === TAILWIND_PACKAGE_NAME ? 'index.css' : key.slice(TAILWIND_PACKAGE_NAME.length + 1)}`
    : `${NODE_MODULES_BASE}/${key}`;
  const slash = virtualPath.lastIndexOf('/');
  const base = slash > 0 ? virtualPath.slice(0, slash) : '/';
  return { path: virtualPath, base };
}

/**
 * `loadStylesheet` implementation for Tailwind's `compile`.
 * Serves bundled Tailwind CSS and throws for any other id so a missing
 * file cannot be mistaken for an empty sheet.
 */
export function loadBundledTailwindStylesheet(id: string, base: string): BundledStylesheet {
  const key = resolveBundledStylesheetId(id, base);
  if (!Object.prototype.hasOwnProperty.call(TAILWIND_STYLESHEETS, key)) {
    throw new Error(
      `Unexpected stylesheet "${id}" (base "${base}", resolved "${key}"). ` +
      `Server CSS generation only includes Tailwind ${TAILWIND_STYLESHEET_VERSION} stylesheets bundled at build time. ` +
      'Regenerate them with npm run generate:tailwind-stylesheets.',
    );
  }

  const content = TAILWIND_STYLESHEETS[key];
  const location = stylesheetLocation(key);
  return { path: location.path, base: location.base, content };
}

/**
 * Compiler used by server-side CSS generation. The Tailwind index CSS and
 * every stylesheet it can import are already in memory.
 */
export async function getBundledTailwindCompiler(): Promise<TailwindCompiler> {
  if (compilerCache) return compilerCache;

  // Register custom variants (current:, disabled:) so classes like
  // `current:opacity-100` compile — same registration as the client generator
  // and app/globals.css.
  const input = `${TAILWIND_INDEX_CSS}\n${TAILWIND_CUSTOM_VARIANTS}\n`;
  compilerCache = await compile(input, {
    base: TAILWIND_STYLESHEET_BASE,
    async loadStylesheet(id: string, base: string) {
      return loadBundledTailwindStylesheet(id, base);
    },
  });

  return compilerCache;
}
