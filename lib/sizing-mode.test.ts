import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detectSizingMode } from './sizing-mode';

describe('detectSizingMode', () => {
  it('treats 100% and 1fr as fill', () => {
    assert.equal(detectSizingMode('100%', 'width'), 'fill');
    assert.equal(detectSizingMode('[100%]', 'height'), 'fill');
    assert.equal(detectSizingMode('1fr', 'width'), 'fill');
  });

  it('treats fit-content and auto as fit', () => {
    assert.equal(detectSizingMode('fit', 'width'), 'fit');
    assert.equal(detectSizingMode('fit-content', 'height'), 'fit');
    assert.equal(detectSizingMode('auto', 'width'), 'fit');
  });

  it('treats viewport and percent values as relative', () => {
    assert.equal(detectSizingMode('100vw', 'width'), 'relative');
    assert.equal(detectSizingMode('80%', 'width'), 'relative');
    assert.equal(detectSizingMode('100svh', 'height'), 'relative');
  });

  it('treats numeric values as fixed', () => {
    assert.equal(detectSizingMode('1200', 'width'), 'fixed');
    assert.equal(detectSizingMode('40px', 'height'), 'fixed');
  });

  it('defaults empty width to fill and empty height to fit', () => {
    assert.equal(detectSizingMode('', 'width'), 'fill');
    assert.equal(detectSizingMode('', 'height'), 'fit');
  });
});
