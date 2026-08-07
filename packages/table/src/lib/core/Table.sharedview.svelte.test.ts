// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTableView } from '$lib/view/view.svelte';
import type { InternalTableContext } from '../stores/TableStore.svelte';
import TableHarness from './__fixtures__/TableHarness.svelte';
import type { TableContext } from './table/index';

/**
 * Two tables on ONE view object — the §7.2 rest case the spike left unmeasured
 * (review m6: "the nearest source of conflict after the bindings, due as a
 * test when it is built").
 *
 * The view is a consumer-owned identity, and nothing in `TableProvider` claims
 * it: `resolveViewProp` takes the object as given, so handing the same one to
 * two tables is legal by construction. What that MEANS is what this file pins.
 * The answers below are measured, not intended — where the coupling is a limit
 * rather than a feature it is marked KNOWN-LIMIT and says why.
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
  { id: 1, name: 'Ada', amount: 300 },
  { id: 2, name: 'Grace', amount: 100 },
  { id: 3, name: 'Radia', amount: 200 }
];

interface Mounted {
  target: HTMLElement;
  comp: Record<string, unknown>;
  // Wide on purpose: these tests drive in-tree members (setPage) too.
  ctx: InternalTableContext;
  rows: () => string[];
}

let mounted: Mounted[] = [];

/** One table of the pair. Both get the same `view` object and their own tree. */
function mountTable(props: Record<string, unknown>): Mounted {
  const target = document.createElement('div');
  document.body.appendChild(target);
  let ctx: InternalTableContext | undefined;
  const comp = mount(TableHarness, {
    target,
    props: {
      items: ROWS,
      onReady: (c: TableContext) => (ctx = c as InternalTableContext),
      ...props
    }
  }) as Record<string, unknown>;
  flushSync();
  if (!ctx) throw new Error('onReady never fired');
  const entry: Mounted = {
    target,
    comp,
    ctx,
    rows: () =>
      [...target.querySelectorAll('tbody tr')].map((tr) =>
        (tr.textContent ?? '').replace(/\s+/g, ' ').trim()
      )
  };
  mounted.push(entry);
  return entry;
}

function unmountOne(entry: Mounted): void {
  unmount(entry.comp);
  entry.target.remove();
  mounted = mounted.filter((m) => m !== entry);
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true });
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  for (const entry of mounted) {
    unmount(entry.comp);
    entry.target.remove();
  }
  mounted = [];
  warn.mockRestore();
});

describe('two tables, one view — the axes are shared, by construction', () => {
  it('a search made in one table filters the other', () => {
    const view = createTableView();
    const a = mountTable({ view });
    const b = mountTable({ view });
    expect(a.rows()).toHaveLength(3);
    expect(b.rows()).toHaveLength(3);

    a.ctx.setSearch('ada');
    flushSync();

    // Not a defect: one view IS one sight. Two tables that must filter
    // independently are two views — the object is the unit of sharing.
    expect(view.search).toBe('ada');
    expect(a.rows()).toHaveLength(1);
    expect(b.rows()).toHaveLength(1);
    expect(b.rows()[0]).toContain('Ada');
  });

  it('a sort made in one table reorders the other', () => {
    const view = createTableView();
    const a = mountTable({ view });
    const b = mountTable({ view });

    a.ctx.setSort({ column: 'amount', direction: 'asc' });
    flushSync();

    expect(view.sort).toEqual({ column: 'amount', direction: 'asc' });
    expect(b.rows()[0]).toContain('Grace'); // amount 100
    expect(b.rows().at(-1)).toContain('Ada'); // amount 300
  });

  it('a page change in one table pages the other', () => {
    const view = createTableView({ defaults: { pageSize: 1 } });
    const a = mountTable({ view });
    const b = mountTable({ view });
    expect(b.rows()[0]).toContain('Ada');

    a.ctx.setPage(2);
    flushSync();

    expect(view.page).toBe(2);
    expect(b.rows()).toHaveLength(1);
    expect(b.rows()[0]).toContain('Grace');
  });
});

describe('two tables, one view — unmounting one', () => {
  it('leaves the survivor interactive and the view untouched', () => {
    const view = createTableView();
    const a = mountTable({ view });
    const b = mountTable({ view });

    a.ctx.setSearch('ada');
    flushSync();
    unmountOne(a);
    flushSync();

    // The view is the consumer's object: no table's teardown resets it, and
    // the survivor keeps rendering the state the dead table left behind.
    expect(view.search).toBe('ada');
    expect(b.rows()).toHaveLength(1);

    b.ctx.setSearch('');
    flushSync();
    expect(view.search).toBe('');
    expect(b.rows()).toHaveLength(3);
  });

  it('lets a third table mount onto the same view and inherit its state', () => {
    const view = createTableView();
    const a = mountTable({ view });
    a.ctx.setSort({ column: 'amount', direction: 'asc' });
    flushSync();
    unmountOne(a);

    // No claim was taken and none is stuck: a remounting `{#if}` child on a
    // parent-owned view is the everyday version of this. Ascending by amount,
    // deliberately: the unsorted order starts with Ada, so this would hold
    // with the inheritance cut.
    const c = mountTable({ view });
    expect(c.rows()[0]).toContain('Grace'); // amount 100
    expect(c.rows().at(-1)).toContain('Ada'); // amount 300
  });
});

describe('two tables, one view — where the sharing bites', () => {
  it('KNOWN-LIMIT: a virtualized table discards the grouping of a sibling it mounts next to', () => {
    // The virtualized × grouping discard is a `system` write onto the VIEW
    // (TableProvider), because that is what lets a URL binding clean the param
    // and a storage binding keep the reader's wish. On a shared view the write
    // is not scoped to the table that made it: the un-virtualized sibling
    // loses the grouping it can perfectly well render.
    //
    // Pinned as a limit, not fixed: the fix is either a per-table discard
    // (which would re-introduce the view/render divergence #157 removed) or
    // refusing a shared view on a virtualized table. Give the virtualized
    // table its own view until that is decided.
    const view = createTableView();
    const plain = mountTable({ view });

    // Control first, in the same test: alone, the grouping stands — so the
    // discard below cannot be "setGroupBy never worked".
    plain.ctx.setGroupBy('name');
    flushSync();
    expect(view.groupBy).toBe('name');
    expect(plain.ctx.state.effectiveGroupBy).toBe('name');

    mountTable({ view, virtualized: true });
    flushSync();

    expect(view.groupBy).toBeNull();
    expect(view.originOf('groupBy').origin).toBe('system');
    expect(plain.ctx.state.effectiveGroupBy).toBeNull();
  });

  it('KNOWN-LIMIT: a mounted virtualized table reverts a sibling grouping made later', () => {
    // The runtime half of the same discard, and the sharper one: the reader
    // groups in the un-virtualized table, the table accepts it (its own gate
    // is open), and the virtualized sibling's effect takes it back in the same
    // flush. The reader sees a grouping control that does nothing.
    const view = createTableView();
    const plain = mountTable({ view });
    const control = plain.ctx.setGroupBy;
    mountTable({ view, virtualized: true });
    flushSync();

    control('name');
    flushSync();

    expect(view.groupBy).toBeNull();
    expect(view.originOf('groupBy').origin).toBe('system');
    expect(plain.ctx.state.effectiveGroupBy).toBeNull();
  });

  it('KNOWN-LIMIT: a managed source on both tables fetches twice per interaction', async () => {
    // Each table runs its own `createManagedFetch` over the shared view, so
    // one reader interaction produces one fetch PER table. Two tables sharing
    // a view and a managed source is therefore a doubling, not a cache —
    // wire the fetch once and hand both tables a manual `processing: 'server'`
    // source if that matters. `debounceMs: 0` only shortens the wait; the
    // first fetch is immediate on either setting.
    const view = createTableView();
    const query = vi.fn(async () => ({ items: ROWS, total: 3 }));
    const a = mountTable({
      items: undefined,
      source: { processing: 'server', query, debounceMs: 0 },
      view
    });
    mountTable({ items: undefined, source: { processing: 'server', query, debounceMs: 0 }, view });
    await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(2)); // one per table, at mount

    a.ctx.setSearch('ada');
    flushSync();
    await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(4)); // ONE interaction
  });
});
