// @vitest-environment jsdom
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Filter } from '$lib/types/tableTypes';
import { bindViewToStorage, STORAGE_DEFAULT_AXES } from './storage-binding.svelte';
import { createTableView, VIEW_AXES } from './view.svelte';

/**
 * The storage binding, measured — ported from the v8 spike (spike.origin /
 * spike.composition / spike.review-fixes at 5c0f42f8) against the
 * productised module, plus the two product features without a spike
 * precedent: per-axis shape validation on read and claim release in the
 * destroy teardown (the remount case).
 *
 * Scenarios that need the URL binding itself (echo over goto, back button,
 * merge into a foreign URL, lost updates, URL↔storage registration order
 * through real bindings) moved to sveltekit-utils with that binding. Where a
 * scenario only needed "a URL binding applied at init", the product's own
 * init surface — `applyExternal(..., 'external')` + `markInitApplied([...])`
 * — stands in for it; that pair is exactly what the URL binding calls.
 */

const aFilter: Filter = { column: 'name', operator: 'contains', value: 'ad' };

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

let storage: Storage;

beforeEach(() => {
  vi.useFakeTimers();
  storage = memoryStorage();
});

afterEach(() => {
  vi.useRealTimers();
});

const KEY = 'urbicon_table_view_bind_v1';
const storedView = (): Record<string, unknown> | null => {
  const raw = storage.getItem(KEY);
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
};
const seedStorage = (value: Record<string, unknown>) => {
  storage.setItem(KEY, JSON.stringify(value));
};

describe('origin discrimination through the binding (§7.1, candidate 1)', () => {
  it('a user edit and an external apply on DIFFERENT axes coalesce into one flush without mixing origins', () => {
    // Observer with the same dependencies as the storage effect — proves the
    // "one run for both writes" half directly instead of inferring it from
    // the outcome (review m1): registration + one batched run.
    let observerRuns = 0;
    const cleanup = $effect.root(() => {
      const view = createTableView();
      // All six axes bound explicitly — this test measures origin mechanics,
      // not the page-exclusion default (pinned below).
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 100, axes: VIEW_AXES });
      $effect(() => {
        void view.page;
        void view.search;
        observerRuns += 1;
      });
      flushSync(); // registration pass — establishes the revision baseline
      expect(observerRuns).toBe(1);

      // The §7.1 measurement setup: a click and a programmatic navigation in
      // the same tick. One storage-effect run sees both changes.
      view.page = 3; // reader interaction
      view.applyExternal({ search: 'from-url' }, 'external'); // URL application
      flushSync();
      expect(observerRuns).toBe(2); // ONE batched run for both writes
    });
    vi.advanceTimersByTime(150);

    // Per-axis bookkeeping keeps the origins apart even though the effect ran
    // once for both writes: the user's page is stored, the external search is
    // not. A single boolean/global origin would have answered wrongly here.
    expect(storedView()).toEqual({ page: 3 });
    cleanup();
  });

  it('an echo on the SAME axis in the same flush is a no-op and cannot re-label the user edit', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 100 });
      flushSync();

      view.filters = [aFilter]; // reader interaction
      // The URL echo delivers a structurally identical but referentially
      // fresh array — the case `Object.is` does not cover.
      view.applyExternal({ filters: [{ ...aFilter }] }, 'external');
      flushSync();
    });
    vi.advanceTimersByTime(150);

    expect(storedView()).toEqual({ filters: [aFilter] });
    cleanup();
  });

  it('when an external write CHANGES the same axis after the user in one flush, last-writer wins and nothing is stored', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 100, axes: VIEW_AXES });
      flushSync();

      view.page = 3;
      view.applyExternal({ page: 7 }, 'external'); // a genuinely different value
      flushSync();

      // The view holds the external value…
      expect(view.page).toBe(7);
    });
    vi.advanceTimersByTime(150);

    // …and storage holds nothing: the value the view ended up with is not the
    // user's, so persisting it would store someone else's state. Correct — but
    // it is worth noting the user's page=3 is lost entirely, which is the
    // honest semantics of a lost race.
    expect(storedView()).toBeNull();
    cleanup();
  });

  it('a system discard (virtualized × grouping) is not stored as a user wish', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 100 });
      flushSync();

      view.groupBy = 'status'; // the reader groups…
      flushSync();
      // …the table discards it before the debounce fires (M6, third origin
      // class — virtualized × grouping).
      view.applyExternal({ groupBy: null }, 'system');
      flushSync();
    });
    vi.advanceTimersByTime(150);

    // "Written only when the LAST change was the reader's": the system
    // discard un-dirties the axis, so storage stays untouched and the
    // grouping re-applies on a non-virtualized load. The first spike
    // prototype stored `groupBy: null` here (the discard, recorded as a user
    // wish) — that failure is what this test pins.
    expect(storedView()).toBeNull();
    cleanup();
  });

  it('defaults and external hydration alone never write storage', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView({ defaults: { pageSize: 25 } });
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 100 });
      flushSync();
      view.applyExternal({ sort: { column: 'name', direction: 'asc' } }, 'external');
      flushSync();
    });
    vi.advanceTimersByTime(150);

    expect(storedView()).toBeNull();
    cleanup();
  });
});

describe('M4 — the resurrection guard for consumer-driven axes', () => {
  it('an axis excluded from the storage binding is never written', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, {
        key: 'bind',
        storage,
        debounceMs: 100,
        axes: ['sort', 'page', 'pageSize', 'filters', 'groupBy'] // no 'search'
      });
      flushSync();

      view.search = 'consumer-driven'; // e.g. the consumer's own search field
      view.sort = { column: 'name', direction: 'asc' };
      flushSync();
    });
    vi.advanceTimersByTime(150);

    // Only the bound axis lands; the consumer-driven search cannot resurrect
    // on a later visit. This is configuration discipline: at the field-write
    // surface, "the reader typed in the table" and "the consumer's code
    // assigned programmatically" are indistinguishable by construction, so
    // the origin mechanism cannot automate M4 — the `axes` exclusion is the
    // replacement path (Rev. 3).
    expect(storedView()).toEqual({ sort: { column: 'name', direction: 'asc' } });
    cleanup();
  });
});

describe('STORAGE_DEFAULT_AXES — page out, pageSize in', () => {
  it('excludes page and keeps pageSize', () => {
    expect(STORAGE_DEFAULT_AXES).not.toContain('page');
    expect(STORAGE_DEFAULT_AXES).toContain('pageSize');
    expect([...STORAGE_DEFAULT_AXES].sort()).toEqual([
      'filters',
      'groupBy',
      'pageSize',
      'search',
      'sort'
    ]);
  });

  it('with the default axes a page change never lands in storage, a pageSize change does', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 100 });
      flushSync();

      view.page = 7; // "page 1 on navigation is intentional UX" — never stored
      view.pageSize = 50; // "yesterday's page size is still set" — stored
      flushSync();
    });
    vi.advanceTimersByTime(150);

    expect(storedView()).toEqual({ pageSize: 50 });
    cleanup();
  });
});

describe('phase contract — defaults → init application → storage (post-hydration)', () => {
  it('storage applies only after hydration, and only to axes no binding applied at init', () => {
    seedStorage({ sort: { column: 'name', direction: 'asc' }, search: 'stored' });
    const cleanup = $effect.root(() => {
      const view = createTableView();
      // What the URL binding does at init, synchronously:
      view.applyExternal({ sort: { column: 'amount', direction: 'desc' } }, 'external');
      view.markInitApplied(['sort']);
      bindViewToStorage(view, { key: 'bind', storage });

      // Before hydration: init application yes, storage no — the client's
      // first render agrees with the server's HTML.
      expect(view.sort).toEqual({ column: 'amount', direction: 'desc' });
      expect(view.search).toBe('');

      flushSync(); // hydration boundary

      // After: the init-applied axis stands (URL > storage), the unnamed one
      // is seeded from storage.
      expect(view.sort).toEqual({ column: 'amount', direction: 'desc' });
      expect(view.search).toBe('stored');
    });
    cleanup();
  });

  it('registration order does not matter — init claims arriving after the binding registered still win', () => {
    seedStorage({ sort: { column: 'name', direction: 'asc' }, search: 'stored' });
    const cleanup = $effect.root(() => {
      const view = createTableView();
      // Storage binds FIRST; the init application lands later in the same
      // init phase. The decision which axes storage may seed is taken in the
      // hydration effect — after every init claim is registered — so this
      // order agrees with the one above.
      bindViewToStorage(view, { key: 'bind', storage });
      view.applyExternal({ sort: { column: 'amount', direction: 'desc' } }, 'external');
      view.markInitApplied(['sort']);

      flushSync();

      expect(view.sort).toEqual({ column: 'amount', direction: 'desc' });
      expect(view.search).toBe('stored');
    });
    cleanup();
  });

  it('“stored empty is a real state”: a stored null sort beats a non-empty default after hydration', () => {
    seedStorage({ sort: null });
    const cleanup = $effect.root(() => {
      const view = createTableView({
        defaults: { sort: { column: 'date', direction: 'desc' } }
      });
      bindViewToStorage(view, { key: 'bind', storage });
      expect(view.sort).toEqual({ column: 'date', direction: 'desc' }); // first render
      flushSync();
      expect(view.sort).toBeNull(); // the cleared state the reader chose
    });
    cleanup();
  });

  it('storage applies exactly once — a later rewrite of the entry never reaches the view', () => {
    seedStorage({ search: 'stored' });
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 100 });
      flushSync(); // hydration — search seeded
      expect(view.search).toBe('stored');

      // Another tab rewrites the entry; a later axis change re-runs effects.
      seedStorage({ search: 'rewritten' });
      view.sort = { column: 'amount', direction: 'asc' };
      flushSync();
      expect(view.search).toBe('stored'); // runtime storage never applies again
    });
    vi.advanceTimersByTime(150);
    cleanup();
  });
});

describe('a foreign link stores nothing (wiring combination 3, storage half)', () => {
  it('an init-applied search is not persisted; the reader’s own filter is', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      // A linked-in `?q=linked` applied at init by the URL binding:
      view.applyExternal({ search: 'linked' }, 'external');
      view.markInitApplied(['search']);
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 300 });
      flushSync(); // hydration

      view.filters = [aFilter]; // the reader's own change
      flushSync();
    });
    vi.advanceTimersByTime(300);

    // The reader's filter is stored, the linked-in search is not (Prüfstein 4).
    expect(storedView()).toEqual({ filters: [aFilter] });
    cleanup();
  });
});

describe('the storage-only wiring combinations (§7.2)', () => {
  it('no bindings: changes stay in the view, nothing is written anywhere', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      view.sort = { column: 'name', direction: 'asc' };
      flushSync();
    });
    vi.advanceTimersByTime(1000);
    expect(storage.length).toBe(0);
    cleanup();
  });

  it('storage only: write on change, hydrate on the next visit', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 300 });
      flushSync();
      view.groupBy = 'status';
      flushSync();
    });
    vi.advanceTimersByTime(300);
    expect(storedView()).toEqual({ groupBy: 'status' });
    cleanup();

    // Second visit.
    const cleanup2 = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 300 });
      flushSync();
      expect(view.groupBy).toBe('status');
    });
    cleanup2();
  });
});

describe('write mechanics', () => {
  it('two edits inside the debounce window produce ONE write carrying the last value', () => {
    let sets = 0;
    const counting = {
      getItem: (key: string) => storage.getItem(key),
      setItem: (key: string, value: string) => {
        sets += 1;
        storage.setItem(key, value);
      }
    };
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'bind', storage: counting, debounceMs: 300 });
      flushSync();

      view.search = 'a';
      flushSync();
      vi.advanceTimersByTime(100);
      view.search = 'ad';
      flushSync();
      vi.advanceTimersByTime(299); // the second edit reset the debounce
      expect(sets).toBe(0);
      vi.advanceTimersByTime(1);
    });

    expect(sets).toBe(1);
    expect(storedView()).toEqual({ search: 'ad' }); // values are read live in the flush
    cleanup();
  });

  it('the debounced write merges into the stored object — a foreign key survives', () => {
    seedStorage({ answer: 42 }); // not an axis — e.g. written by another version
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 100 });
      flushSync();
      view.groupBy = 'status';
      flushSync();
    });
    vi.advanceTimersByTime(150);

    expect(storedView()).toEqual({ answer: 42, groupBy: 'status' });
    cleanup();
  });

  it('a throwing setItem does not take the table down — persistence just stops', () => {
    let attempts = 0;
    const quota = {
      getItem: () => null,
      setItem: () => {
        attempts += 1;
        throw new Error('QuotaExceededError');
      }
    };
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'bind', storage: quota, debounceMs: 100 });
      flushSync();
      view.search = 'ada';
      flushSync();
    });

    expect(() => vi.advanceTimersByTime(150)).not.toThrow();
    expect(attempts).toBe(1); // the write was attempted, its failure contained
    cleanup();
  });
});

describe('shape validation on read — malformed reads as “nothing stored”', () => {
  it('per-axis garbage is not applied; valid filter elements survive; other axes stay untouched', () => {
    seedStorage({
      search: 42,
      sort: 'up',
      page: -3,
      pageSize: 'zehn',
      filters: [{ column: 1 }, { column: 'name', operator: 'contains', value: 'ad' }],
      groupBy: ''
    });
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 100, axes: VIEW_AXES });
      flushSync();

      expect(view.search).toBe(''); // 42 is not a string
      expect(view.sort).toBeNull(); // "up" is not a sort shape
      expect(view.page).toBe(1); // -3 is not a positive int
      expect(view.pageSize).toBe(10); // "zehn" is not a number
      expect(view.filters).toEqual([aFilter]); // the malformed element is dropped, the valid one lands
      expect(view.groupBy).toBeNull(); // '' is not a valid groupBy
    });
    cleanup();
  });

  it('valid stored values pass on every axis — page included when explicitly bound', () => {
    seedStorage({
      search: 'hello',
      sort: { column: 'amount', direction: 'desc' },
      page: 3,
      pageSize: 50,
      filters: [aFilter],
      groupBy: 'status'
    });
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 100, axes: VIEW_AXES });
      flushSync();

      expect(view.search).toBe('hello');
      expect(view.sort).toEqual({ column: 'amount', direction: 'desc' });
      expect(view.page).toBe(3);
      expect(view.pageSize).toBe(50);
      expect(view.filters).toEqual([aFilter]);
      expect(view.groupBy).toBe('status');
    });
    cleanup();
  });

  it('an unknown sort direction normalises to asc rather than discarding the column', () => {
    seedStorage({ sort: { column: 'amount', direction: 'sideways' } });
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 100 });
      flushSync();
      expect(view.sort).toEqual({ column: 'amount', direction: 'asc' });
    });
    cleanup();
  });

  it('an all-invalid filter list applies as empty — elements are dropped individually, not the axis', () => {
    seedStorage({
      filters: [
        { column: 'name', operator: 'matches', value: 'x' }, // operator not whitelisted
        { column: 'name', operator: 'contains', value: 7 } // value must be a string
      ]
    });
    const cleanup = $effect.root(() => {
      const view = createTableView({ defaults: { filters: [aFilter] } });
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 100 });
      flushSync();
      // The axis IS present in storage, so it applies — as the empty set that
      // survived element validation. Same "stored empty is a real state"
      // semantics as the null sort above.
      expect(view.filters).toEqual([]);
    });
    cleanup();
  });

  it('a stored null groupBy is a value — it clears a non-null default', () => {
    seedStorage({ groupBy: null });
    const cleanup = $effect.root(() => {
      const view = createTableView({ defaults: { groupBy: 'status' } });
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 100 });
      flushSync();
      expect(view.groupBy).toBeNull();
    });
    cleanup();
  });

  it('a stored root that is not a plain object counts as nothing stored', () => {
    storage.setItem(KEY, JSON.stringify([{ search: 'x' }]));
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 100 });
      flushSync();
      expect(view.search).toBe('');
    });
    cleanup();
  });

  it('a malformed JSON entry counts as nothing stored — construction does not throw', () => {
    storage.setItem(KEY, '{"search": "trunc');
    const cleanup = $effect.root(() => {
      const view = createTableView();
      expect(() =>
        bindViewToStorage(view, { key: 'bind', storage, debounceMs: 100 })
      ).not.toThrow();
      flushSync();
      expect(view.search).toBe('');
    });
    cleanup();
  });
});

describe('releaseAxes on destroy — the remount case (new in the product)', () => {
  it('destroying the binding releases its claims — a remounting child binds again without throwing', () => {
    const view = createTableView();
    const first = $effect.root(() => {
      bindViewToStorage(view, { key: 'bind', storage });
      flushSync(); // the teardown effect must have run to register its cleanup
    });
    first(); // unmount — the destroy teardown releases the claims

    const second = $effect.root(() => {
      // An `{#if}`-remounted child on a longer-lived view: before
      // releaseAxes existed, this threw on its own previous registration.
      expect(() => bindViewToStorage(view, { key: 'bind', storage })).not.toThrow();
    });
    second();
  });

  it('counter-check: without a destroy the second binding still fails loud', () => {
    const view = createTableView();
    const first = $effect.root(() => {
      bindViewToStorage(view, { key: 'bind', storage });
      flushSync();
    });

    const second = $effect.root(() => {
      expect(() => bindViewToStorage(view, { key: 'bind', storage })).toThrow(
        /two storage bindings claim the axis/
      );
    });
    second();
    first();
  });
});

describe('destroy teardown (M4)', () => {
  it('a pending storage write dies with the scope — no setItem after unmount', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'bind', storage, debounceMs: 300 });
      flushSync();
      view.filters = [aFilter];
      flushSync();
    });
    cleanup(); // unmount BEFORE the debounce fires
    vi.advanceTimersByTime(1000);

    expect(storage.length).toBe(0);
  });
});
