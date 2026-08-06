// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalTableContext } from '../stores/TableStore.svelte';
import TableHarness from './__fixtures__/TableHarness.svelte';
import type { TableContext } from './table/index';

/**
 * The four `TableProvider` runtime effects, driven through a mounted table —
 * the sabotage candidates of the v8 SSR/CSR audit: each of these had store
 * tests around it but no test in which the effect itself demonstrably ran.
 *
 * Red seen (2026-08-06), one sabotage per effect:
 * - controlled apply: with the `selectedIds` effect removed, "applies the
 *   controlled prop" failed (selection stayed empty, then stale).
 * - freeze guard: with the effect's `untrack` removed, "a row click still
 *   changes the selection" failed — the internal write re-ran the effect,
 *   which re-asserted the stale prop and undid the click.
 * - onSelectionChange: with its effect removed, the emission test failed
 *   (spy never called).
 * - enableColumnVisibility=false: with its effect removed, the persisted
 *   hidden set stayed applied and "Amount" was missing from the headers.
 * - DEV report: with the validation effect removed, neither warning fired.
 */

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? (map.get(key) ?? null) : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, String(value))
  };
}

const ROWS = [
  { id: 1, name: 'Ada', amount: 100 },
  { id: 2, name: 'Grace', amount: 200 },
  { id: 3, name: 'Radia', amount: 300 }
];

let target: HTMLElement | undefined;
let comp: Record<string, unknown> | undefined;

function mountTable(props: Record<string, unknown>) {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(TableHarness, { target, props: { items: ROWS, ...props } }) as Record<
    string,
    unknown
  >;
  flushSync();
  return target;
}

const clickRow = (el: HTMLElement, id: number) => {
  const row = el.querySelector(`[data-testid="table-row-${id}"]`);
  expect(row).toBeTruthy();
  row?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  flushSync();
};

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true });
});

afterEach(() => {
  if (comp) unmount(comp);
  target?.remove();
  comp = undefined;
  target = undefined;
  vi.restoreAllMocks();
});

describe('TableProvider — controlled selectedIds', () => {
  it('applies the controlled prop, and a later prop value replaces the selection', () => {
    const props = $state<Record<string, unknown>>({
      items: ROWS,
      selectionMode: 'multi',
      selectedIds: [1]
    });
    let ctx: TableContext | undefined;
    props.onReady = (c: TableContext) => (ctx = c);

    target = document.createElement('div');
    document.body.appendChild(target);
    comp = mount(TableHarness, { target, props }) as Record<string, unknown>;
    flushSync();

    expect([...(ctx?.state.selectedIds ?? [])]).toEqual([1]);
    expect(target.querySelector('[data-testid="table-row-1"]')?.getAttribute('aria-selected')).toBe(
      'true'
    );

    props.selectedIds = [2];
    flushSync();
    expect([...(ctx?.state.selectedIds ?? [])]).toEqual([2]);
    expect(target.querySelector('[data-testid="table-row-1"]')?.getAttribute('aria-selected')).toBe(
      'false'
    );
  });

  it('a row click still changes the selection — the apply effect must not freeze it', () => {
    // The counter-direction of the apply: `setSelectedIds` READS
    // `state.selectedIds` on its write path, so without the effect's
    // `untrack` every internal row click would re-run the apply, re-assert
    // the stale prop value and freeze the selection against the user.
    const el = mountTable({
      selectionMode: 'multi',
      rowClickSelects: true,
      selectedIds: [2]
    });

    clickRow(el, 3);

    expect(el.querySelector('[data-testid="table-row-3"]')?.getAttribute('aria-selected')).toBe(
      'true'
    );
    // The controlled value is untouched until the parent hands in a new prop.
    expect(el.querySelector('[data-testid="table-row-2"]')?.getAttribute('aria-selected')).toBe(
      'true'
    );
  });
});

describe('TableProvider — onSelectionChange', () => {
  it('emits the selected items when the user selects through the table', () => {
    const seen: Array<Array<{ id: number; name: string }>> = [];
    const el = mountTable({
      selectionMode: 'multi',
      rowClickSelects: true,
      onSelectionChange: (items: Array<{ id: number; name: string }>) => seen.push(items)
    });

    // The effect runs once on mount with the (empty) initial selection.
    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(seen.at(-1)).toEqual([]);

    clickRow(el, 1);
    expect(seen.at(-1)).toEqual([expect.objectContaining({ id: 1, name: 'Ada' })]);

    clickRow(el, 3);
    expect(seen.at(-1)).toEqual([
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 3 })
    ]);
  });
});

describe('TableProvider — enableColumnVisibility={false}', () => {
  it('renders every column and drops a persisted hidden set', () => {
    // The counter-half — that with the flag ON the same stored set hides the
    // column — is pinned in Table.render.svelte.test.ts ("applies the stored
    // column preference"). Here the flag is off, so all columns must render:
    // otherwise persisted-hidden columns would be stranded (hidden, with both
    // restore UIs gated off).
    window.localStorage.setItem(
      'urbicon_table_hidden_columns_prefs_v1',
      JSON.stringify(['amount'])
    );

    // Wide: `hiddenColumnKeys` is column-visibility plumbing, in-tree surface.
    let ctx: InternalTableContext | undefined;
    const el = mountTable({
      prefs: { storage: 'prefs' },
      enableColumnVisibility: false,
      onReady: (c: TableContext) => (ctx = c as InternalTableContext)
    });

    const headers = [...el.querySelectorAll('th')].map((h) => h.textContent ?? '');
    expect(headers.some((h) => h.includes('Amount'))).toBe(true);
    expect(ctx?.hiddenColumnKeys.size).toBe(0);
  });
});

describe('TableProvider — DEV column report', () => {
  it('warns when the columns fail validation (invalid align)', () => {
    // Not a duplicate-id pair: two columns resolving to one id blow up the
    // keyed {#each} before the report effect ever runs. An invalid `align`
    // renders fine and is exactly the class of slip the report is for.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mountTable({
      columns: [
        { accessor: 'name', title: 'Name', align: 'middle' },
        { accessor: 'amount', title: 'Amount' }
      ]
    });

    expect(warn.mock.calls.some((call) => call[0] === '[Table] Column validation:')).toBe(true);
  });

  it("warns when the view's sort column matches no column id", () => {
    // This value usually arrives via a URL or the view defaults, so it can be
    // set by whoever sent the link — the table renders unsorted, silently,
    // unless the DEV effect surfaces it.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mountTable({ viewDefaults: { sort: { column: 'nope', direction: 'asc' } } });

    expect(
      warn.mock.calls.some(
        (call) => typeof call[0] === 'string' && call[0].includes('sort column "nope"')
      )
    ).toBe(true);
  });
});
