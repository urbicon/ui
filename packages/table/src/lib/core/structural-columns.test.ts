import { describe, expect, it } from 'vitest';
import { widthClassToRem } from '$lib/variants/table.system';
import {
  leadingStructuralColumns,
  STRUCTURAL_COLUMNS,
  type StructuralColumnFlags,
  type StructuralColumnKey,
  structuralColumns
} from './structural-columns';

/**
 * The declaration itself. Its four renderers are pinned against the rendered
 * DOM in `Table.structuralcolumns.svelte.test.ts`; what is checked here is the
 * list they all read — the order, the flag each column hangs on, the two units
 * of one width, and the `aria-colindex` a position implies.
 *
 * The expectations below are written out by hand rather than folded back out of
 * the module, because a test that derives its expectation from the thing under
 * test measures only that the thing is self-consistent.
 */

const ORDER: readonly StructuralColumnKey[] = ['group', 'selection', 'expand'];

/** Every combination of the three flags, in a stable order. */
const COMBOS: StructuralColumnFlags[] = [false, true].flatMap((grouped) =>
  [false, true].flatMap((selectable) =>
    [false, true].map((expandable) => ({ grouped, selectable, expandable }))
  )
);

/** Which keys a combination should produce — the hand-written counterpart. */
function expectedKeys(flags: StructuralColumnFlags): StructuralColumnKey[] {
  const keys: StructuralColumnKey[] = [];
  if (flags.grouped) keys.push('group');
  if (flags.selectable) keys.push('selection');
  if (flags.expandable) keys.push('expand');
  return keys;
}

describe('the structural column declaration', () => {
  it('lists the three columns in render order', () => {
    expect(STRUCTURAL_COLUMNS.map((column) => column.key)).toEqual(ORDER);
    // Positive control: the same reader on a different order would say so.
    expect(STRUCTURAL_COLUMNS.map((column) => column.key)).not.toEqual([...ORDER].reverse());
  });

  it('hangs each column on its own flag', () => {
    expect(STRUCTURAL_COLUMNS.map((column) => column.flag)).toEqual([
      'grouped',
      'selectable',
      'expandable'
    ]);
  });

  it('states one width in two units', () => {
    // The pair is the whole point: `widthClass` is what a cell wears,
    // `widthCss` what a `<col>` can state, and they are one value converted —
    // not two literals that happen to agree today (they did not: the colgroup
    // carried `3rem` / `2.5rem` beside the cells' `w-12` / `w-10`).
    for (const column of STRUCTURAL_COLUMNS) {
      expect(column.widthCss).toBe(widthClassToRem(column.widthClass));
    }

    expect(STRUCTURAL_COLUMNS.map((column) => column.widthClass)).toEqual(['w-10', 'w-12', 'w-10']);
    expect(STRUCTURAL_COLUMNS.map((column) => column.widthCss)).toEqual([
      '2.5rem',
      '3rem',
      '2.5rem'
    ]);
    // Positive control: the conversion is arithmetic, not a constant — a
    // different class has to give a different length, or the check above passes
    // for any pair.
    expect(widthClassToRem('w-11')).toBe('2.75rem');
    expect(widthClassToRem('w-11')).not.toBe(widthClassToRem('w-12'));
  });
});

describe('widthClassToRem', () => {
  it('converts a Tailwind width step to rem', () => {
    expect(widthClassToRem('w-12')).toBe('3rem');
    expect(widthClassToRem('w-10')).toBe('2.5rem');
    expect(widthClassToRem('w-1.5')).toBe('0.375rem');
    expect(widthClassToRem('w-0')).toBe('0rem');
  });

  it('throws on anything it cannot read', () => {
    // A silent fallback here would drop a `<col>` and re-open the gap between
    // the tracks and the cells they size.
    expect(() => widthClassToRem('w-full')).toThrow(/Tailwind/);
    expect(() => widthClassToRem('w-1/2')).toThrow(/Tailwind/);
    expect(() => widthClassToRem('h-10')).toThrow(/Tailwind/);
    expect(() => widthClassToRem('')).toThrow(/Tailwind/);
    // Positive control: the guard is not simply throwing for everything.
    expect(() => widthClassToRem('w-10')).not.toThrow();
  });
});

describe('structuralColumns', () => {
  it.each(COMBOS)('keeps order and index for %o', (flags) => {
    const expected = expectedKeys(flags);
    const present = structuralColumns(flags);

    expect(present.map((column) => column.key)).toEqual(expected);
    // 1..n, gapless: `aria-colcount` counts every column, so a data cell that
    // skipped one would contradict the width the grid declares.
    expect(present.map((column) => column.colIndex)).toEqual(
      expected.map((_key, index) => index + 1)
    );
    expect(leadingStructuralColumns(flags)).toBe(expected.length);

    // Positive control, same rig: the reader would notice a column missing and
    // an index that started anywhere else.
    if (expected.length > 0) {
      expect(present.map((column) => column.key)).not.toEqual(expected.slice(1));
      expect(present.map((column) => column.colIndex)).not.toEqual(
        expected.map((_key, index) => index + 2)
      );
    }
  });

  it('gives a column the same index whether or not a renderer announces it', () => {
    // The distinction the whole list exists to keep: a row inside a grouped
    // table renders the group cell `aria-hidden`, and selection is still
    // column 2 rather than sliding up into the unannounced slot.
    const grouped = structuralColumns({ grouped: true, selectable: true, expandable: false });
    const flat = structuralColumns({ grouped: false, selectable: true, expandable: false });

    expect(grouped.find((column) => column.key === 'selection')?.colIndex).toBe(2);
    expect(flat.find((column) => column.key === 'selection')?.colIndex).toBe(1);
  });
});
