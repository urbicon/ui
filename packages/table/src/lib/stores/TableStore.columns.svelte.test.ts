// @vitest-environment jsdom
import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';
import type { Column, TableItem } from '$lib';
import { createTableState } from './TableStore.svelte';

/**
 * `state.columns` as the store wires it: the consumer's `columns` prop, minus
 * whatever column visibility hides.
 *
 * Both halves used to be assignments — `TableProvider` pushed the prop in from an
 * `$effect`, and each visibility mutator re-filtered and re-assigned
 * `state.columns` by hand. Neither ran on the server, so the prerendered table
 * had no columns at all (#10). They are now one derivation of two inputs, which
 * is why this suite exists: `concerns.test.ts` covers the concern in isolation
 * and cannot see the wiring, and the wiring is the part that was broken.
 *
 * Deliberately not in an `$effect.root`: reading a derived outside a tracking
 * context is exactly the SSR situation, and it has to work there.
 */

const COLUMNS = [
  { accessor: 'name', title: 'Name' },
  { accessor: 'age', title: 'Age' },
  { accessor: 'email', title: 'Email' }
] as Column[];

const ids = (columns: Column[]) => columns.map((c) => c.accessor);

describe('TableStore — state.columns', () => {
  it('reflects the columns prop with no effect and no tracking context', () => {
    const store = createTableState(undefined, undefined, { columns: () => COLUMNS });
    expect(ids(store.state.columns)).toEqual(['name', 'age', 'email']);
  });

  it('drops a hidden column', () => {
    const store = createTableState(undefined, undefined, { columns: () => COLUMNS });

    store.hideColumn('age');
    expect(ids(store.state.columns)).toEqual(['name', 'email']);

    store.showColumn('age');
    expect(ids(store.state.columns)).toEqual(['name', 'age', 'email']);
  });

  it('follows a changing columns prop', () => {
    let columns = $state<Column[]>([COLUMNS[0]]);
    const store = createTableState(undefined, undefined, { columns: () => columns });

    expect(ids(store.state.columns)).toEqual(['name']);

    columns = COLUMNS;
    expect(ids(store.state.columns)).toEqual(['name', 'age', 'email']);
  });

  it('keeps hiding across a prop change', () => {
    let columns = $state<Column[]>(COLUMNS);
    const store = createTableState(undefined, undefined, { columns: () => columns });

    store.hideColumn('age');
    expect(ids(store.state.columns)).toEqual(['name', 'email']);

    columns = [...COLUMNS, { accessor: 'role', title: 'Role' } as Column];
    expect(ids(store.state.columns)).toEqual(['name', 'email', 'role']);
  });

  it('setColumns overrides the prop, until the prop changes again', () => {
    // In an effect root, because the re-seed of an *overridden* derived needs a
    // tracking context: read outside one (the SSR situation) an assignment simply
    // stays put. Measured, not assumed — the same test without the root keeps
    // returning the overridden value. It costs nothing in practice: a component
    // always provides the context, and during SSR nothing assigns in the first
    // place.
    const cleanup = $effect.root(() => {
      let columns = $state<Column[]>(COLUMNS);
      const store = createTableState(undefined, undefined, { columns: () => columns });

      store.setColumns([{ accessor: 'only', title: 'Only' } as Column]);
      flushSync();
      expect(ids(store.state.columns)).toEqual(['only']);

      // The re-seed: a new prop value takes the slot back. This is the behaviour a
      // hand-written `override ?? prop` getter cannot provide.
      columns = [COLUMNS[0]];
      flushSync();
      expect(ids(store.state.columns)).toEqual(['name']);
    });
    cleanup();
  });
});

describe('TableStore — state.items', () => {
  const ITEMS = [
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Grace' }
  ] as TableItem[];

  it('reflects a plain-array source without a tracking context', () => {
    const store = createTableState(undefined, undefined, { source: () => ITEMS });
    expect(store.state.items.map((i) => i.name)).toEqual(['Ada', 'Grace']);
  });

  it('reflects the client-object source variant too', () => {
    // `{ items, loading?, error? }` — the "I fetch it myself" shape. The item
    // slot must not care which client variant delivered the rows.
    const store = createTableState(undefined, undefined, {
      source: () => ({ items: ITEMS, loading: false })
    });
    expect(store.state.items.map((i) => i.name)).toEqual(['Ada', 'Grace']);
  });

  it('a second writer overrides, a new source re-seeds', () => {
    const cleanup = $effect.root(() => {
      let items = $state<TableItem[]>(ITEMS);
      const store = createTableState(undefined, undefined, { source: () => items });

      // What useLiveUpdates / setServerResult do.
      store.state.items = [...store.state.items, { id: 3, name: 'Radia' } as TableItem];
      flushSync();
      expect(store.state.items.map((i) => i.name)).toEqual(['Ada', 'Grace', 'Radia']);

      items = [{ id: 9, name: 'Barbara' } as TableItem];
      flushSync();
      expect(store.state.items.map((i) => i.name)).toEqual(['Barbara']);
    });
    cleanup();
  });

  it('an emptied source empties the table', () => {
    // Behaviour change, recorded on purpose: the old effect was guarded with
    // `items.length > 0`, so clearing the prop left the previous rows on screen.
    // A derivation has no such asymmetry, and the honest reading of "items=[]"
    // is an empty table.
    let items = $state<TableItem[]>(ITEMS);
    const store = createTableState(undefined, undefined, { source: () => items });
    expect(store.state.items).toHaveLength(2);

    items = [];
    expect(store.state.items).toHaveLength(0);
  });

  it('a fresh managed-source literal does not discard fetched rows', () => {
    // Regression guard for the #153-R1 class, in its v8 shape: an inline
    // `source={{ query: (q) => … }}` hands over a NEW object (and a new
    // function identity) on every parent render. The store's two derived
    // stages exist so that only stable values leave the resolution — for a
    // managed source the item slot is a referentially stable empty list, so
    // the fresh literal must not re-seed `state.items` and throw away what
    // `setServerResult` assigned (nothing would refetch it: the fetch effect
    // tracks the structural view key, not the source identity).
    const seen: number[] = [];
    const cleanup = $effect.root(() => {
      let rev = $state(0);
      const store = createTableState(undefined, undefined, {
        source: () => {
          void rev;
          // Fresh literal AND fresh query identity per evaluation.
          return { query: async () => ({ items: [], totalItems: 0 }) };
        }
      });

      // What setServerResult does with the fetched page.
      store.state.items = ITEMS;
      flushSync();
      seen.push(store.state.items.length);

      // Parent re-renders, inline literal gets a new identity.
      rev += 1;
      flushSync();
      seen.push(store.state.items.length);
    });
    cleanup();
    expect(seen).toEqual([2, 2]);
  });

  it('notifies on a replaced array, NOT on a row edited in place', () => {
    // The one behaviour the derived rewrite took away, pinned so it is a
    // contract rather than an accident. A `$state` data property deep-proxies
    // what is assigned to it; a `$derived` does not wrap its value at all — so
    // writing through to a row still changes the row and tells nobody.
    //
    // Nothing in the library does this (every update path replaces the array),
    // but `onReady` hands the state to consumers, so the boundary is worth a
    // failing test rather than a comment.
    const seen: number[] = [];
    const cleanup = $effect.root(() => {
      const store = createTableState(undefined, undefined, {
        source: () => [{ id: 1, name: 'Ada' }] as TableItem[]
      });
      $effect(() => {
        seen.push(store.state.items.length);
      });
      flushSync();

      store.state.items[0].name = 'Grace';
      flushSync();
      // The write lands — it just does not invalidate anything.
      expect(store.state.items[0].name).toBe('Grace');

      store.state.items = [...store.state.items, { id: 2, name: 'Radia' } as TableItem];
      flushSync();
    });
    cleanup();

    // One run at mount, one for the replacement. The in-place edit adds none.
    expect(seen).toEqual([1, 2]);
  });

  it('normalizes items without an id, as setItems did', () => {
    // `normalizeItems` stamps `__index` (not `id`) on items that have none —
    // the key-stability fallback. The derived has to run it for the same reason
    // `setItems` did, so the server render keys rows the way the client will.
    const store = createTableState(undefined, undefined, {
      source: () => [{ name: 'no id' }] as TableItem[]
    });
    expect(store.state.items[0].__index).toBe(0);
  });
});
