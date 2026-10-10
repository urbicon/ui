/** What `autoResizeHeight` reads off the textarea, measured with its height reset to `auto`. */
export interface AutosizeMetrics {
  /** Computed line height in px. `NaN` when there is no pixel value to read. */
  lineHeight: number;
  /** Computed font size in px, for a `line-height: normal`. */
  fontSize: number;
  /** padding-top + padding-bottom, px. */
  paddingBlock: number;
  /** border-top-width + border-bottom-width, px. */
  borderBlock: number;
  /** `box-sizing: border-box` — `style.height` then counts padding and border. */
  borderBox: boolean;
  /** Content plus padding, as `scrollHeight` reports it. */
  scrollHeight: number;
}

export function readAutosizeMetrics(el: HTMLElement): AutosizeMetrics {
  const cs = getComputedStyle(el);
  const px = (value: string) => Number.parseFloat(value) || 0;
  return {
    lineHeight: Number.parseFloat(cs.lineHeight),
    fontSize: Number.parseFloat(cs.fontSize),
    paddingBlock: px(cs.paddingTop) + px(cs.paddingBottom),
    borderBlock: px(cs.borderTopWidth) + px(cs.borderBottomWidth),
    borderBox: cs.boxSizing === 'border-box',
    scrollHeight: el.scrollHeight
  };
}

/**
 * The `style.height` that fits the content between `minRows` and `maxRows` rows, and whether
 * the content runs past the `maxRows` cap. A row is the computed line height, so the count
 * holds at every `size` and under `pointer-coarse` font swaps; padding and border are added
 * on top when `box-sizing` puts them inside the height. `null` when neither the line height
 * nor the font size has a pixel value — the native `rows` height then stands.
 */
export function autoResizeHeight(
  m: AutosizeMetrics,
  minRows: number,
  maxRows?: number
): { height: number; overflow: boolean } | null {
  // `normal` is the one keyword a computed line-height keeps; CSS 2.1 §10.8.1 recommends
  // 1.0–1.2 × the font size for it, and the upper end keeps a last row from being clipped.
  const lineHeight = Number.isFinite(m.lineHeight) ? m.lineHeight : m.fontSize * 1.2;
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) return null;

  const chrome = m.borderBox ? m.paddingBlock + m.borderBlock : 0;
  const rowsHeight = (rows: number) => rows * lineHeight + chrome;
  const content = m.scrollHeight - m.paddingBlock + chrome;
  const max = maxRows ? rowsHeight(maxRows) : Number.POSITIVE_INFINITY;

  return {
    height: Math.min(Math.max(content, rowsHeight(minRows)), max),
    overflow: content > max
  };
}
