/**
 * The shared first-fit packer, lifted out of `getMultiDayEventLayout`.
 *
 * `calendar.engine.test.ts` is the *positive control* for that lift: it carries
 * the month-bar assertions this code used to satisfy inline and must stay green
 * without a single edit. These tests cover what that suite cannot see from the
 * outside — the packer's own contract, including the parts only
 * `ResourceTimeline` exercises (a window wider than 7 columns, no `maxRows`).
 */

import { describe, expect, it } from 'vitest';
import { packSpans } from './pack-spans';

interface Bar {
  id: string;
  startCol: number;
  endCol: number;
}

const bounds = (b: Bar) => ({ startCol: b.startCol, endCol: b.endCol });
const rowsById = (packed: Array<{ span: Bar; row: number }>) =>
  Object.fromEntries(packed.map((p) => [p.span.id, p.row]));

describe('packSpans', () => {
  it('gives the first span row 0', () => {
    const { packed, overflow } = packSpans([{ id: 'a', startCol: 1, endCol: 3 }], 7, bounds);
    expect(packed).toEqual([{ span: { id: 'a', startCol: 1, endCol: 3 }, row: 0 }]);
    expect(overflow).toBe(0);
  });

  it('stacks overlapping spans onto separate rows', () => {
    const { packed } = packSpans(
      [
        { id: 'a', startCol: 0, endCol: 3 },
        { id: 'b', startCol: 2, endCol: 5 },
        { id: 'c', startCol: 3, endCol: 4 }
      ],
      7,
      bounds
    );
    expect(rowsById(packed)).toEqual({ a: 0, b: 1, c: 2 });
  });

  it('lets spans that only touch share a row', () => {
    // `endCol` is inclusive, so [0,2] and [3,5] are adjacent, not overlapping —
    // the bug a half-open reading of the bounds would introduce is a needless
    // second row here.
    const { packed } = packSpans(
      [
        { id: 'a', startCol: 0, endCol: 2 },
        { id: 'b', startCol: 3, endCol: 5 }
      ],
      7,
      bounds
    );
    expect(rowsById(packed)).toEqual({ a: 0, b: 0 });
  });

  it('backfills the topmost free row rather than appending', () => {
    // First-fit, not next-fit: `c` fits beside `a` in row 0 even though `b`
    // already opened row 1.
    const { packed } = packSpans(
      [
        { id: 'a', startCol: 0, endCol: 1 },
        { id: 'b', startCol: 0, endCol: 6 },
        { id: 'c', startCol: 4, endCol: 6 }
      ],
      7,
      bounds
    );
    expect(rowsById(packed)).toEqual({ a: 0, b: 1, c: 0 });
  });

  it('packs in input order and never sorts', () => {
    // The caller owns the order (Calendar sorts events globally, ResourceTimeline
    // sorts spans per lane). Same two spans, swapped input → swapped rows.
    const long: Bar = { id: 'long', startCol: 0, endCol: 6 };
    const short: Bar = { id: 'short', startCol: 0, endCol: 0 };
    expect(rowsById(packSpans([long, short], 7, bounds).packed)).toEqual({ long: 0, short: 1 });
    expect(rowsById(packSpans([short, long], 7, bounds).packed)).toEqual({ short: 0, long: 1 });
  });

  it('preserves input order in the output', () => {
    const { packed } = packSpans(
      [
        { id: 'a', startCol: 0, endCol: 6 },
        { id: 'b', startCol: 0, endCol: 6 },
        { id: 'c', startCol: 0, endCol: 6 }
      ],
      7,
      bounds
    );
    expect(packed.map((p) => p.span.id)).toEqual(['a', 'b', 'c']);
  });

  it('splits visible rows from overflow at maxRows', () => {
    const spans: Bar[] = ['a', 'b', 'c', 'd'].map((id) => ({ id, startCol: 1, endCol: 3 }));
    const { packed, overflow } = packSpans(spans, 7, bounds, 2);
    expect(packed.map((p) => p.span.id)).toEqual(['a', 'b']);
    expect(packed.map((p) => p.row)).toEqual([0, 1]);
    expect(overflow).toBe(2);
  });

  it('keeps every row when maxRows is omitted', () => {
    const spans: Bar[] = ['a', 'b', 'c'].map((id) => ({ id, startCol: 0, endCol: 0 }));
    const { packed, overflow } = packSpans(spans, 7, bounds);
    expect(packed.map((p) => p.row)).toEqual([0, 1, 2]);
    expect(overflow).toBe(0);
  });

  it('handles windows wider than a week', () => {
    // ResourceTimeline's 14/30-day windows — the calendar caller only ever
    // passes 7, so nothing else covers a non-week column count.
    const { packed } = packSpans(
      [
        { id: 'a', startCol: 0, endCol: 20 },
        { id: 'b', startCol: 21, endCol: 29 }
      ],
      30,
      bounds
    );
    expect(rowsById(packed)).toEqual({ a: 0, b: 0 });
  });

  it('clamps out-of-range bounds instead of throwing', () => {
    // Read tolerant: a caller that forgot to clip still gets a usable row, and
    // the clamped span occupies only the real columns.
    const { packed } = packSpans(
      [
        { id: 'wide', startCol: -5, endCol: 99 },
        { id: 'inside', startCol: 3, endCol: 3 }
      ],
      7,
      bounds
    );
    expect(rowsById(packed)).toEqual({ wide: 0, inside: 1 });
  });

  it('lets an inverted span occupy nothing', () => {
    const { packed } = packSpans(
      [
        { id: 'inverted', startCol: 4, endCol: 1 },
        { id: 'real', startCol: 0, endCol: 6 }
      ],
      7,
      bounds
    );
    expect(rowsById(packed)).toEqual({ inverted: 0, real: 0 });
  });
});
