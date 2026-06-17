import { describe, expect, it } from 'vitest';
import { id } from './id';

describe('id', () => {
  it('returns a string with default prefix "blocks-"', () => {
    const result = id();
    expect(result).toMatch(/^blocks-[a-z0-9]{7}$/);
  });

  it('returns a string with custom prefix', () => {
    const result = id('custom-');
    expect(result).toMatch(/^custom-[a-z0-9]{7}$/);
  });

  it('returns unique ids on each call', () => {
    const ids = new Set([id(), id(), id()]);
    expect(ids.size).toBe(3);
  });
});
