import { describe, expect, it } from 'vitest';
import {
  arcPath,
  areaPath,
  bandScale,
  chartPalette,
  extent,
  linearScale,
  linePath,
  niceScale,
  numberFormatter,
  seriesColor
} from './utils';

describe('extent', () => {
  it('returns [0, 0] for an empty array', () => {
    expect(extent([])).toEqual([0, 0]);
  });

  it('finds the min and max', () => {
    expect(extent([3, -1, 7, 2])).toEqual([-1, 7]);
  });

  it('handles a single value', () => {
    expect(extent([5])).toEqual([5, 5]);
  });
});

describe('linearScale', () => {
  it('maps domain endpoints to range endpoints', () => {
    const s = linearScale([0, 10], [0, 100]);
    expect(s(0)).toBe(0);
    expect(s(10)).toBe(100);
    expect(s(5)).toBe(50);
  });

  it('supports an inverted range (SVG y-axis)', () => {
    const s = linearScale([0, 10], [100, 0]);
    expect(s(0)).toBe(100);
    expect(s(10)).toBe(0);
  });

  it('collapses a zero-width domain to the range start (no NaN)', () => {
    const s = linearScale([5, 5], [0, 100]);
    expect(s(5)).toBe(0);
    expect(Number.isNaN(s(99))).toBe(false);
  });
});

describe('bandScale', () => {
  it('spaces bands evenly with inner padding', () => {
    const b = bandScale(2, [0, 100], 0);
    expect(b.step).toBe(50);
    expect(b.bandwidth).toBe(50);
    expect(b.position(0)).toBe(0);
    expect(b.position(1)).toBe(50);
    expect(b.center(0)).toBe(25);
  });

  it('applies padding symmetrically', () => {
    const b = bandScale(1, [0, 100], 0.2);
    expect(b.bandwidth).toBeCloseTo(80);
    expect(b.position(0)).toBeCloseTo(10);
  });

  it('is safe for zero items', () => {
    const b = bandScale(0, [0, 100]);
    expect(b.step).toBe(0);
    expect(b.bandwidth).toBe(0);
  });
});

describe('niceScale', () => {
  it('rounds the domain outward to nice bounds', () => {
    const { min, max, ticks } = niceScale(0, 95, 5);
    expect(min).toBe(0);
    expect(max).toBeGreaterThanOrEqual(95);
    expect(ticks[0]).toBe(min);
    expect(ticks[ticks.length - 1]).toBe(max);
  });

  it('includes zero for single-signed data', () => {
    expect(niceScale(20, 80).min).toBe(0);
  });

  it('opens a unit window for all-equal data', () => {
    const { min, max } = niceScale(0, 0);
    expect(max).toBeGreaterThan(min);
  });

  it('handles negative ranges spanning zero', () => {
    const { min, max } = niceScale(-30, 30);
    expect(min).toBeLessThanOrEqual(-30);
    expect(max).toBeGreaterThanOrEqual(30);
  });

  it('does not emit float noise in ticks', () => {
    const { ticks } = niceScale(0, 1, 5);
    for (const t of ticks) {
      expect(Number(t.toFixed(10))).toBe(t);
    }
  });
});

describe('linePath / areaPath', () => {
  it('builds a polyline path', () => {
    expect(
      linePath([
        [0, 0],
        [10, 20]
      ])
    ).toBe('M0,0L10,20');
  });

  it('returns an empty string for no points', () => {
    expect(linePath([])).toBe('');
    expect(areaPath([], 0)).toBe('');
  });

  it('closes an area back to the baseline', () => {
    expect(
      areaPath(
        [
          [0, 10],
          [10, 5]
        ],
        50
      )
    ).toBe('M0,10L10,5L10,50L0,50Z');
  });
});

describe('arcPath', () => {
  it('draws a donut segment with outer + inner arcs', () => {
    const d = arcPath(50, 50, 50, 30, 0, Math.PI / 2);
    expect(d.startsWith('M')).toBe(true);
    expect((d.match(/A/g) ?? []).length).toBe(2);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('draws a pie slice from the center when innerRadius is 0', () => {
    const d = arcPath(50, 50, 50, 0, 0, Math.PI / 2);
    expect(d.startsWith('M50,50')).toBe(true);
    expect((d.match(/A/g) ?? []).length).toBe(1);
  });

  it('renders a full circle as two arcs (no collapse to a point)', () => {
    const d = arcPath(50, 50, 50, 30, 0, Math.PI * 2);
    expect((d.match(/A/g) ?? []).length).toBe(4);
  });
});

describe('seriesColor', () => {
  it('cycles the palette by index', () => {
    expect(seriesColor(0)).toBe(chartPalette[0]);
    expect(seriesColor(chartPalette.length)).toBe(chartPalette[0]);
  });

  it('prefers an explicit color', () => {
    expect(seriesColor(0, '#abc')).toBe('#abc');
  });
});

describe('numberFormatter', () => {
  it('formats with the given locale', () => {
    const fmt = numberFormatter('en-US');
    expect(fmt(1234.5)).toBe('1,234.5');
  });
});
