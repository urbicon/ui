import { describe, expect, it } from 'vitest';
import { type AutosizeMetrics, autoResizeHeight } from './textarea.autosize';

// The size ladder's own metrics (textarea.variants.ts), as Chromium computes them: line
// height, vertical padding, a 1px border on each side, border-box sizing.
const metrics = (lineHeight: number, paddingBlock: number, scrollHeight: number) =>
  ({
    lineHeight,
    fontSize: Number.NaN,
    paddingBlock,
    borderBlock: 2,
    borderBox: true,
    scrollHeight
  }) satisfies AutosizeMetrics;

const ladder = {
  xs: { lineHeight: 16, paddingBlock: 12 },
  sm: { lineHeight: 20, paddingBlock: 16 },
  md: { lineHeight: 24, paddingBlock: 24 },
  lg: { lineHeight: 28, paddingBlock: 32 },
  xl: { lineHeight: 28, paddingBlock: 40 }
};

describe('autoResizeHeight', () => {
  for (const [size, { lineHeight, paddingBlock }] of Object.entries(ladder)) {
    it(`caps at exactly maxRows rows of content at ${size}`, () => {
      for (const maxRows of [4, 8]) {
        const tall = metrics(lineHeight, paddingBlock, 30 * lineHeight + paddingBlock);
        const sized = autoResizeHeight(tall, 1, maxRows);
        expect(sized?.overflow).toBe(true);
        expect(((sized?.height ?? 0) - paddingBlock - 2) / lineHeight).toBe(maxRows);
      }
    });
  }

  it('fits the content between the bounds, border included', () => {
    // 5 rows of content at md: scrollHeight = 5 × 24 + 24 padding.
    const sized = autoResizeHeight(metrics(24, 24, 144), 1, 8);
    expect(sized).toEqual({ height: 146, overflow: false });
  });

  it('holds the minRows floor below it', () => {
    const sized = autoResizeHeight(metrics(24, 24, 48), 3);
    expect(sized).toEqual({ height: 3 * 24 + 26, overflow: false });
  });

  it('counts no padding or border into a content-box height', () => {
    const sized = autoResizeHeight({ ...metrics(24, 24, 500), borderBox: false }, 1, 4);
    expect(sized).toEqual({ height: 96, overflow: true });
  });

  it('reads line-height: normal as 1.2 × the font size', () => {
    const sized = autoResizeHeight({ ...metrics(Number.NaN, 0, 500), fontSize: 20 }, 1, 4);
    expect(sized?.height).toBe(4 * 24 + 2);
  });

  it('leaves the height alone when neither line height nor font size has a pixel value', () => {
    expect(autoResizeHeight(metrics(Number.NaN, 0, 0), 3, 5)).toBeNull();
  });
});
