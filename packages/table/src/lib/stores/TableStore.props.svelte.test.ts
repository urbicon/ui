import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TableItem } from '$lib';
import type { TableSource } from '$lib/view/source';
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
 * Since v8 the loose `items`/`loading`/`error`/`mode`/`serverTotalItems`/
 * `queryFn` props are ONE `source` getter (the `TableSource` union), and the
 * view axes (`initialPage`, `itemsPerPage`, …) live on the view object — so
 * the matrix below covers the simple pass-throughs, and a second block covers
 * what the store derives *out of* the source.
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
 * `source` and `columns` are not in this matrix: they carry second writers
 * (live updates, managed fetches, column visibility) and normalisation.
 * `columns`/`items` have their own file — TableStore.columns.svelte.test.ts —
 * and the source-derived slots are covered below.
 */

// These tests run in node with no component context; a `TableView`
// constructed there warns (module-scope views on the server are
// cross-request state). Correct in production, noise here.
beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

type Case = {
  source: keyof TablePropSources;
  field: keyof TableState;
  /** Value when the source is absent. */
  fallback: unknown;
  first: unknown;
  second: unknown;
};

const CASES: Case[] = [
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
    source: 'rowClickSelects',
    field: 'rowClickSelects',
    fallback: false,
    first: true,
    second: false
  },
  { source: 'activeRowId', field: 'activeRowId', fallback: null, first: 42, second: 'row-7' },
  { source: 'virtualized', field: 'virtualized', fallback: false, first: true, second: false },
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
    // the exact failure being fixed. `source` is covered by the derived block
    // below, `columns` in TableStore.columns.svelte.test.ts.
    const declared: Array<keyof TablePropSources> = [
      'source',
      'columns',
      'multiExpand',
      'groupOrder',
      'selectionMode',
      'selectionControlled',
      'rowClickSelects',
      'activeRowId',
      'virtualized',
      'enableColumnVisibility'
    ];
    const covered = new Set<string>([...CASES.map((c) => c.source), 'source', 'columns']);
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

describe('TableStore — the source union feeds the derived slots', () => {
  // What used to be four independent props (`loading`, `error`, `mode`,
  // `serverTotalItems`) is now derived out of ONE `source` value, so a wrong
  // combination is unrepresentable — and each derivation still has to
  // resolve without a tracking context (SSR) and follow the prop.
  const ITEMS = [{ id: 1 }, { id: 2 }] as TableItem[];

  it('defaults: no source means client mode, not loading, no error, total 0', () => {
    const store = createTableState(undefined, undefined, {});
    expect(store.state.mode).toBe('client');
    expect(store.state.loading).toBe(false);
    expect(store.state.error).toBeNull();
    expect(store.state.serverTotalItems).toBe(0);
    expect(store.state.items).toEqual([]);
  });

  it('a client source carries loading and error', () => {
    let value = $state<TableSource>({ items: ITEMS, loading: true, error: 'boom' });
    const store = createTableState(undefined, undefined, { source: () => value });

    expect(store.state.mode).toBe('client');
    expect(store.state.loading).toBe(true);
    expect(store.state.error).toBe('boom');

    value = { items: ITEMS, loading: false, error: null };
    expect(store.state.loading).toBe(false);
    expect(store.state.error).toBeNull();
  });

  it('a manual server source sets mode and serverTotalItems', () => {
    let value = $state<TableSource>({ kind: 'server', items: ITEMS, total: 500 });
    const store = createTableState(undefined, undefined, { source: () => value });

    expect(store.state.mode).toBe('server');
    expect(store.state.serverTotalItems).toBe(500);
    expect(store.state.items).toHaveLength(2);

    value = { kind: 'server', items: ITEMS, total: 12 };
    expect(store.state.serverTotalItems).toBe(12);

    // Back to a plain array: the mode is derived, so it follows.
    value = ITEMS;
    expect(store.state.mode).toBe('client');
    expect(store.state.serverTotalItems).toBe(0);
  });

  it('a managed source is server mode with an empty item slot', () => {
    const store = createTableState(undefined, undefined, {
      source: () => ({ query: async () => ({ items: [], totalItems: 0 }) })
    });

    // The fetch lifecycle lives in `createManagedFetch` (driven by the
    // provider); the store itself only reports the mode and waits for
    // `setServerResult`.
    expect(store.state.mode).toBe('server');
    expect(store.state.items).toEqual([]);
    expect(store.state.loading).toBe(false);
  });

  it('mode is read-only derived — there is no mode prop to disagree with', () => {
    // The old `mode` prop could say 'client' while a queryFn was wired; the
    // union makes that unrepresentable. The state field has no setter.
    const store = createTableState(undefined, undefined, {
      source: () => ({ kind: 'server' as const, items: ITEMS, total: 2 })
    });
    expect(store.state.mode).toBe('server');
    expect(Object.getOwnPropertyDescriptor(store.state, 'mode')?.set).toBeUndefined();
  });
});

describe('TableStore — a controlled flag comes from the prop, not from a write', () => {
  // This gates whether the store owns selection or merely mirrors the
  // consumer. Its previous coverage set `state.selectionControlled = true`
  // by hand and asserted the consequence — which tests the consequence and
  // assumes the wiring. `TableProvider` derives the flag from prop
  // *presence*, so that is what has to be driven here.
  //
  // The `searchControlled` twin is gone with v8: search is a view axis, the
  // view is the single write surface, and "controlled search" stopped being
  // a representable state — there is no prop left to own it.
  const ITEMS = [{ id: 1 }, { id: 2 }] as TableItem[];

  it('selection stays consumer-owned while the prop is present', () => {
    let present = $state(true);
    const store = createTableState(undefined, undefined, {
      source: () => ITEMS,
      selectionMode: () => 'multi',
      selectionControlled: () => present
    });

    expect(store.state.selectionControlled).toBe(true);

    // The consumer removes `selectedIds`; ownership returns to the store.
    present = false;
    expect(store.state.selectionControlled).toBe(false);
  });
});
