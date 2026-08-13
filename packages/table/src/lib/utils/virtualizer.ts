/**
 * Lightweight row virtualizer for fixed-height table rows.
 * Only renders rows visible in the scroll viewport plus an overscan buffer.
 *
 * This avoids adding @tanstack/virtual as an external dependency and is fully
 * compatible with Svelte 5 runes.
 */

import { TABLE_ROW_HEIGHT_PX } from '../variants/table.system';

export interface VirtualItem {
  /** Index in the source data array */
  index: number;
  /** Pixel offset from the top of the scroll container */
  offsetTop: number;
  /** Height of this item in pixels */
  height: number;
}

export interface VirtualizerOptions {
  /** Total number of items */
  count: number;
  /** Fixed height per row in pixels */
  rowHeight: number;
  /** Number of rows to render above/below the viewport */
  overscan?: number;
}

export interface VirtualizerResult {
  /** Items to render */
  virtualItems: VirtualItem[];
  /** Total height of all rows (sets the scroll container's inner height) */
  totalHeight: number;
  /** Index of the first rendered item */
  startIndex: number;
  /** Index of the last rendered item (exclusive) */
  endIndex: number;
}

/**
 * Row height in pixels for each table size variant — the value the virtualizer
 * starts from before {@link TableDesktop} measures a rendered row.
 *
 * Re-exported from the row height classes themselves rather than written out
 * here: this constant and `TABLE_DIMENSIONS.height.row` used to be two
 * hand-written copies of one number, and they disagreed by 16px per row.
 */
export const ROW_HEIGHTS: Record<string, number> = TABLE_ROW_HEIGHT_PX;

/**
 * Computes which rows are visible given a scroll position and viewport height.
 * Pure function – no side effects, easy to test.
 */
export function computeVirtualItems(
  scrollTop: number,
  viewportHeight: number,
  options: VirtualizerOptions
): VirtualizerResult {
  const { count, rowHeight, overscan = 5 } = options;

  if (count === 0 || viewportHeight === 0) {
    return { virtualItems: [], totalHeight: 0, startIndex: 0, endIndex: 0 };
  }

  const totalHeight = count * rowHeight;

  // Calculate visible range
  const rawStart = Math.floor(scrollTop / rowHeight);
  const rawEnd = Math.ceil((scrollTop + viewportHeight) / rowHeight);

  // Apply overscan
  const startIndex = Math.max(0, rawStart - overscan);
  const endIndex = Math.min(count, rawEnd + overscan);

  // Build virtual items
  const virtualItems: VirtualItem[] = [];
  for (let i = startIndex; i < endIndex; i++) {
    virtualItems.push({
      index: i,
      offsetTop: i * rowHeight,
      height: rowHeight
    });
  }

  return { virtualItems, totalHeight, startIndex, endIndex };
}
