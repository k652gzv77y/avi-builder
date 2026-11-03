import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from 'tailwindcss';
import { TAILWIND_CUSTOM_VARIANTS } from '@/lib/tailwind-custom-variants';
import {
  TAILWIND_INDEX_CSS,
  TAILWIND_STYLESHEET_BASE,
} from '@/lib/server/generated/tailwind-stylesheets';
import {
  getBundledTailwindCompiler,
  loadBundledTailwindStylesheet,
} from '@/lib/server/tailwind-stylesheets';

const nodeRequire = createRequire(join(process.cwd(), 'package.json'));

const CLASSES = ['flex', 'p-4', 'text-red-500', 'current:opacity-100', 'md:hidden', 'bg-[#35b7d4]'];

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

test('bundled index CSS matches the installed Tailwind package', () => {
  const indexPath = nodeRequire.resolve('tailwindcss/index.css');
  const onDisk = readFileSync(indexPath, 'utf8');
  const bundled = loadBundledTailwindStylesheet('tailwindcss', TAILWIND_STYLESHEET_BASE);

  assert.equal(bundled.content, onDisk);
  assert.equal(TAILWIND_INDEX_CSS, onDisk);
  assert.match(bundled.content, /@tailwind utilities/);
});

test('known Tailwind stylesheet ids are served from the bundle', () => {
  const theme = loadBundledTailwindStylesheet('./theme.css', TAILWIND_STYLESHEET_BASE);
  assert.match(theme.content, /@theme default/);
  assert.equal(theme.base, TAILWIND_STYLESHEET_BASE);
  assert.equal(theme.path, `${TAILWIND_STYLESHEET_BASE}/theme.css`);

  const onDisk = readFileSync(nodeRequire.resolve('tailwindcss/theme.css'), 'utf8');
  assert.equal(theme.content, onDisk);

  const preflight = loadBundledTailwindStylesheet('tailwindcss/preflight.css', '/anywhere');
  assert.match(preflight.content, /box-sizing:\s*border-box/);

  const utilities = loadBundledTailwindStylesheet('tailwindcss/utilities', TAILWIND_STYLESHEET_BASE);
  assert.match(utilities.content, /@tailwind utilities/);
});

test('unexpected stylesheet ids fail with a clear error', () => {
  assert.throws(
    () => loadBundledTailwindStylesheet('./custom.css', '/app'),
    /Unexpected stylesheet "\.\/custom.css" \(base "\/app", resolved "\/app\/custom.css"\)/,
  );

  assert.throws(
    () => loadBundledTailwindStylesheet('some-other-package/extra.css', TAILWIND_STYLESHEET_BASE),
    /Unexpected stylesheet "some-other-package\/extra.css"/,
  );
});

test('compilation obtains Tailwind CSS without reading node_modules', async () => {
  const cssGenerator = readSource('lib/server/cssGenerator.ts');
  const loader = readSource('lib/server/tailwind-stylesheets.ts');
  assert.doesNotMatch(cssGenerator, /node:fs/);
  assert.doesNotMatch(cssGenerator, /readFile\s*\(/);
  assert.match(cssGenerator, /getBundledTailwindCompiler/);
  assert.doesNotMatch(loader, /node:fs/);
  assert.doesNotMatch(loader, /readFile\s*\(/);

  const diskIndex = readFileSync(nodeRequire.resolve('tailwindcss/index.css'), 'utf8');
  let diskLoaderCalls = 0;
  const fromDisk = await compile(`${diskIndex}\n${TAILWIND_CUSTOM_VARIANTS}\n`, {
    base: '/tmp/not-a-real-project',
    async loadStylesheet() {
      diskLoaderCalls += 1;
      throw new Error('disk compiler tried to read a stylesheet');
    },
  });

  const bundled = await getBundledTailwindCompiler();
  assert.equal(diskLoaderCalls, 0);
  assert.equal(bundled.build(CLASSES), fromDisk.build(CLASSES));

  const css = bundled.build(CLASSES);
  assert.match(css, /\.flex\s*\{[^}]*display:\s*flex/);
  assert.match(css, /aria-current/);
  assert.match(css, /#35b7d4/i);

  const imported = await compile('@import "tailwindcss/theme.css";\n@import "tailwindcss/utilities.css";', {
    base: '/var/task',
    async loadStylesheet(id: string, base: string) {
      return loadBundledTailwindStylesheet(id, base);
    },
  });
  const importedCss = imported.build(['flex']);
  assert.match(importedCss, /\.flex\s*\{[^}]*display:\s*flex/);

  await assert.rejects(
    () => compile('@import "./not-tailwind.css";', {
      base: '/app',
      async loadStylesheet(id: string, base: string) {
        return loadBundledTailwindStylesheet(id, base);
      },
    }),
    /Unexpected stylesheet "\.\/not-tailwind\.css"/,
  );
});
