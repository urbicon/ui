import { describe, expect, it } from 'vitest';
import { timingSafeEqual, timingSafeEqualStrings } from './timing-safe.js';

describe('timingSafeEqual (bytes)', () => {
  it('returns true for identical byte arrays', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
  });

  it('returns false when contents differ', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
  });

  it('returns false when lengths differ', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it('treats two empty arrays as equal', () => {
    expect(timingSafeEqual(new Uint8Array(0), new Uint8Array(0))).toBe(true);
  });
});

describe('timingSafeEqualStrings', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqualStrings('abcdef', 'abcdef')).toBe(true);
  });

  it('returns false when lengths differ', () => {
    expect(timingSafeEqualStrings('abc', 'abcd')).toBe(false);
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
