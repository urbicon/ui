import { describe, expect, it } from 'vitest';
import { percentFormatter } from './percent';

describe('percentFormatter', () => {
  it('lets the locale place the sign and the space before it', () => {
    expect(percentFormatter('en', 1)(57.7)).toBe('57.7%');
    expect(percentFormatter('de', 1)(57.7)).toBe('57,7\u00a0%');
  });

  it('formats the 0–100 value with exactly the given fraction digits', () => {
    expect(percentFormatter('en', 1)(50)).toBe('50.0%');
    expect(percentFormatter('en', 0)(64.5)).toBe('65%');
  });

  it('rounds a half-way share up, as its 0–100 value reads', () => {
    expect(percentFormatter('en', 1)(0.35)).toBe('0.4%');
    expect(percentFormatter('en', 1)(1.45)).toBe('1.5%');
  });
});
