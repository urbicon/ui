import { describe, expect, it } from 'vitest';
import { timingSafeEqual, timingSafeEqualStrings } from './timing-safe.js';

describe('timingSafeEqual (bytes)', () => {
  it('returns true for identical byte arrays', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
  });

  it('returns false when content differs at any position', () => {
    // Every element is XOR-accumulated regardless of where the first mismatch
    // sits, so first/middle/last diffs must all be caught — the running time
    // does not leak how many leading bytes matched.
    expect(timingSafeEqual(new Uint8Array([9, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1, 9, 3]), new Uint8Array([1, 2, 3]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1, 2, 9]), new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it('returns false when lengths differ (the only short-circuit)', () => {
    // Length mismatch is the sole early return; a shorter and a longer operand
    // in either argument order must both fail.
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array(0), new Uint8Array([1]))).toBe(false);
  });

  it('treats two empty arrays as equal', () => {
    expect(timingSafeEqual(new Uint8Array(0), new Uint8Array(0))).toBe(true);
  });
});

describe('timingSafeEqualStrings', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqualStrings('abcdef', 'abcdef')).toBe(true);
  });

  it('returns false when lengths differ (either order)', () => {
    expect(timingSafeEqualStrings('abc', 'abcd')).toBe(false);
    expect(timingSafeEqualStrings('abcd', 'abc')).toBe(false);
    expect(timingSafeEqualStrings('', 'a')).toBe(false);
  });

  it('returns false when content differs at any position', () => {
    expect(timingSafeEqualStrings('abcdef', 'abcXef')).toBe(false);
    expect(timingSafeEqualStrings('Xbcdef', 'abcdef')).toBe(false);
    expect(timingSafeEqualStrings('abcdeX', 'abcdef')).toBe(false);
  });

  it('handles empty strings as equal', () => {
    expect(timingSafeEqualStrings('', '')).toBe(true);
  });
});
