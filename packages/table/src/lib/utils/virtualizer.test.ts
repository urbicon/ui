import { describe, expect, it } from 'vitest';
import { TABLE_DIMENSIONS } from '../variants/table.system';
import { computeVirtualItems, ROW_HEIGHTS } from './virtualizer';

describe('ROW_HEIGHTS', () => {
  // Deliberately NOT re-deriving the numbers from the classes here. The first
  // attempt at this test did — same regex, same `* 4` — which made it compare
  // the derivation against itself and pass for every possible edit, including a
  // wrong multiplier. What is worth pinning is the concrete result a reader can
  // check against Tailwind's scale (`h-8` is 2rem is 32px) and the shape the
  // derivation needs to keep working.
  //
  // Its predecessor asserted 48/56/64 under the name "matches
  // TABLE_DIMENSIONS.height.row values" while those classes said h-8/h-10/h-12.
  // It never looked at the classes it was named after, so it stayed green
  // through the entire two-year disagreement.
  it('is the row height class in pixels', () => {
    // `toEqual` on the derived side, which is the one that can grow a key
    // nobody meant: `toMatchObject` would let a fourth size or an alias through
    // on exactly the output this test exists to pin.
    expect(TABLE_DIMENSIONS.height.row).toEqual({ sm: 'h-8', md: 'h-10', lg: 'h-12' });
    expect(ROW_HEIGHTS).toEqual({ sm: 32, md: 40, lg: 48 });
  });

  it('keeps the row height in a shape the derivation can read', () => {
    // The conversion throws on anything that is not `h-<step>`, which turns a
    // row height written as `h-[42px]` or `min-h-10` into a module-load error
    // rather than a silently wrong stride. Pinning the shape here says why the
    // classes are not free-form.
    for (const heightClass of Object.values(TABLE_DIMENSIONS.height.row)) {
      expect(heightClass).toMatch(/^h-\d+(\.\d+)?$/);
    }
  });
});

describe('computeVirtualItems', () => {
  const defaultOpts = { count: 100, rowHeight: 56, overscan: 5 };

  it('returns empty result for zero items', () => {
    const result = computeVirtualItems(0, 600, { count: 0, rowHeight: 56 });
    expect(result.virtualItems).toHaveLength(0);
    expect(result.totalHeight).toBe(0);
  });

  it('returns empty result for zero viewport height', () => {
    const result = computeVirtualItems(0, 0, defaultOpts);
    expect(result.virtualItems).toHaveLength(0);
    expect(result.totalHeight).toBe(0);
  });

  it('computes correct totalHeight', () => {
    const result = computeVirtualItems(0, 600, defaultOpts);
    expect(result.totalHeight).toBe(100 * 56);
  });

  it('renders first visible rows plus overscan at scrollTop=0', () => {
    // viewport=600px, rowHeight=56px → ~11 visible rows + 5 overscan below = ~16
    const result = computeVirtualItems(0, 600, defaultOpts);

    // startIndex should be 0 (clamped, no overscan above)
    expect(result.startIndex).toBe(0);
    // visible: ceil(600/56) = 11, + 5 overscan = 16
    expect(result.endIndex).toBe(16);
    expect(result.virtualItems).toHaveLength(16);
    expect(result.virtualItems[0].index).toBe(0);
    expect(result.virtualItems[0].offsetTop).toBe(0);
  });

  it('applies overscan when scrolled to middle', () => {
    // scrollTop=2800 means top of viewport is at row 50
    const scrollTop = 50 * 56; // 2800
    const result = computeVirtualItems(scrollTop, 600, defaultOpts);

    // startIndex = 50 - 5 = 45
    expect(result.startIndex).toBe(45);
    // endIndex = ceil((2800+600)/56) + 5 = 61 + 5 = 66
    expect(result.endIndex).toBeLessThanOrEqual(66);
    expect(result.virtualItems[0].index).toBe(45);
  });

  it('clamps endIndex to count', () => {
    // Scroll near the end
    const scrollTop = 95 * 56;
    const result = computeVirtualItems(scrollTop, 600, defaultOpts);

    expect(result.endIndex).toBe(100);
    const lastItem = result.virtualItems[result.virtualItems.length - 1];
    expect(lastItem.index).toBe(99);
  });

  it('clamps startIndex to 0', () => {
    const result = computeVirtualItems(0, 600, defaultOpts);
    expect(result.startIndex).toBe(0);
  });

  it('each virtual item has correct offsetTop', () => {
    const result = computeVirtualItems(0, 600, defaultOpts);
    for (const item of result.virtualItems) {
      expect(item.offsetTop).toBe(item.index * 56);
      expect(item.height).toBe(56);
    }
  });

  it('works with small datasets that fit in viewport', () => {
    const result = computeVirtualItems(0, 600, { count: 3, rowHeight: 56 });

    expect(result.virtualItems).toHaveLength(3);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(3);
    expect(result.totalHeight).toBe(3 * 56);
  });

  it('respects custom overscan value', () => {
    const result = computeVirtualItems(50 * 56, 600, {
      count: 100,
      rowHeight: 56,
      overscan: 10
    });

    // startIndex = 50 - 10 = 40
    expect(result.startIndex).toBe(40);
  });

  it('works with different row heights (lg)', () => {
    // Reads the constant instead of restating it: this test used to hard-code
    // 64 next to `ROW_HEIGHTS.lg`, so correcting the constant broke a test that
    // was not about the constant's value at all.
    const lg = ROW_HEIGHTS.lg;
    const result = computeVirtualItems(0, 600, {
      count: 100,
      rowHeight: lg,
      overscan: 5
    });

    expect(result.totalHeight).toBe(100 * lg);
    expect(result.endIndex).toBe(Math.ceil(600 / lg) + 5);
  });

  it('handles 10k items efficiently', () => {
    const result = computeVirtualItems(5000 * 56, 600, {
      count: 10000,
      rowHeight: 56,
      overscan: 5
    });

    // Should only render ~21 items (11 visible + 10 overscan), not 10k
    expect(result.virtualItems.length).toBeLessThan(30);
    expect(result.virtualItems.length).toBeGreaterThan(10);
    expect(result.totalHeight).toBe(10000 * 56);
  });
});
