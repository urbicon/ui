// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { resetMediaState, setMediaViewport } from '../../../../../scripts/vitest-match-media';

/**
 * The suite's `matchMedia` is the shared query-aware stub, not a flat `false`.
 * A flat `false` is a WRONG answer to `(min-width: 1px)`, and it let any test of
 * anything media-query-shaped pass without its branch ever running — so this
 * pins that the stub answers from a width, moves with it, and refuses a query
 * nobody taught it rather than answering `false`.
 */
describe('the matchMedia the blocks suite runs against', () => {
  afterEach(() => resetMediaState());

  it('answers width queries from the stubbed viewport, not with a flat false', () => {
    expect(window.matchMedia('(min-width: 1px)').matches).toBe(true);
    expect(window.matchMedia('(max-width: 639px)').matches).toBe(false);
  });

  it('flips live lists and fires change when the viewport moves', () => {
    const list = window.matchMedia('(max-width: 639px)');
    const seen: boolean[] = [];
    list.addEventListener('change', (ev) => seen.push((ev as MediaQueryListEvent).matches));

    setMediaViewport(390);

    expect(list.matches).toBe(true);
    expect(seen).toEqual([true]);
  });

  it('throws on a query it has no rule for', () => {
    expect(() => window.matchMedia('(pointer: coarse)')).toThrow(/no rule for/);
  });
});
