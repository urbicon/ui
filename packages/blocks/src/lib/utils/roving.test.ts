import { describe, expect, it } from 'vitest';
import { edgeEnabledIndex, nextEnabledIndex } from './roving';

// Pure index math for roving-focus navigation with disabled items. Runs in the
// default node env (no DOM). `disabledSet` builds the isDisabled predicate.
const disabledSet =
  (...disabled: number[]) =>
  (i: number) =>
    disabled.includes(i);
const none = () => false;

describe('nextEnabledIndex', () => {
  it('steps forward and backward within range', () => {
    expect(nextEnabledIndex(3, 0, 1, none)).toBe(1);
    expect(nextEnabledIndex(3, 1, 1, none)).toBe(2);
    expect(nextEnabledIndex(3, 1, -1, none)).toBe(0);
  });

  it('wraps around both ends', () => {
    expect(nextEnabledIndex(3, 2, 1, none)).toBe(0);
    expect(nextEnabledIndex(3, 0, -1, none)).toBe(2);
  });

  it('skips disabled items in the walk direction', () => {
    // 0 → (skip 1) → 2
    expect(nextEnabledIndex(3, 0, 1, disabledSet(1))).toBe(2);
    // 2 → (skip 1) → 0 backward
    expect(nextEnabledIndex(3, 2, -1, disabledSet(1))).toBe(0);
    // 0 → forward, 1 disabled, wraps skipping back to 0's own slot? 2 enabled
    expect(nextEnabledIndex(4, 1, 1, disabledSet(2, 3))).toBe(0);
  });

  it('anchors an out-of-range `from` (-1 = nothing active) to the leading edge', () => {
    expect(nextEnabledIndex(3, -1, 1, none)).toBe(0);
    expect(nextEnabledIndex(3, -1, -1, none)).toBe(2);
    // With the first item disabled, forward from nothing lands on index 1.
    expect(nextEnabledIndex(3, -1, 1, disabledSet(0))).toBe(1);
  });

  it('returns `from` when every other item is disabled (no-op move)', () => {
    expect(nextEnabledIndex(3, 0, 1, disabledSet(1, 2))).toBe(0);
    expect(nextEnabledIndex(3, 2, -1, disabledSet(0, 1))).toBe(2);
  });

  it('returns -1 when nothing is enabled or the list is empty', () => {
    expect(nextEnabledIndex(3, -1, 1, disabledSet(0, 1, 2))).toBe(-1);
    expect(nextEnabledIndex(0, -1, 1, none)).toBe(-1);
  });
});

describe('edgeEnabledIndex', () => {
  it('finds the first enabled item from each edge', () => {
    expect(edgeEnabledIndex(3, 1, none)).toBe(0);
    expect(edgeEnabledIndex(3, -1, none)).toBe(2);
  });

  it('skips disabled items at the edges', () => {
    expect(edgeEnabledIndex(3, 1, disabledSet(0))).toBe(1);
    expect(edgeEnabledIndex(3, -1, disabledSet(2))).toBe(1);
  });

  it('returns -1 when every item is disabled', () => {
    expect(edgeEnabledIndex(3, 1, disabledSet(0, 1, 2))).toBe(-1);
    expect(edgeEnabledIndex(0, 1, none)).toBe(-1);
  });
});
