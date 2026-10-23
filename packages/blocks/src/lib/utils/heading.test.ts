import { describe, expect, it } from 'vitest';
import { headingTag } from './heading';

/** A value TypeScript would refuse, as a plain-JavaScript or CMS caller passes it. */
const loose = (value: unknown) => value as number;

describe('headingTag', () => {
  it('names the heading of the requested rank', () => {
    expect([1, 2, 3, 4, 5, 6].map((level) => headingTag(level))).toEqual([
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6'
    ]);
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

  it('reads a level that is no number as the deepest rank, never as h1', () => {
    for (const level of [Number.NaN, undefined, null, '', ' ', false, true, [], {}, 'abc']) {
      expect(headingTag(loose(level)), String(level)).toBe('h6');
    }
    expect(headingTag(Number.POSITIVE_INFINITY)).toBe('h6');
    expect(headingTag(Number.NEGATIVE_INFINITY)).toBe('h1');
  });

  it('reads a numeric string as its number', () => {
    expect(headingTag(loose('2'))).toBe('h2');
  });

  it('places a heading offset ranks below the level it read', () => {
    expect(headingTag(2, { offset: 1 })).toBe('h3');
    expect(headingTag(6, { offset: 1 })).toBe('h6');
    expect(headingTag(loose('2'), { offset: 1 })).toBe('h3');
    expect(headingTag(loose(null), { offset: 1 })).toBe('h6');
    expect(headingTag(loose(''), { offset: 1 })).toBe('h6');
  });

  it('takes no offset from the index a callback position passes', () => {
    // @ts-expect-error the index is no options object
    expect([1, 2, 3, 4, 5, 6].map(headingTag)).toEqual(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  });
});
