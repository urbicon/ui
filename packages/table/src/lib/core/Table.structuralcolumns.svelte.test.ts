// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { widthClassToRem } from '$lib/variants/table.system';
import { createTableView } from '$lib/view/view.svelte';
import TableHarness from './__fixtures__/TableHarness.svelte';
import {
  type PresentStructuralColumn,
  type StructuralColumnFlags,
  structuralColumns
} from './structural-columns';

/**
 * All four renderers of the leading structural columns against one declaration.
 *
 * `TableHead`, `TableRow`, `SummaryRow` and `TableDesktop`'s `<colgroup>` used
 * to enumerate the same three flags for themselves and write the same widths
 * down again — the tracks in `rem`, the cells in Tailwind classes. The tracks
 * and the cells had already drifted apart once (#14 / #154, the STATUS column
 * ~130px right of its badges); the `<colgroup>` closed the symptom and left
 * four lists. What is asserted here is that the four now show the same columns,
 * in the same order, at the same width in both units, over every combination of
 * grouping, selection and expansion.
 *
 * jsdom computes no layout, so this is about what each renderer *declares*.
 * The geometric half needs a browser and belongs in the VR suite — the same
 * split the sibling track test in `Table.render.svelte.test.ts` makes.
 */

const ITEMS = [
  { id: 1, dept: 'A', name: 'Ada', amount: 1 },
  { id: 2, dept: 'A', name: 'Alan', amount: 2 },
  { id: 3, dept: 'B', name: 'Grace', amount: 3 }
];
const COLUMNS = [
  { accessor: 'name', title: 'Name' },
  { accessor: 'amount', title: 'Amount' }
];

/** Every combination of the three flags. */
const COMBOS: StructuralColumnFlags[] = [false, true].flatMap((grouped) =>
  [false, true].flatMap((selectable) =>
    [false, true].map((expandable) => ({ grouped, selectable, expandable }))
  )
);

let target: HTMLElement | undefined;
let comp: Record<string, unknown> | undefined;

function mountTable(extraProps: Record<string, unknown>) {
  target = document.createElement('div');
  document.body.appendChild(target);
  // Erased to `Record<string, unknown>` like the sibling suites: the harness
  // types its columns against its own row shape, and these rows carry the extra
  // `dept` field grouping needs.
  const props: Record<string, unknown> = {
    items: ITEMS,
    columns: COLUMNS,
    // A summary in force, so `SummaryRow` renders at all — it draws only where
    // an aggregation has a visible column to sit in.
    prefs: { defaults: { summaries: [{ column: 'amount', type: 'sum' }] } },
    ...extraProps
  };
  comp = mount(TableHarness, { target, props }) as Record<string, unknown>;
  flushSync();
  return target;
}

/** The props that put a table into the state a flag combination describes. */
function propsFor(flags: StructuralColumnFlags): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  if (flags.grouped) props.view = createTableView({ defaults: { groupBy: 'dept' } });
  if (flags.selectable) props.selectionMode = 'multi';
  // `expandable` is derived from the snippet's presence, not from a prop.
  if (flags.expandable) {
    props.expandedRowContent = createRawSnippet(() => ({ render: () => '<div>detail</div>' }));
  }
  return props;
}

afterEach(() => {
  if (comp) unmount(comp);
  target?.remove();
  comp = undefined;
  target = undefined;
});

/**
 * The structural cells of a row, told apart from the data cells by what the
 * data cells carry rather than by counting: every data cell writes a
 * `data-testid` naming its column (`column-header-…`, `cell-…`,
 * `summary-cell-…`), and no structural cell does. So the count is measured
 * here, not assumed from the declaration the assertions compare against.
 */
function splitCells(row: Element | null | undefined, dataTestIdPrefix: string) {
  const cells = [...(row?.children ?? [])];
  return {
    structural: cells.filter(
      (cell) => !(cell.getAttribute('data-testid') ?? '').startsWith(dataTestIdPrefix)
    ),
    data: cells.filter((cell) =>
      (cell.getAttribute('data-testid') ?? '').startsWith(dataTestIdPrefix)
    )
  };
}

/** The `w-<step>` a cell wears, or `''`. */
function widthClassOf(cell: Element): string {
  return (cell.getAttribute('class') ?? '').split(/\s+/).find((c) => /^w-\d/.test(c)) ?? '';
}

function indicesOf(cells: Element[]): number[] {
  return cells
    .filter((cell) => cell.hasAttribute('aria-colindex'))
    .map((cell) => Number(cell.getAttribute('aria-colindex')));
}

/**
 * A `style` attribute as the DOM hands it back — jsdom re-serialises it with a
 * trailing `;`, which the source has not got.
 */
function normalizeStyle(style: string): string {
  return style.trim().replace(/;$/, '');
}

/** `w-10` ⇄ `w-12` — a wrong-but-plausible width list, for the controls. */
function swapWidths(widths: string[]): string[] {
  return widths.map((w) => (w === 'w-10' ? 'w-12' : 'w-10'));
}

describe('the structural columns, as the four renderers show them', () => {
  it.each(COMBOS)('head, body and summary agree for %o', (flags) => {
    const expected: PresentStructuralColumn[] = structuralColumns(flags);
    const expectedWidths = expected.map((column) => column.widthClass);
    const el = mountTable(propsFor(flags));

    const head = splitCells(el.querySelector('thead tr'), 'column-header-');
    const bodyRow = el.querySelector('tr[data-row-index]');
    const body = splitCells(bodyRow, flags.grouped ? 'grouped-cell-' : 'cell-');
    const summary = splitCells(el.querySelector('[data-testid^="summary-row-"]'), 'summary-cell-');

    // The reader partitions the row rather than slicing off a count it was
    // told: the data half has to come out at the column count, or a structural
    // total of zero would mean nothing.
    expect(head.data).toHaveLength(COLUMNS.length);
    expect(body.data).toHaveLength(COLUMNS.length);
    expect(summary.data).toHaveLength(COLUMNS.length);

    expect(head.structural).toHaveLength(expected.length);
    expect(body.structural).toHaveLength(expected.length);
    expect(summary.structural).toHaveLength(expected.length);

    // One width per column, and the same one in all three rows.
    expect(head.structural.map(widthClassOf)).toEqual(expectedWidths);
    expect(body.structural.map(widthClassOf)).toEqual(expectedWidths);
    expect(summary.structural.map(widthClassOf)).toEqual(expectedWidths);

    // Positive controls in the same rig: the reader distinguishes a column
    // dropped from the front (the count came out of the DOM, not the list) and
    // a width that is the other column's (`w-10` and `w-12` are both present in
    // the full combination, so a reader returning a constant would pass above).
    if (expected.length > 0) {
      expect(head.structural.map(widthClassOf)).not.toEqual(expectedWidths.slice(1));
      expect(body.structural.map(widthClassOf)).not.toEqual(swapWidths(expectedWidths));
      expect(summary.structural.map(widthClassOf)).not.toEqual(swapWidths(expectedWidths));
    }
  });

  it.each(COMBOS)('a column keeps its index where a renderer stays silent for %o', (flags) => {
    const expected = structuralColumns(flags);
    const el = mountTable(propsFor(flags));

    const head = splitCells(el.querySelector('thead tr'), 'column-header-');
    const bodyRow = el.querySelector('tr[data-row-index]');
    const body = splitCells(bodyRow, flags.grouped ? 'grouped-cell-' : 'cell-');

    // The head announces the group toggle and the select-all box; its expand
    // cell is an aria-hidden spacer. The body is the mirror image — no group
    // cell in the tree, chevron and checkbox in it. Either way the column keeps
    // the index the list gives it, which is what stops the data cells from
    // closing the gap.
    expect(indicesOf(head.structural)).toEqual(
      expected.filter((column) => column.key !== 'expand').map((column) => column.colIndex)
    );
    expect(indicesOf(body.structural)).toEqual(
      expected.filter((column) => column.key !== 'group').map((column) => column.colIndex)
    );

    // And the data cells carry on from there, gapless to `aria-colcount`.
    expect(indicesOf(head.data)).toEqual(COLUMNS.map((_column, i) => expected.length + i + 1));

    // Positive control: with a structural column present, the data cells must
    // NOT start at 1 — that is the failure the offset exists to prevent, and
    // the same reader would report it.
    if (expected.length > 0) {
      expect(indicesOf(head.data)[0]).not.toBe(1);
      expect(indicesOf(head.data)[0]).toBe(expected.length + 1);
    }
  });

  // Grouping and virtualization are mutually exclusive (`virtualizedActive`
  // requires `!effectiveGroupBy`), so the tracks exist for these four.
  it.each(COMBOS.filter((flags) => !flags.grouped))(
    'the <col> tracks state the head cells widths in the other unit for %o',
    (flags) => {
      const expected = structuralColumns(flags);
      const el = mountTable({ ...propsFor(flags), virtualized: true, virtualHeight: '400px' });

      const head = splitCells(el.querySelector('thead tr'), 'column-header-');
      const tracks = [...(el.querySelector('colgroup')?.children ?? [])].map((col) =>
        normalizeStyle(col.getAttribute('style') ?? '')
      );

      // One track per column, structural ones first.
      expect(tracks).toHaveLength(expected.length + COLUMNS.length);

      const structuralTracks = tracks.slice(0, expected.length);
      // The cross-unit assertion: the track's CSS length is the head cell's
      // Tailwind class converted, so the two cannot be edited apart.
      expect(structuralTracks).toEqual(
        head.structural.map((cell) => `width: ${widthClassToRem(widthClassOf(cell))}`)
      );
      expect(structuralTracks).toEqual(expected.map((column) => `width: ${column.widthCss}`));

      // Positive control: the same comparison run against the other column's
      // width must fail, or it is passing on a constant.
      if (expected.length > 0) {
        expect(structuralTracks).not.toEqual(
          swapWidths(head.structural.map(widthClassOf)).map(
            (cls) => `width: ${widthClassToRem(cls)}`
          )
        );
      }
    }
  );

  it('spans the group band and the expanded row over every column, structural ones included', () => {
    // Two more readers of the same count. A band that spanned only the data
    // columns would leave the structural slots uncovered, which is visible as a
    // row background stopping short.
    const flags = { grouped: true, selectable: true, expandable: true };
    const expected = structuralColumns(flags);
    const el = mountTable(propsFor(flags));

    const band = el.querySelector('[data-testid^="grouped-row-"] td');
    expect(Number(band?.getAttribute('colspan'))).toBe(COLUMNS.length + expected.length);
    // Positive control: the data columns alone are a different number here.
    expect(Number(band?.getAttribute('colspan'))).not.toBe(COLUMNS.length);
  });
});
