import { describe, expect, it } from 'vitest';
import { headingTag } from './heading';

describe('headingTag', () => {
  it('names the heading of the requested rank', () => {
    expect([1, 2, 3, 4, 5, 6].map(headingTag)).toEqual(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  });

  it('clamps a rank outside 1..6 to the nearest heading', () => {
    expect(headingTag(0)).toBe('h1');
    expect(headingTag(-3)).toBe('h1');
    expect(headingTag(7)).toBe('h6');
    expect(headingTag(99)).toBe('h6');
  });

  it('drops a fraction instead of emitting a non-heading tag', () => {
    expect(headingTag(2.5)).toBe('h2');
  });
});
