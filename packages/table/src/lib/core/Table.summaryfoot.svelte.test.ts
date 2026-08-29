// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { Column } from '$lib/types/tableTypes';
import type { InternalTableContext } from '../stores/TableStore.svelte';
import TableHarness from './__fixtures__/TableHarness.svelte';
import type { TableContext } from './table/index';

/**
 * Where the total summary row renders, and when it pins.
 *
 * One rule decides the pin: the summary `<tfoot>` pins to the bottom edge of
 * the scroll box the table owns, whenever it owns one — `virtualized` or
 * `fit="viewport"`. A page-relative table has no bottom edge to pin against and
 * keeps the foot in the flow, looking exactly as it did as the last row of the
 * `<tbody>`.
 *
 * The two halves of the pin are asserted together in every configuration on
 * purpose: the `<tfoot>`'s `sticky` and the row's shadow-instead-of-border are
 * one decision, and either one alone is a defect — a pinned foot with a
 * collapsed top border leaves the border behind at its static position, and an
 * unpinned row drawing its rule as a shadow loses it to the row above.
 *
 * Structure only. Whether the pinned foot actually lands on the box's bottom
 * edge needs a layout engine — `e2e/table-contained.spec.ts` and
 * `e2e/table-virtualized.spec.ts`.
 */

const ROWS = [
  { id: 1, name: 'Ada', amount: 100, dept: 'Platform' },
  { id: 2, name: 'Grace', amount: 200, dept: 'Design' },
  { id: 3, name: 'Radia', amount: 300, dept: 'Platform' }
];

const COLUMNS = [
  { accessor: 'name', title: 'Name' },
  { accessor: 'amount', title: 'Amount', dataType: 'number' },
  { accessor: 'dept', title: 'Department', groupable: true }
] as Column[];

const SUMMARY = { defaults: { summaries: [{ column: 'amount', type: 'sum' as const }] } };

let mounted: Array<{ comp: Record<string, unknown>; target: HTMLElement }> = [];

afterEach(() => {
  for (const { comp, target } of mounted.splice(0)) {
    unmount(comp);
    target.remove();
  }
  mounted = [];
});

let context: InternalTableContext | undefined;

function mountTable(props: Record<string, unknown> = {}): HTMLElement {
  const target = document.createElement('div');
  document.body.appendChild(target);
  context = undefined;
  // Typed wide, like the sister suites: the harness pins its own Row shape and
  // this fixture's summable + groupable columns are not it.
  const merged: Record<string, unknown> = {
    items: ROWS,
    columns: COLUMNS,
    prefs: SUMMARY,
    // `hideColumn` and `state` live on the internal surface, like the sister
    // suites that drive a mounted table.
    onReady: (c: TableContext) => (context = c as InternalTableContext),
    ...props
  };
  const comp = mount(TableHarness, { target, props: merged }) as Record<string, unknown>;
  flushSync();
  mounted.push({ comp, target });
  return target;
}

const ctx = () => {
  if (!context) throw new Error('onReady never fired');
  return context;
};

/** The desktop grid — the mobile card list carries its own totals band. */
const gridOf = (root: HTMLElement) =>
  root.querySelector('[data-table-layout="desktop"] table') as HTMLTableElement;

const classesOf = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/);

/**
 * The four configurations the one rule has to cover, and what it says about
 * each. `virtualized` and `fit="viewport"` are two different boxes; the rule
 * does not distinguish them, which is the whole of the claim.
 */
const CONFIGURATIONS = [
  { label: 'page-relative (default)', props: {}, pinned: false },
  { label: 'page-relative, sticky="header"', props: { sticky: 'header' }, pinned: false },
  { label: 'contained, fit="viewport"', props: { fit: 'viewport' }, pinned: true },
  {
    label: 'virtualized',
    props: { virtualized: true, virtualHeight: '400px' },
    pinned: true
  }
] as const;

describe('the total summary is a <tfoot>, in every configuration', () => {
  for (const { label, props, pinned } of CONFIGURATIONS) {
    it(`${label}: the total renders in the foot and not in the body`, () => {
      const table = gridOf(mountTable(props));

      expect(table.querySelector('tfoot [data-testid="summary-row-total"]')).not.toBeNull();
      expect(table.querySelector('tbody [data-testid="summary-row-total"]')).toBeNull();
      // A row group, not a row inside one: the foot is the `<table>`'s own
      // child, which is what a `position: sticky` bottom edge needs and what
      // the element means.
      expect(table.tFoot?.parentElement).toBe(table);
      expect([...table.children].map((el) => el.tagName)).toContain('TFOOT');
    });

    it(`${label}: pinned=${pinned} on the foot and on the row alike`, () => {
      const table = gridOf(mountTable(props));
      const foot = classesOf(table.tFoot);
      const row = classesOf(table.querySelector('tfoot [data-testid="summary-row-total"]'));

      if (pinned) {
        expect(foot).toContain('sticky');
        expect(foot).toContain('bottom-0');
        // Opaque, or the rows scrolling under the foot show through the row's
        // tint.
        expect(foot).toContain('bg-surface-elevated');
        // The rule travels as a shadow, and the collapsed border it replaces is
        // folded away so the two cannot stack.
        expect(row).toContain('border-t-0');
        expect(row).not.toContain('border-t-2');
        expect(row.join(' ')).toMatch(/shadow-\[0_-2px_0_0_var\(--color-summary\)\]/);
      } else {
        expect(foot).not.toContain('sticky');
        expect(foot.filter(Boolean)).toEqual([]);
        // Unchanged from the row's life as the last child of the `<tbody>`.
        expect(row).toContain('border-t-2');
        expect(row).not.toContain('border-t-0');
        expect(row.join(' ')).not.toMatch(/shadow-/);
      }
    });
  }
});

describe('what the rule does NOT pin', () => {
  it('a group summary belongs to its group and stays in the body', () => {
    for (const fit of ['content', 'viewport'] as const) {
      const table = gridOf(mountTable({ fit, viewDefaults: { groupBy: 'dept' } }));

      expect(table.querySelector('tbody [data-testid="summary-row-Platform"]')).not.toBeNull();
      expect(table.querySelector('tbody [data-testid="summary-row-Design"]')).not.toBeNull();
      // Grouped, there is no total — so no foot to pin, in either scroll model.
      expect(table.tFoot).toBeNull();
      expect(table.querySelector('[data-testid="summary-row-total"]')).toBeNull();
    }
  });

  it('a virtualized table that falls back to the standard branch has no box', () => {
    // `virtualized` is not the term — the box is. A loading table renders a
    // single row instead of a window, so the standard branch takes over and the
    // `virtualHeight` box does not exist to pin anything against.
    const root = mountTable({
      virtualized: true,
      virtualHeight: '400px',
      source: { processing: 'client', items: ROWS, loading: true, error: null }
    });

    expect(root.querySelector('[data-testid="virtual-scroll-container"]')).toBeNull();
    expect(gridOf(root).tFoot).toBeNull();
  });

  it('a body with no data rows carries no total, in any of the four', () => {
    // The total is the total OF the data rows; over the loading, error and
    // empty bodies there is nothing to add up.
    for (const props of [
      {},
      { fit: 'viewport' },
      { virtualized: true, virtualHeight: '400px' }
    ] as const) {
      const table = gridOf(mountTable({ items: [], ...props }));
      expect(table.tFoot, `empty, ${JSON.stringify(props)}`).toBeNull();
    }

    const source = { processing: 'client' as const, items: ROWS };
    const loading = gridOf(mountTable({ source: { ...source, loading: true, error: null } }));
    expect(loading.tFoot).toBeNull();
    const failed = gridOf(mountTable({ source: { ...source, loading: false, error: 'nope' } }));
    expect(failed.tFoot).toBeNull();
  });

  it('fit="viewport" refused by virtualization still pins — the box is the term', () => {
    // `<Table fit="viewport" virtualized>` resolves `contained` to false and
    // warns; the virtualized box is what pins the foot. The two halves of the
    // disjunction are independently sufficient, which is what makes it one rule.
    const realWarn = console.warn;
    console.warn = () => {};
    try {
      const root = mountTable({ fit: 'viewport', virtualized: true, virtualHeight: '400px' });
      expect(root.querySelector('[data-table-container]')?.getAttribute('data-fit')).toBe(
        'content'
      );
      expect(classesOf(gridOf(root).tFoot)).toContain('sticky');
    } finally {
      console.warn = realWarn;
    }
  });

  it('hiding the last summarised column takes the whole foot, not just its row', () => {
    // `SummaryRow` draws only where a RENDERED column carries an aggregation —
    // hiding the last one leaves it nothing to draw. The foot around it has to
    // read the same answer, or a pinned, highlighted, zero-height strip stays
    // behind: the defect that gate exists for, one element up.
    const root = mountTable({ fit: 'viewport' });
    const table = gridOf(root);
    expect(table.tFoot?.querySelector('[data-testid="summary-row-total"]')).not.toBeNull();

    ctx().hideColumn('amount');
    flushSync();

    // Still in force — the list of aggregations is not filtered by visibility.
    expect(ctx().state.effectiveSummaryConfigs.length).toBe(1);
    expect(table.tFoot).toBeNull();
    expect(root.querySelector('tfoot')).toBeNull();
  });

  it('no summary configured, no foot', () => {
    const table = gridOf(mountTable({ prefs: undefined, fit: 'viewport' }));
    expect(table.tFoot).toBeNull();
  });
});

describe('unstyled', () => {
  // The pin is a look expressed in classes, and `unstyled` takes looks. Both
  // boxes, because the rule is one rule: a consumer who restyles a contained
  // table gets the same bare foot a virtualized one gets.
  for (const props of [
    { label: 'contained', props: { fit: 'viewport' } },
    { label: 'virtualized', props: { virtualized: true, virtualHeight: '400px' } }
  ] as const) {
    it(`${props.label}: drops the sticky foot and the row's shadow`, () => {
      const table = gridOf(mountTable({ ...props.props, unstyled: true }));
      const row = table.querySelector('tfoot [data-testid="summary-row-total"]');

      expect(row).not.toBeNull();
      expect(classesOf(table.tFoot).filter(Boolean)).toEqual([]);
      expect(classesOf(row).join(' ')).not.toMatch(/shadow-/);
    });
  }
});
