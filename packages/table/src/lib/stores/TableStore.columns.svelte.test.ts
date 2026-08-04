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

  it('reflects the items prop without a tracking context', () => {
    const store = createTableState(undefined, undefined, { items: () => ITEMS });
    expect(store.state.items.map((i) => i.name)).toEqual(['Ada', 'Grace']);
  });

  it('a second writer overrides, a new prop re-seeds', () => {
    const cleanup = $effect.root(() => {
      let items = $state<TableItem[]>(ITEMS);
      const store = createTableState(undefined, undefined, { items: () => items });

      // What useLiveUpdates / useRemoteData do.
      store.state.items = [...store.state.items, { id: 3, name: 'Radia' } as TableItem];
      flushSync();
      expect(store.state.items.map((i) => i.name)).toEqual(['Ada', 'Grace', 'Radia']);

      items = [{ id: 9, name: 'Barbara' } as TableItem];
      flushSync();
      expect(store.state.items.map((i) => i.name)).toEqual(['Barbara']);
    });
    cleanup();
  });

  it('an emptied items prop empties the table', () => {
    // Behaviour change, recorded on purpose: the old effect was guarded with
    // `items.length > 0`, so clearing the prop left the previous rows on screen.
    // A derivation has no such asymmetry, and the honest reading of "items=[]"
    // is an empty table.
    let items = $state<TableItem[]>(ITEMS);
    const store = createTableState(undefined, undefined, { items: () => items });
    expect(store.state.items).toHaveLength(2);

    items = [];
    expect(store.state.items).toHaveLength(0);
  });

  it('a fresh queryFn identity does not discard fetched rows', () => {
    // Regression guard for the hazard the derived rewrite introduced: in managed
    // server mode the item slot is gated on whether a `queryFn` exists. Reading
    // the *function* there made the derived depend on its identity, and
    // `queryFn={(q) => …}` — the form in the package README — hands over a new
    // one on every parent render. That re-seeded `state.items` to `[]` and threw
    // away what `useRemoteData` had assigned, with nothing to refetch it: the
    // fetch effect tracks only `mode` and `queryKey`. TableProvider therefore
    // reads a boolean; this asserts the property that boolean buys.
    const seen: number[] = [];
    const cleanup = $effect.root(() => {
      let queryFn = $state<(() => void) | undefined>(() => {});
      const hasQueryFn = $derived(!!queryFn);
      const store = createTableState(undefined, undefined, {
        mode: () => 'server',
        items: () => (hasQueryFn ? [] : ITEMS)
      });

      // What setServerResult does with the fetched page.
      store.state.items = ITEMS;
      flushSync();
      seen.push(store.state.items.length);

      // Parent re-renders, inline arrow gets a new identity.
      queryFn = () => {};
      flushSync();
      seen.push(store.state.items.length);
    });
    cleanup();
    expect(seen).toEqual([2, 2]);
  });

  it('normalizes items without an id, as setItems did', () => {
    // `normalizeItems` stamps `__index` (not `id`) on items that have none —
    // the key-stability fallback. The derived has to run it for the same reason
    // `setItems` did, so the server render keys rows the way the client will.
    const store = createTableState(undefined, undefined, {
      items: () => [{ name: 'no id' }] as TableItem[]
    });
    expect(store.state.items[0].__index).toBe(0);
  });
});
