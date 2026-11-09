import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Layer } from '@/types';
import { getInheritedValue, setBreakpointClass } from '@/lib/tailwind-class-mapper';
import {
  breakpointForWidth,
  cascadeOrder,
  createBreakpoint,
  defaultBreakpointCatalog,
  deleteBreakpoint,
  formatBreakpointRange,
  getBreakpointPrefix,
  inheritanceChain,
  moveBreakpoint,
  normalizeBreakpointCatalog,
  renameBreakpoint,
  resolveBreakpointCatalog,
  rewriteClassText,
  rewriteLayers,
  setClientBreakpointCatalog,
  splitResponsivePrefix,
  swiperMinWidthEntries,
  updateBreakpointRange,
  widthToBreakpoint,
} from '@/lib/breakpoint-utils';

function restoreCatalog() {
  setClientBreakpointCatalog(defaultBreakpointCatalog());
}

test('missing settings keep the desktop, tablet, and phone breakpoints', () => {
  const catalog = resolveBreakpointCatalog(undefined, undefined);
  assert.deepEqual(catalog.map((breakpoint) => breakpoint.id), ['desktop', 'tablet', 'mobile']);
  assert.equal(getBreakpointPrefix('desktop', catalog), '');
  assert.equal(getBreakpointPrefix('tablet', catalog), 'max-lg:');
  assert.equal(getBreakpointPrefix('mobile', catalog), 'max-md:');
  assert.equal(widthToBreakpoint(390, catalog), 'mobile');
  assert.equal(widthToBreakpoint(810, catalog), 'tablet');
  assert.equal(widthToBreakpoint(1200, catalog), 'desktop');
  assert.equal(widthToBreakpoint(767, catalog), 'mobile');
  assert.equal(widthToBreakpoint(768, catalog), 'tablet');
  assert.equal(widthToBreakpoint(1023, catalog), 'tablet');
  assert.equal(widthToBreakpoint(1024, catalog), 'desktop');
});

test('legacy custom canvas frames become breakpoints and the built-ins stay', () => {
  const catalog = resolveBreakpointCatalog(undefined, [
    { id: 'desktop', label: 'Desktop', width: 1280, locked: true },
    { id: 'custom-10', label: 'Wide', width: 900 },
    { id: 'tablet', label: 'Tablet', width: 810, locked: true },
    { id: 'mobile', label: 'Phone', width: 390, locked: true },
  ]);
  assert.deepEqual(catalog.map((breakpoint) => breakpoint.id), ['desktop', 'custom-10', 'tablet', 'mobile']);
  const wide = catalog.find((breakpoint) => breakpoint.id === 'custom-10');
  assert.equal(wide?.name, 'Wide');
  assert.equal(wide?.maxWidth, 900);
  assert.equal(wide?.system, false);
  assert.equal(catalog.find((breakpoint) => breakpoint.id === 'desktop')?.width, 1280);
  assert.equal(catalog.find((breakpoint) => breakpoint.id === 'tablet')?.system, true);
  const resizedOnly = resolveBreakpointCatalog(undefined, [
    { id: 'desktop', label: 'Desktop', width: 1440, locked: true },
    { id: 'tablet', label: 'Tablet', width: 800, locked: true },
    { id: 'mobile', label: 'Phone', width: 390, locked: true },
  ]);
  assert.equal(resizedOnly.find((breakpoint) => breakpoint.id === 'desktop')?.width, 1440);
  assert.equal(resizedOnly.find((breakpoint) => breakpoint.id === 'tablet')?.width, 800);
  assert.equal(getBreakpointPrefix('tablet', resizedOnly), 'max-lg:');
});

test('saved catalogs can rename, reorder, and edit ranges without dropping defaults', () => {
  const saved = normalizeBreakpointCatalog([
    { id: 'mobile', name: 'Small', width: 360, minWidth: 0, maxWidth: 700, system: false },
    { id: 'bp-notreal', name: '', width: 10 },
  ]);
  assert.equal(saved.find((breakpoint) => breakpoint.id === 'mobile')?.name, 'Small');
  assert.equal(saved.find((breakpoint) => breakpoint.id === 'mobile')?.maxWidth, 700);
  assert.equal(saved.find((breakpoint) => breakpoint.id === 'mobile')?.system, true);
  assert.ok(saved.some((breakpoint) => breakpoint.id === 'desktop'));
  assert.ok(saved.some((breakpoint) => breakpoint.id === 'tablet'));
  assert.equal(saved.find((breakpoint) => breakpoint.id === 'bp-notreal')?.maxWidth != null, true);

  let catalog = defaultBreakpointCatalog();
  catalog = renameBreakpoint(catalog, 'desktop', 'Large').catalog;
  assert.equal(catalog[0].name, 'Large');
  assert.equal(renameBreakpoint(catalog, 'desktop', '   ').error, 'Name is required.');

  catalog = moveBreakpoint(catalog, 'mobile', -1).catalog;
  assert.deepEqual(catalog.map((breakpoint) => breakpoint.id), ['desktop', 'mobile', 'tablet']);

  const removed = deleteBreakpoint(catalog, 'desktop');
  assert.match(removed.error ?? '', /stay in the project/);
  assert.equal(removed.catalog.length, 3);
});

test('custom breakpoints get a unique range and a max-width class prefix', () => {
  const first = createBreakpoint(defaultBreakpointCatalog(), { name: 'Wide', maxWidth: 900, width: 900 });
  assert.equal(first.error, undefined);
  assert.equal(first.created?.system, false);
  assert.equal(getBreakpointPrefix(first.created!.id, first.catalog), 'max-[900px]:');
  assert.equal(formatBreakpointRange(first.created!), '≤900');

  const duplicate = createBreakpoint(first.catalog, { name: 'Again', maxWidth: 900 });
  assert.match(duplicate.error ?? '', /max width/);

  const edited = updateBreakpointRange(first.catalog, 'tablet', { maxWidth: 1100 });
  assert.deepEqual(edited.prefixRewrite, { from: 'max-lg:', to: 'max-[1100px]:' });
  assert.equal(getBreakpointPrefix('tablet', edited.catalog), 'max-[1100px]:');

  const restored = updateBreakpointRange(edited.catalog, 'tablet', { maxWidth: 1023 });
  assert.deepEqual(restored.prefixRewrite, { from: 'max-[1100px]:', to: 'max-lg:' });

  const clash = updateBreakpointRange(first.catalog, 'tablet', { maxWidth: 900 });
  assert.match(clash.error ?? '', /max width/);
});

test('width resolution and inheritance follow min and max ranges', () => {
  const catalog = createBreakpoint(defaultBreakpointCatalog(), {
    name: 'Large phone',
    minWidth: 0,
    maxWidth: 480,
    width: 480,
  }).catalog;
  assert.equal(breakpointForWidth(400, catalog).name, 'Large phone');
  assert.equal(breakpointForWidth(600, catalog).id, 'mobile');
  assert.equal(breakpointForWidth(900, catalog).id, 'tablet');
  assert.equal(breakpointForWidth(1400, catalog).id, 'desktop');
  const narrow = catalog.find((breakpoint) => breakpoint.name === 'Large phone');
  assert.ok(narrow);
  const mobileChain = inheritanceChain('mobile', catalog);
  assert.equal(mobileChain[0], 'mobile');
  assert.ok(mobileChain.includes('tablet'));
  assert.equal(mobileChain[mobileChain.length - 1], 'desktop');
  assert.equal(mobileChain.includes(narrow.id), false);
  assert.equal(inheritanceChain(narrow.id, catalog).includes('mobile'), true);
  assert.deepEqual(cascadeOrder('tablet', catalog)[0], 'desktop');
  assert.equal(cascadeOrder('tablet', catalog).at(-1), 'tablet');
  assert.deepEqual(
    swiperMinWidthEntries(defaultBreakpointCatalog()).map((entry) => `${entry.min}:${entry.id}`),
    ['0:mobile', '768:tablet', '1024:desktop'],
  );
});

test('range edits rewrite stored classes and leave other breakpoints alone', () => {
  const source = 'flex max-lg:flex-col max-lg:hover:gap-[8px] max-md:hidden w-[10px]';
  assert.equal(
    rewriteClassText(source, 'max-lg:', 'max-[1100px]:'),
    'flex max-[1100px]:flex-col max-[1100px]:hover:gap-[8px] max-md:hidden w-[10px]',
  );
  assert.equal(rewriteClassText(source, 'max-lg:', 'max-lg:'), source);

  const layers: Layer[] = [{
    id: 'parent',
    name: 'div',
    classes: 'max-lg:flex-col',
    textStyles: { bold: { classes: 'max-lg:text-[20px]' } },
    styleOverrides: { classes: 'max-lg:p-[8px]' },
    children: [{ id: 'child', name: 'div', classes: ['max-md:hidden', 'max-lg:grid'] }],
  }];
  const rewritten = rewriteLayers(layers, 'max-lg:', 'max-[1100px]:');
  assert.equal(rewritten.changed, true);
  assert.equal(rewritten.layers[0].classes, 'max-[1100px]:flex-col');
  assert.equal(rewritten.layers[0].textStyles?.bold.classes, 'max-[1100px]:text-[20px]');
  assert.equal(rewritten.layers[0].styleOverrides?.classes, 'max-[1100px]:p-[8px]');
  assert.deepEqual(rewritten.layers[0].children?.[0].classes, ['max-md:hidden', 'max-[1100px]:grid']);
});

test('custom breakpoint overrides inherit from wider ranges and round-trip through classes', () => {
  const catalog = createBreakpoint(defaultBreakpointCatalog(), {
    name: 'Wide',
    maxWidth: 900,
    width: 900,
  }).catalog;
  setClientBreakpointCatalog(catalog);
  try {
    const wideId = catalog.find((breakpoint) => breakpoint.name === 'Wide')!.id;
    assert.equal(splitResponsivePrefix('max-[900px]:w-[90px]', catalog).breakpoint, wideId);
    assert.equal(splitResponsivePrefix('max-lg:w-[80px]', catalog).breakpoint, 'tablet');
    assert.equal(splitResponsivePrefix('w-[100px]', catalog).breakpoint, 'desktop');

    const classes = ['w-[100px]', 'max-lg:w-[80px]', 'max-[900px]:w-[90px]'];
    const wide = getInheritedValue(classes, 'width', wideId);
    assert.equal(wide.value, 'w-[90px]');
    assert.equal(wide.source, wideId);

    const tablet = getInheritedValue(classes, 'width', 'tablet');
    assert.equal(tablet.value, 'w-[80px]');
    assert.equal(tablet.source, 'tablet');

    const phone = getInheritedValue(classes, 'width', 'mobile');
    assert.equal(phone.value, 'w-[90px]');
    assert.equal(phone.source, wideId);

    const written = setBreakpointClass(['w-[100px]'], 'width', 'w-[70px]', wideId);
    assert.ok(written.includes('max-[900px]:w-[70px]'));
    assert.ok(written.includes('w-[100px]'));
  } finally {
    restoreCatalog();
  }
});
