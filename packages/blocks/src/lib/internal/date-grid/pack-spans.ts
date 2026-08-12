/**
 * Greedy first-fit row packing for column spans (INTERNAL).
 *
 * Lifted verbatim out of `calendar.engine.ts`'s `getMultiDayEventLayout`, whose
 * per-week bar stacking it now serves; `ResourceTimeline` packs its per-lane
 * bars through the same function. One packer, two callers — the duplication a
 * second implementation would have created never exists.
 *
 * **Order is the caller's.** The packer walks `spans` in the order it is given
 * and never sorts: the first span takes the topmost free row, the next the
 * topmost row still free across its columns, and so on. Calendar sorts its
 * *events* globally (start ascending, then longer first) before slicing them
 * into weeks, and ResourceTimeline sorts its *spans* per lane — two different
 * comparators over two different value types, so folding either into the packer
 * would have changed the other's output. What the packer guarantees is that the
 * output preserves input order, which is what makes the stacking stable.
 */

/** A span placed on a stack row by {@link packSpans}. */
export interface PackedSpan<S> {
  /** The caller's span value, untouched. */
  span: S;
  /** 0-based stack row the span was assigned to. */
  row: number;
}

/**
 * Assign each span the topmost row where its `[startCol, endCol]` columns are
 * still free.
 *
 * @param spans - The spans to place, in the order they should claim rows.
 * @param columns - Number of columns in the grid the spans live on.
 * @param bounds - Reads a span's inclusive 0-based column range. Values outside
 *   `[0, columns - 1]` are clamped, and an inverted range (`endCol < startCol`)
 *   occupies nothing rather than throwing — read tolerant.
 * @param maxRows - Rows to keep. Spans landing past it are dropped from
 *   `packed` and counted in `overflow`. Omit for "keep every row".
 * @returns The kept spans with their row (input order preserved) and the number
 *   of spans that overflowed.
 */
export function packSpans<S>(
  spans: readonly S[],
  columns: number,
  bounds: (span: S) => { startCol: number; endCol: number },
  maxRows?: number
): { packed: PackedSpan<S>[]; overflow: number } {
  const occupiedRows: boolean[][] = [];
  const placed: PackedSpan<S>[] = [];

  for (const span of spans) {
    const raw = bounds(span);
    const startCol = Math.max(0, Math.min(raw.startCol, columns - 1));
    const endCol = Math.max(-1, Math.min(raw.endCol, columns - 1));

    // Find the first row whose [startCol, endCol] columns are all free.
    let assignedRow = 0;
    while (true) {
      if (!occupiedRows[assignedRow]) occupiedRows[assignedRow] = Array(columns).fill(false);
      let fits = true;
      for (let c = startCol; c <= endCol; c++) {
        if (occupiedRows[assignedRow][c]) {
          fits = false;
          break;
        }
      }
      if (fits) break;
      assignedRow++;
    }

    for (let c = startCol; c <= endCol; c++) occupiedRows[assignedRow][c] = true;
    placed.push({ span, row: assignedRow });
  }

  if (maxRows === undefined) return { packed: placed, overflow: 0 };
  const packed = placed.filter((p) => p.row < maxRows);
  return { packed, overflow: placed.length - packed.length };
}
