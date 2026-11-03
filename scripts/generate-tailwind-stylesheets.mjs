/**
 * Bundle Tailwind's stylesheets into a TypeScript module.
 *
 * Server CSS generation used to read `node_modules/tailwindcss/index.css`
 * (and any `@import` it pulled in) at request time. Cloudflare Workers do
 * not have that tree on disk, so the read throws ENOENT and
 * `/api/css/generate-pages` returns 500. This script copies the CSS into
 * source so the bundler ships the text with the worker.
 *
 * Usage: npm run generate:tailwind-stylesheets
 * Also runs from `prebuild`, `predev`, and `build:worker`.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { stderr, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(repoRoot, 'package.json'));
const outFile = join(repoRoot, 'lib/server/generated/tailwind-stylesheets.ts');

const IMPORT_RE = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?/g;

function fail(message) {
  const error = new Error(message);
  stderr.write(`${error.message}\n`);
  throw error;
}

let pkgJsonPath;
try {
  pkgJsonPath = require.resolve('tailwindcss/package.json');
} catch {
  fail('tailwindcss is not installed. Install dependencies before generating stylesheets.');
}

const pkgRoot = dirname(pkgJsonPath);
const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));

if (!pkg.exports) {
  fail('tailwindcss package.json has no exports map.');
}

/** @type {Map<string, { abs: string, content: string, keys: Set<string> }>} */
const byAbs = new Map();

function defaultKey(abs) {
  const marker = `${sep}node_modules${sep}`;
  const idx = abs.lastIndexOf(marker);
  if (idx === -1) {
    fail(`Stylesheet is outside node_modules and cannot be bundled: ${abs}`);
  }
  return abs.slice(idx + marker.length).split(sep).join('/');
}

function resolveImport(spec, fromFile) {
  if (spec.startsWith('.')) {
    const abs = resolve(dirname(fromFile), spec);
    const candidates = abs.endsWith('.css') ? [abs] : [abs, `${abs}.css`];
    for (const candidate of candidates) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    fail(`Cannot resolve stylesheet "${spec}" from ${fromFile}`);
  }

  try {
    return require.resolve(spec, { paths: [dirname(fromFile)] });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`Cannot resolve stylesheet "${spec}" from ${fromFile}: ${reason}`);
  }
}

function walkImports(entry) {
  const stripped = entry.content.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of stripped.matchAll(IMPORT_RE)) {
    const spec = match[1];
    if (/^(?:data:|https?:|\/\/)/.test(spec)) continue;
    const child = ensureFile(resolveImport(spec, entry.abs));
    if (!spec.startsWith('.')) child.keys.add(spec);
  }
}

function ensureFile(abs) {
  const normalized = resolve(abs);
  const existing = byAbs.get(normalized);
  if (existing) return existing;

  if (!existsSync(normalized) || !statSync(normalized).isFile()) {
    fail(`Stylesheet not found: ${normalized}`);
  }

  const entry = {
    abs: normalized,
    content: readFileSync(normalized, 'utf8'),
    keys: new Set([defaultKey(normalized)]),
  };
  byAbs.set(normalized, entry);
  walkImports(entry);
  return entry;
}

function collectCssExports(node, subpath, found) {
  if (typeof node === 'string') {
    if (node.endsWith('.css')) found.set(subpath, node);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('.')) collectCssExports(value, key, found);
    else collectCssExports(value, subpath, found);
  }
}

/** @type {Map<string, string>} */
const cssExports = new Map();
collectCssExports(pkg.exports, '.', cssExports);

for (const [subpath, relTarget] of cssExports) {
  const entry = ensureFile(resolve(pkgRoot, relTarget));
  const specifier = subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`;
  entry.keys.add(specifier);
}

for (const name of readdirSync(pkgRoot)) {
  if (name.endsWith('.css')) ensureFile(join(pkgRoot, name));
}

const keyOwner = new Map();
for (const entry of byAbs.values()) {
  for (const key of entry.keys) {
    const owner = keyOwner.get(key);
    if (owner && owner !== entry.abs) {
      fail(`Stylesheet id "${key}" maps to both ${owner} and ${entry.abs}`);
    }
    keyOwner.set(key, entry.abs);
  }
}

const indexEntry = [...byAbs.values()].find((entry) => entry.keys.has(pkg.name));
if (!indexEntry) {
  fail(`No bundled stylesheet is registered as "${pkg.name}".`);
}

const usedNames = new Set();
function constNameFor(abs) {
  const parts = basename(abs, '.css').split(/[^A-Za-z0-9]+/).filter(Boolean);
  let name = parts.map((part, index) => {
    const lower = part.toLowerCase();
    if (index === 0) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join('') + 'Css';
  if (!/^[A-Za-z_]/.test(name)) name = `sheet${name}`;

  let unique = name;
  let suffix = 2;
  while (usedNames.has(unique)) {
    unique = `${name}${suffix}`;
    suffix += 1;
  }
  usedNames.add(unique);
  return unique;
}

const files = [...byAbs.values()]
  .sort((a, b) => defaultKey(a.abs).localeCompare(defaultKey(b.abs)))
  .map((entry) => ({ ...entry, constName: constNameFor(entry.abs) }));

const indexConst = files.find((file) => file.abs === indexEntry.abs)?.constName;
if (!indexConst) fail('Failed to name the Tailwind index stylesheet.');

const lines = [
  '/* eslint-disable */',
  '/**',
  ' * Bundled Tailwind stylesheets for server-side CSS generation.',
  ' *',
  ' * Generated by scripts/generate-tailwind-stylesheets.mjs. Do not edit by hand.',
  ' * Workers do not ship node_modules, so the compiler loads these strings',
  ' * instead of reading tailwindcss CSS files from disk.',
  ' *',
  ` * Source: ${pkg.name}@${pkg.version}`,
  ' */',
  '',
];

for (const file of files) {
  lines.push(`const ${file.constName} = ${JSON.stringify(file.content)};`);
  lines.push('');
}

lines.push(`export const TAILWIND_PACKAGE_NAME = ${JSON.stringify(pkg.name)};`);
lines.push(`export const TAILWIND_STYLESHEET_VERSION = ${JSON.stringify(pkg.version)};`);
lines.push(`export const TAILWIND_STYLESHEET_BASE = ${JSON.stringify(`/${pkg.name}`)};`);
lines.push('');
lines.push(`export const TAILWIND_INDEX_CSS = ${indexConst};`);
lines.push('');
lines.push('export const TAILWIND_STYLESHEETS: Record<string, string> = {');

const keys = [...keyOwner.keys()].sort((a, b) => a.localeCompare(b));
for (const key of keys) {
  const file = files.find((entry) => entry.abs === keyOwner.get(key));
  if (!file) fail(`Missing stylesheet entry for "${key}".`);
  lines.push(`  ${JSON.stringify(key)}: ${file.constName},`);
}

lines.push('};');
lines.push('');

const next = lines.join('\n');
mkdirSync(dirname(outFile), { recursive: true });

const previous = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
if (previous === next) {
  stdout.write(`Tailwind stylesheets unchanged (${pkg.name}@${pkg.version}).\n`);
} else {
  writeFileSync(outFile, next);
  stdout.write(`Wrote ${outFile} (${pkg.name}@${pkg.version}, ${keys.length} ids).\n`);
}
