import { describe, expect, it } from 'vitest';
import { clampRatio, parseLimit, ratioFromPointer, resolveDragRatio } from './split-pane.utils';

// Pure geometry — the resize math the `.svelte` shell delegates to. Runs in the
// node environment (no jsdom): these are total functions over numbers/strings.

const rect = (
  over: Partial<{ left: number; top: number; width: number; height: number }> = {}
) => ({
  left: 0,
  top: 0,
  width: 1000,
  height: 500,
  ...over
});

describe('parseLimit', () => {
  it('parses percentage strings without needing a container measurement', () => {
    expect(parseLimit('20%', 0)).toBe(0.2);
    expect(parseLimit('90%', 999)).toBe(0.9);
    expect(parseLimit('  30% ', 0)).toBe(0.3); // tolerates surrounding whitespace
  });

  it('clamps out-of-range percentages into [0, 1]', () => {
    expect(parseLimit('-10%', 100)).toBe(0);
    expect(parseLimit('150%', 100)).toBe(1);
  });

  it('divides pixel limits by the container size', () => {
    expect(parseLimit(200, 1000)).toBe(0.2);
    expect(parseLimit('200', 1000)).toBe(0.2); // bare numeric string == px
    expect(parseLimit(800, 1000)).toBe(0.8);
  });

  it('returns null for a pixel limit when the container is unmeasured', () => {
    expect(parseLimit(200, 0)).toBeNull();
    expect(parseLimit('200', 0)).toBeNull();
    expect(parseLimit(200, -5)).toBeNull();
  });

  it('returns null for unparseable input', () => {
    expect(parseLimit('abc', 1000)).toBeNull();
    expect(parseLimit(Number.NaN, 1000)).toBeNull();
    expect(parseLimit(Number.POSITIVE_INFINITY, 1000)).toBeNull();
  });
});

describe('clampRatio', () => {
  it('leaves a ratio inside the window untouched', () => {
    expect(clampRatio(0.5, '10%', '90%', 1000)).toBe(0.5);
  });

  it('clamps below min and above max (percent limits)', () => {
    expect(clampRatio(0.02, '10%', '90%', 1000)).toBe(0.1);
    expect(clampRatio(0.99, '10%', '90%', 1000)).toBe(0.9);
  });

  it('clamps against pixel limits resolved through the container', () => {
    expect(clampRatio(0.05, 100, 900, 1000)).toBe(0.1);
    expect(clampRatio(0.95, 100, 900, 1000)).toBe(0.9);
    expect(clampRatio(0.5, 100, 900, 1000)).toBe(0.5);
  });

  it('falls back to 0/1 when pixel limits cannot be resolved (container=0)', () => {
    // Unmeasured px limits degrade to "no constraint" until first layout.
    expect(clampRatio(0.05, 100, 900, 0)).toBe(0.05);
    expect(clampRatio(-1, 100, 900, 0)).toBe(0);
    expect(clampRatio(2, 100, 900, 0)).toBe(1);
  });

  it('tolerates a reversed window (min > max) by swapping the bounds', () => {
    expect(clampRatio(0.5, '90%', '10%', 1000)).toBe(0.5);
    expect(clampRatio(0.95, '90%', '10%', 1000)).toBe(0.9);
    expect(clampRatio(0.02, '90%', '10%', 1000)).toBe(0.1);
  });

  it('snaps a non-finite ratio to the lower bound', () => {
    expect(clampRatio(Number.NaN, '10%', '90%', 1000)).toBe(0.1);
  });
});

describe('ratioFromPointer', () => {
  it('maps clientX along the horizontal axis', () => {
    expect(ratioFromPointer(0, rect(), 'horizontal')).toBe(0);
    expect(ratioFromPointer(300, rect(), 'horizontal')).toBe(0.3);
    expect(ratioFromPointer(1000, rect(), 'horizontal')).toBe(1);
  });

  it('accounts for a non-zero left offset', () => {
    expect(ratioFromPointer(300, rect({ left: 100 }), 'horizontal')).toBe(0.2);
  });

  it('mirrors the horizontal axis when rtl', () => {
    expect(ratioFromPointer(300, rect(), 'horizontal', true)).toBe(0.7);
    expect(ratioFromPointer(0, rect(), 'horizontal', true)).toBe(1);
  });

  it('maps clientY along the vertical axis and ignores rtl', () => {
    expect(ratioFromPointer(250, rect(), 'vertical')).toBe(0.5);
    expect(ratioFromPointer(250, rect(), 'vertical', true)).toBe(0.5);
  });

  it('clamps pointers beyond the container edges into [0, 1]', () => {
    expect(ratioFromPointer(-50, rect(), 'horizontal')).toBe(0);
    expect(ratioFromPointer(1500, rect(), 'horizontal')).toBe(1);
  });

  it('returns 0 for a zero-sized container instead of dividing by zero', () => {
    expect(ratioFromPointer(300, rect({ width: 0 }), 'horizontal')).toBe(0);
    expect(ratioFromPointer(300, rect({ height: 0 }), 'vertical')).toBe(0);
  });
});

describe('resolveDragRatio', () => {
  const limits = { min: '10%', max: '90%', collapsible: false, collapseThreshold: 48 };

  it('clamps into the [min, max] window and reports not-collapsed', () => {
    expect(resolveDragRatio(0.3, 1000, limits)).toEqual({ ratio: 0.3, collapsed: false });
    expect(resolveDragRatio(0.02, 1000, limits)).toEqual({ ratio: 0.1, collapsed: false });
    expect(resolveDragRatio(0.99, 1000, limits)).toEqual({ ratio: 0.9, collapsed: false });
  });

  it('snaps collapsed when the first pane drops below the px threshold', () => {
    // 40px < 48px threshold → collapse wins over the 10% min clamp.
    expect(resolveDragRatio(0.04, 1000, { ...limits, collapsible: true })).toEqual({
      ratio: 0,
      collapsed: true
    });
  });

  it('does not collapse above the threshold even when collapsible', () => {
    // 60px ≥ 48px → clamps to min (0.1), stays expanded.
    expect(resolveDragRatio(0.06, 1000, { ...limits, collapsible: true })).toEqual({
      ratio: 0.1,
      collapsed: false
    });
  });

  it('never collapses when collapsible is off', () => {
    expect(resolveDragRatio(0.001, 1000, limits)).toEqual({ ratio: 0.1, collapsed: false });
  });

  it('does not collapse without a measured container (clamps to min instead)', () => {
    // containerPx=0 disables the collapse branch, so 0 clamps up to the 10% min.
    expect(resolveDragRatio(0.0, 0, { ...limits, collapsible: true })).toEqual({
      ratio: 0.1,
      collapsed: false
    });
  });

  it('applies drag hysteresis while collapsed (no flip-flop at the threshold)', () => {
    const opts = { ...limits, collapsible: true };
    // 55px: above the 48px collapse threshold, but below the 60px release
    // point (48 + 12 hysteresis) → a collapsed pane stays collapsed…
    expect(resolveDragRatio(0.055, 1000, opts, true)).toEqual({ ratio: 0, collapsed: true });
    // …while the same position does NOT collapse an expanded pane.
    expect(resolveDragRatio(0.055, 1000, opts, false)).toEqual({ ratio: 0.1, collapsed: false });
    // Clearing the release point re-expands.
    expect(resolveDragRatio(0.061, 1000, opts, true)).toEqual({ ratio: 0.1, collapsed: false });
  });
});
