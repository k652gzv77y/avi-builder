import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Layer } from '@/types';
import { getInheritedValue, setBreakpointClass } from '@/lib/tailwind-class-mapper';
import { editorBreakpointLabel } from '@/lib/layout-model';
import {
  activeBreakpointAfterDelete,
  addBreakpointPreset,
  breakpointForWidth,
  breakpointLabel,
  cascadeOrder,
  createBreakpoint,
  defaultBreakpointCatalog,
  deleteBreakpoint,
  deriveBreakpointRanges,
  duplicateBreakpoint,
  formatBreakpointRange,
  getBreakpointPrefix,
  inheritanceChain,
  moveBreakpoint,
  normalizeBreakpointCatalog,
  prefixUnprefixedText,
  renameBreakpoint,
  resizeBreakpointWidth,
  resolveBreakpointCatalog,
  rewriteClassText,
  rewriteLayers,
  setClientBreakpointCatalog,
  setPrimaryBreakpoint,
  splitResponsivePrefix,
  swiperMinWidthEntries,
  updateBreakpointRange,
  viewportRange,
  widthToBreakpoint,
} from '@/lib/breakpoint-utils';

function restoreCatalog() {
  setClientBreakpointCatalog(defaultBreakpointCatalog());
}

test('missing settings keep the desktop, tablet, and phone breakpoints', () => {
  const catalog = resolveBreakpointCatalog(undefined, undefined);
  assert.deepEqual(catalog.map((breakpoint) => breakpoint.id), ['desktop', 'tablet', 'mobile']);
  assert.equal(catalog.find((breakpoint) => breakpoint.id === 'desktop')?.primary, true);
  assert.equal(getBreakpointPrefix('desktop', catalog), '');
  assert.equal(getBreakpointPrefix('tablet', catalog), 'max-[1199px]:');
  assert.equal(getBreakpointPrefix('mobile', catalog), 'max-[809px]:');
  assert.equal(widthToBreakpoint(390, catalog), 'mobile');
  assert.equal(widthToBreakpoint(809, catalog), 'mobile');
  assert.equal(widthToBreakpoint(810, catalog), 'tablet');
  assert.equal(widthToBreakpoint(1199, catalog), 'tablet');
  assert.equal(widthToBreakpoint(1200, catalog), 'desktop');
  assert.equal(widthToBreakpoint(1600, catalog), 'desktop');
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
  assert.equal(wide?.width, 900);
  assert.equal(wide?.maxWidth, 1279);
  assert.equal(wide?.system, false);
  assert.equal(catalog.find((breakpoint) => breakpoint.id === 'desktop')?.width, 1280);
  assert.equal(catalog.find((breakpoint) => breakpoint.id === 'desktop')?.primary, true);
  assert.equal(catalog.find((breakpoint) => breakpoint.id === 'tablet')?.system, true);
  const resizedOnly = resolveBreakpointCatalog(undefined, [
    { id: 'desktop', label: 'Desktop', width: 1440, locked: true },
    { id: 'tablet', label: 'Tablet', width: 800, locked: true },
    { id: 'mobile', label: 'Phone', width: 390, locked: true },
  ]);
  assert.equal(resizedOnly.find((breakpoint) => breakpoint.id === 'desktop')?.width, 1440);
  assert.equal(resizedOnly.find((breakpoint) => breakpoint.id === 'tablet')?.width, 800);
  assert.equal(getBreakpointPrefix('tablet', resizedOnly), 'max-[1439px]:');
  assert.equal(getBreakpointPrefix('mobile', resizedOnly), 'max-[799px]:');
});

test('saved catalogs can rename and a deleted preset stays deleted', () => {
  const saved = normalizeBreakpointCatalog([
    { id: 'mobile', name: 'Small', width: 360, minWidth: 0, maxWidth: 700, system: false },
    { id: 'bp-notreal', name: '', width: 10 },
  ]);
  assert.equal(saved.find((breakpoint) => breakpoint.id === 'mobile')?.name, 'Small');
  assert.equal(saved.find((breakpoint) => breakpoint.id === 'mobile')?.system, true);
  assert.equal(saved.find((breakpoint) => breakpoint.id === 'mobile')?.primary, true);
  assert.equal(saved.find((breakpoint) => breakpoint.id === 'mobile')?.maxWidth, null);
  assert.equal(saved.some((breakpoint) => breakpoint.id === 'desktop'), false);
  assert.equal(saved.some((breakpoint) => breakpoint.id === 'tablet'), false);
  assert.equal(saved.find((breakpoint) => breakpoint.id === 'bp-notreal')?.width, 320);
  assert.equal(saved.find((breakpoint) => breakpoint.id === 'bp-notreal')?.maxWidth, 359);

  let catalog = defaultBreakpointCatalog();
  catalog = renameBreakpoint(catalog, 'desktop', 'Large').catalog;
  assert.equal(catalog[0].name, 'Large');
  assert.equal(renameBreakpoint(catalog, 'desktop', '   ').error, 'Name is required.');

  catalog = moveBreakpoint(catalog, 'mobile', -1).catalog;
  assert.deepEqual(catalog.map((breakpoint) => breakpoint.id), ['desktop', 'mobile', 'tablet']);

  const removed = deleteBreakpoint(catalog, 'desktop');
  assert.match(removed.error ?? '', /primary breakpoint/);
  assert.equal(removed.catalog.length, 3);
});

test('custom breakpoints get a unique range and a max-width class prefix', () => {
  const first = createBreakpoint(defaultBreakpointCatalog(), { name: 'Wide', width: 900 });
  assert.equal(first.error, undefined);
  assert.equal(first.created?.system, false);
  assert.equal(first.created?.width, 900);
  assert.equal(first.created?.maxWidth, 1199);
  assert.equal(getBreakpointPrefix(first.created!.id, first.catalog), 'max-[1199px]:');
  assert.equal(formatBreakpointRange(first.created!), '900–1199');

  const edited = updateBreakpointRange(first.catalog, 'tablet', { maxWidth: 1100 });
  assert.deepEqual(edited.prefixRewrite, { from: 'max-[899px]:', to: 'max-[1100px]:' });
  assert.equal(getBreakpointPrefix('tablet', edited.catalog), 'max-[1100px]:');

  const restored = updateBreakpointRange(edited.catalog, 'tablet', { maxWidth: 1023 });
  assert.deepEqual(restored.prefixRewrite, { from: 'max-[1100px]:', to: 'max-lg:' });

  const clash = updateBreakpointRange(first.catalog, 'tablet', { maxWidth: 1199 });
  assert.match(clash.error ?? '', /max width/);
});

test('width resolution and inheritance follow ranges derived from frame widths', () => {
  const catalog = createBreakpoint(defaultBreakpointCatalog(), {
    name: 'Large phone',
    width: 480,
  }).catalog;
  assert.equal(breakpointForWidth(400, catalog).id, 'mobile');
  assert.equal(breakpointForWidth(480, catalog).name, 'Large phone');
  assert.equal(breakpointForWidth(700, catalog).name, 'Large phone');
  assert.equal(breakpointForWidth(900, catalog).id, 'tablet');
  assert.equal(breakpointForWidth(1400, catalog).id, 'desktop');
  const narrow = catalog.find((breakpoint) => breakpoint.name === 'Large phone');
  assert.ok(narrow);
  assert.deepEqual(viewportRange(narrow, catalog), { min: 480, max: 809 });
  const mobileChain = inheritanceChain('mobile', catalog);
  assert.equal(mobileChain[0], 'mobile');
  assert.ok(mobileChain.includes('tablet'));
  assert.equal(mobileChain[mobileChain.length - 1], 'desktop');
  assert.equal(mobileChain.includes(narrow.id), true);
  assert.equal(inheritanceChain(narrow.id, catalog).includes('mobile'), false);
  assert.equal(inheritanceChain(narrow.id, catalog).includes('tablet'), true);
  assert.deepEqual(cascadeOrder('tablet', catalog)[0], 'desktop');
  assert.equal(cascadeOrder('tablet', catalog).at(-1), 'tablet');
  assert.deepEqual(
    swiperMinWidthEntries(defaultBreakpointCatalog()).map((entry) => `${entry.min}:${entry.id}`),
    ['0:mobile', '810:tablet', '1200:desktop'],
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

test('renaming a breakpoint updates every label looked up by id', () => {
  const created = createBreakpoint(defaultBreakpointCatalog(), {
    name: 'QA Wide',
    maxWidth: 1400,
    width: 1400,
  });
  const id = created.created!.id;
  const capturedName = created.created!.name;
  setClientBreakpointCatalog(created.catalog);
  try {
    assert.equal(breakpointLabel(id), 'QA Wide');
    assert.equal(editorBreakpointLabel(id), 'QA Wide');

    const renamed = renameBreakpoint(created.catalog, id, 'QA Wide 2');
    assert.equal(renamed.error, undefined);
    assert.equal(renamed.catalog.find((breakpoint) => breakpoint.id === id)?.name, 'QA Wide 2');
    assert.equal(capturedName, 'QA Wide');
    assert.equal(breakpointLabel(id, renamed.catalog), 'QA Wide 2');
    assert.equal(editorBreakpointLabel(id, renamed.catalog), 'QA Wide 2');
    assert.notEqual(breakpointLabel(id, renamed.catalog), capturedName);

    // A previously published catalog must not win when the caller passes the renamed one.
    assert.equal(breakpointLabel(id), 'QA Wide');
    assert.equal(editorBreakpointLabel(id, renamed.catalog), 'QA Wide 2');

    setClientBreakpointCatalog(renamed.catalog);
    assert.equal(breakpointLabel(id), 'QA Wide 2');
    assert.equal(editorBreakpointLabel(id), 'QA Wide 2');
    assert.equal(
      renamed.catalog.map((breakpoint) => breakpointLabel(breakpoint.id, renamed.catalog)).join('|'),
      renamed.catalog.map((breakpoint) => breakpoint.name).join('|'),
    );
  } finally {
    restoreCatalog();
  }
});

test('deleting the active custom breakpoint falls back to desktop', () => {
  const created = createBreakpoint(defaultBreakpointCatalog(), {
    name: 'QA Wide',
    maxWidth: 1400,
    width: 1400,
  });
  const id = created.created!.id;
  const reordered = moveBreakpoint(created.catalog, 'desktop', 1).catalog;
  assert.equal(reordered[0]?.id, 'tablet');
  assert.equal(reordered.some((breakpoint) => breakpoint.id === id), true);

  const removed = deleteBreakpoint(reordered, id);
  assert.equal(removed.error, undefined);
  assert.equal(removed.catalog.some((breakpoint) => breakpoint.id === id), false);
  assert.equal(removed.catalog.some((breakpoint) => breakpoint.id === 'tablet'), true);
  assert.equal(removed.catalog.some((breakpoint) => breakpoint.id === 'mobile'), true);
  assert.equal(removed.catalog.some((breakpoint) => breakpoint.id === 'desktop'), true);
  assert.notEqual(removed.catalog[0]?.id, 'desktop');

  const next = activeBreakpointAfterDelete(removed.catalog, id, id);
  assert.equal(next?.id, 'desktop');
  assert.equal(next?.name, 'Desktop');

  const renamedBase = renameBreakpoint(removed.catalog, 'desktop', 'Primary screen').catalog;
  const namedNext = activeBreakpointAfterDelete(renamedBase, id, id);
  assert.equal(namedNext?.id, 'desktop');
  assert.equal(breakpointLabel(namedNext!.id, renamedBase), 'Primary screen');

  const kept = activeBreakpointAfterDelete(removed.catalog, id, 'tablet');
  assert.equal(kept?.id, 'tablet');
  assert.equal(breakpointLabel(kept!.id, removed.catalog), 'Tablet');

  const preset = deleteBreakpoint(created.catalog, 'tablet');
  assert.equal(preset.error, undefined);
  assert.equal(preset.catalog.some((breakpoint) => breakpoint.id === 'tablet'), false);
  assert.equal(preset.catalog.some((breakpoint) => breakpoint.id === 'desktop'), true);
  assert.equal(preset.catalog.find((breakpoint) => breakpoint.id === 'desktop')?.primary, true);
});

test('custom breakpoint overrides inherit from wider ranges and round-trip through classes', () => {
  const catalog = createBreakpoint(defaultBreakpointCatalog(), {
    name: 'Large phone',
    width: 480,
  }).catalog;
  setClientBreakpointCatalog(catalog);
  try {
    const wideId = catalog.find((breakpoint) => breakpoint.name === 'Large phone')!.id;
    assert.equal(getBreakpointPrefix(wideId, catalog), 'max-[809px]:');
    assert.equal(splitResponsivePrefix('max-[809px]:w-[90px]', catalog).breakpoint, wideId);
    assert.equal(splitResponsivePrefix('max-lg:w-[80px]', catalog).breakpoint, 'tablet');
    assert.equal(splitResponsivePrefix('w-[100px]', catalog).breakpoint, 'desktop');

    const classes = ['w-[100px]', 'max-lg:w-[80px]', 'max-[809px]:w-[90px]'];
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
    assert.ok(written.includes('max-[809px]:w-[70px]'));
    assert.ok(written.includes('w-[100px]'));
  } finally {
    restoreCatalog();
  }
});

test('adding, duplicating, resizing, and deleting frames derive ranges from widths', () => {
  const derived = deriveBreakpointRanges(defaultBreakpointCatalog());
  assert.deepEqual(viewportRange(derived.find((breakpoint) => breakpoint.id === 'mobile')!, derived), { min: 0, max: 809 });
  assert.deepEqual(viewportRange(derived.find((breakpoint) => breakpoint.id === 'tablet')!, derived), { min: 810, max: 1199 });
  assert.deepEqual(viewportRange(derived.find((breakpoint) => breakpoint.id === 'desktop')!, derived), { min: 1200, max: null });

  const withoutPhone = deleteBreakpoint(defaultBreakpointCatalog(), 'mobile');
  assert.equal(withoutPhone.error, undefined);
  const phoneAgain = addBreakpointPreset(withoutPhone.catalog, 'phone');
  assert.equal(phoneAgain.created?.id, 'mobile');
  assert.equal(phoneAgain.created?.width, 390);
  assert.equal(addBreakpointPreset(phoneAgain.catalog, 'phone').error, 'Phone is already on the canvas.');

  const custom = addBreakpointPreset(defaultBreakpointCatalog(), 'custom');
  assert.equal(custom.created?.name, 'Breakpoint');
  assert.equal(custom.created?.primary, false);
  assert.ok((custom.created?.width ?? 0) > 0);

  const copy = duplicateBreakpoint(defaultBreakpointCatalog(), 'tablet');
  assert.equal(copy.error, undefined);
  assert.equal(copy.created?.name, 'Tablet copy');
  assert.notEqual(copy.created?.width, 810);
  const copyIndex = copy.catalog.findIndex((breakpoint) => breakpoint.id === copy.created?.id);
  assert.equal(copy.catalog[copyIndex - 1]?.id, 'tablet');

  const resized = resizeBreakpointWidth(defaultBreakpointCatalog(), 'tablet', 760);
  assert.equal(resized.catalog.find((breakpoint) => breakpoint.id === 'tablet')?.width, 760);
  assert.equal(resized.catalog.find((breakpoint) => breakpoint.id === 'mobile')?.maxWidth, 759);
  assert.equal(getBreakpointPrefix('mobile', resized.catalog), 'max-[759px]:');
  assert.deepEqual(resized.prefixRewrites?.find((rewrite) => rewrite.from === 'max-[809px]:'), {
    from: 'max-[809px]:',
    to: 'max-[759px]:',
  });

  const primary = setPrimaryBreakpoint(defaultBreakpointCatalog(), 'tablet');
  assert.equal(primary.catalog.find((breakpoint) => breakpoint.id === 'tablet')?.primary, true);
  assert.equal(getBreakpointPrefix('tablet', primary.catalog), '');
  assert.equal(getBreakpointPrefix('desktop', primary.catalog), 'min-[1200px]:');
  assert.equal(primary.demoteBaseTo, 'min-[1200px]:');
  assert.equal(prefixUnprefixedText('flex w-[10px] max-md:hidden', 'min-[1200px]:'), 'min-[1200px]:flex min-[1200px]:w-[10px] max-md:hidden');
  assert.match(deleteBreakpoint(primary.catalog, 'tablet').error ?? '', /primary breakpoint/);
});
