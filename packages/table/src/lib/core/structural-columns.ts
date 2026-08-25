import { TABLE_DIMENSIONS, widthClassToRem } from '$lib/variants/table.system';

/** The structural columns there are. */
export type StructuralColumnKey = 'group' | 'selection' | 'expand';

/** What each of them hangs on — a table has the column when its flag is set. */
export type StructuralColumnFlags = {
  grouped: boolean;
  selectable: boolean;
  expandable: boolean;
};

export type StructuralColumn = {
  key: StructuralColumnKey;
  /** The flag that brings this column into existence. */
  flag: keyof StructuralColumnFlags;
  /** The width as a cell wears it. */
  widthClass: string;
  /** The same width, as a `<col>` can state it. */
  widthCss: string;
};

/** A column a table actually has, at the `aria-colindex` its position gives it. */
export type PresentStructuralColumn = StructuralColumn & { colIndex: number };

const WIDTH = TABLE_DIMENSIONS.structuralColumnWidth;

/**
 * The leading structural columns — group toggle, selection checkbox, expand
 * chevron — in render order.
 *
 * Four renderers read this list instead of building their own: `TableHead` and
 * `TableRow` render a cell per entry, `SummaryRow` a spacer, `TableDesktop` a
 * `<col>` track. A column added here appears in all four, in this order, at this
 * width, on both sides of the `w-12` / `3rem` unit split — which is what makes
 * the tracks and the cells they size unable to disagree. They already did once:
 * the STATUS column sat ~130px right of its badges (#14 / #154), and the
 * `<colgroup>` that fixed it kept its own copy of the list until now.
 *
 * `flag` is the whole existence rule, and the reason the virtualized layout
 * needs no exception for the group column: `virtualizedActive` requires
 * `!effectiveGroupBy`, so `grouped` is already false wherever tracks render, and
 * the entry drops out on its own rather than by a filter someone has to
 * remember.
 *
 * A column counts for `aria-colindex` whether or not the renderer puts anything
 * announceable in its cell — a row inside a grouped table renders the group cell
 * `aria-hidden`, and the column still occupies index 1. So `colIndex` comes from
 * this list while `aria-hidden` stays with the renderer: "the table has this
 * column" and "this cell says something" are two questions. `aria-colcount`
 * counts every column, so a cell index that skipped one would contradict the
 * declared width — measured before this list existed: colcount 3 beside data
 * cells claiming 1..2 and an indexless selection cell.
 */
export const STRUCTURAL_COLUMNS: readonly StructuralColumn[] = (
  [
    { key: 'group', flag: 'grouped' },
    { key: 'selection', flag: 'selectable' },
    { key: 'expand', flag: 'expandable' }
  ] as const
).map(({ key, flag }) => ({
  key,
  flag,
  widthClass: WIDTH[key],
  widthCss: widthClassToRem(WIDTH[key])
}));

/** The structural columns this table has, in render order, each with its index. */
export function structuralColumns(flags: StructuralColumnFlags): PresentStructuralColumn[] {
  return STRUCTURAL_COLUMNS.filter((column) => flags[column.flag]).map((column, index) => ({
    ...column,
    colIndex: index + 1
  }));
}

/**
 * How many structural columns precede the data columns — the offset
 * `aria-colindex` counts from, and the number a full column span adds to the
 * data columns.
 */
export function leadingStructuralColumns(flags: StructuralColumnFlags): number {
  return STRUCTURAL_COLUMNS.filter((column) => flags[column.flag]).length;
}
