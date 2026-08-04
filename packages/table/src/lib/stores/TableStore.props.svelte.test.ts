import { describe, expect, it } from 'vitest';
import type { TableItem } from '$lib';
import type { TableState } from './concerns/types';
import { createTableState, type TablePropSources } from './TableStore.svelte';

/**
 * The prop → state wiring, one case per source.
 *
 * Every one of these used to be a `$state` field that `TableProvider` filled
 * from an `$effect`. `$effect` does not run on the server, so a prerendered
 * table claimed no rows, no columns and default everything (#10). They are
 * deriveds now — and the whole point of that change is that they resolve
 * *without a tracking context*, which is what these tests read them in.
 *
 * Written after review pointed out that the rewrite shipped with three of
 * seventeen sources covered. The gap mattered more than the count: a
 * mistyped key or a forgotten line in either the `TablePropSources` block or
 * `TableProvider`'s call is invisible — the prop is optional, so the store
 * silently keeps its default and the table renders something plausible.
 *
 * Each case asserts three things, and the third is the one that catches a
 * derived accidentally written as a one-shot initializer:
 *  1. the documented default when the source is absent,
 *  2. the prop's value, read with no tracking context (the SSR situation),
 *  3. a *changed* prop value, same read.
 *
 * Values are deliberately never equal to the default they replace — an
 * earlier test asserted `itemsPerPage` at 10, which is its own default and
 * would have held with the wiring cut.
 *
 * `items` and `columns` are not in this matrix: they carry second writers
 * (live updates, remote fetches, column visibility) and normalisation, and
 * have their own file — TableStore.columns.svelte.test.ts.
 */

type Case = {
  source: keyof TablePropSources;
  field: keyof TableState;
  /** Value when the source is absent. */
  fallback: unknown;
  first: unknown;
  second: unknown;
};

const CASES: Case[] = [
  { source: 'loading', field: 'loading', fallback: false, first: true, second: false },
  { source: 'error', field: 'error', fallback: null, first: 'boom', second: null },
  // The prop is `initialPage`, the state field is `currentPage` — a rename in
  // the middle of the wiring, and the kind of place a typo lands unnoticed.
  { source: 'initialPage', field: 'currentPage', fallback: 1, first: 4, second: 7 },
  { source: 'itemsPerPage', field: 'itemsPerPage', fallback: 10, first: 25, second: 50 },
  { source: 'multiExpand', field: 'multiExpand', fallback: false, first: true, second: false },
  { source: 'groupOrder', field: 'groupOrder', fallback: [], first: ['b', 'a'], second: ['c'] },
  {
    source: 'selectionMode',
    field: 'selectionMode',
    fallback: 'none',
    first: 'multi',
    second: 'single'
  },
  {
    source: 'selectionControlled',
    field: 'selectionControlled',
    fallback: false,
    first: true,
    second: false
  },
  {
    source: 'searchControlled',
    field: 'searchControlled',
    fallback: false,
    first: true,
    second: false
  },
  {
    source: 'rowClickSelects',
    field: 'rowClickSelects',
    fallback: false,
    first: true,
    second: false
  },
  { source: 'activeRowId', field: 'activeRowId', fallback: null, first: 42, second: 'row-7' },
  { source: 'virtualized', field: 'virtualized', fallback: false, first: true, second: false },
  { source: 'mode', field: 'mode', fallback: 'client', first: 'server', second: 'client' },
  {
    source: 'serverTotalItems',
    field: 'serverTotalItems',
    fallback: 0,
    first: 500,
    second: 12
  },
  {
    source: 'enableColumnVisibility',
    field: 'enableColumnVisibility',
    fallback: true,
    first: false,
    second: true
  }
];

describe('TableStore — every prop source reaches its state field', () => {
  it('covers every source the interface declares', () => {
    // Guards the matrix itself: a source added to `TablePropSources` without a
    // case here would otherwise leave this file quietly incomplete, which is
    // the exact failure being fixed. `items` and `columns` live elsewhere.
    const declared: Array<keyof TablePropSources> = [
      'items',
      'columns',
      'loading',
      'error',
      'initialPage',
      'itemsPerPage',
      'multiExpand',
      'groupOrder',
      'selectionMode',
      'selectionControlled',
      'searchControlled',
      'rowClickSelects',
      'activeRowId',
      'virtualized',
      'mode',
      'serverTotalItems',
      'enableColumnVisibility'
    ];
    const covered = new Set<string>([...CASES.map((c) => c.source), 'items', 'columns']);
    expect(declared.filter((d) => !covered.has(d))).toEqual([]);
  });

  for (const { source, field, fallback, first, second } of CASES) {
    describe(`${String(source)} → state.${String(field)}`, () => {
      it('falls back when the source is absent', () => {
        const store = createTableState(undefined, undefined, {});
        expect(store.state[field]).toEqual(fallback);
      });

      it('takes the prop value with no tracking context', () => {
        const store = createTableState(undefined, undefined, {
          [source]: () => first
        } as TablePropSources);
        expect(store.state[field]).toEqual(first);
      });

      it('follows the prop when it changes', () => {
        let value = $state<unknown>(first);
        const store = createTableState(undefined, undefined, {
          [source]: () => value
        } as TablePropSources);
        expect(store.state[field]).toEqual(first);

        value = second;
        expect(store.state[field]).toEqual(second);
      });
    });
  }
});

describe('TableStore — a controlled flag comes from the prop, not from a write', () => {
  // These two gate whether the store owns selection/search or merely mirrors
  // the consumer. Their previous coverage set `state.selectionControlled = true`
  // by hand and asserted the consequence — which tests the consequence and
  // assumes the wiring. `TableProvider` derives both from prop *presence*, so
  // that is what has to be driven here.
  const ITEMS = [{ id: 1 }, { id: 2 }] as TableItem[];

  it('selection stays consumer-owned while the prop is present', () => {
    let present = $state(true);
    const store = createTableState(undefined, undefined, {
      items: () => ITEMS,
      selectionMode: () => 'multi',
      selectionControlled: () => present
    });

    expect(store.state.selectionControlled).toBe(true);

    // The consumer removes `selectedIds`; ownership returns to the store.
    present = false;
    expect(store.state.selectionControlled).toBe(false);
  });

  it('search stays consumer-owned while the prop is present', () => {
    let present = $state(true);
    const store = createTableState(undefined, undefined, {
      items: () => ITEMS,
      searchControlled: () => present
    });

    expect(store.state.searchControlled).toBe(true);

    present = false;
    expect(store.state.searchControlled).toBe(false);
  });
});
