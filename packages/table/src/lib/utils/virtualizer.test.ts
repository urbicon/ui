import { describe, expect, it } from 'vitest';
import { computeVirtualItems, ROW_HEIGHTS } from './virtualizer';

describe('ROW_HEIGHTS', () => {
  it('matches TABLE_DIMENSIONS.height.row values', () => {
    expect(ROW_HEIGHTS.sm).toBe(48);
    expect(ROW_HEIGHTS.md).toBe(56);
    expect(ROW_HEIGHTS.lg).toBe(64);
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
    const result = computeVirtualItems(0, 600, {
      count: 100,
      rowHeight: ROW_HEIGHTS.lg, // 64px
      overscan: 5
    });

    expect(result.totalHeight).toBe(100 * 64);
    // visible: ceil(600/64) = 10, + 5 overscan = 15
    expect(result.endIndex).toBe(15);
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
