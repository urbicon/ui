// @vitest-environment jsdom
import { flushSync, untrack } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Filter } from '$lib/types/tableTypes';
import { bindViewToStorage } from './bindings.svelte';
import { createTableView, VIEW_AXES } from './view.svelte';

/**
 * SPIKE §7.1 — origin discrimination under effect batching.
 *
 * The design's candidate 1: per-axis (revision, origin) bookkeeping, two
 * write surfaces (fields for user code, `applyExternal` for bindings and
 * system discards). The measurement the design demands: when a reader edit
 * and a URL echo land in the SAME flush, does the storage effect see the
 * wrong origin? Candidate 2 (a flag around the synchronous application) is
 * measured below as well — the design predicts it fails at the flush
 * boundary, and it does.
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

const storedView = (key = 'origin'): Record<string, unknown> | null => {
  const raw = storage.getItem(`urbicon_table_view_${key}_v1`);
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
};

describe('candidate 1 — per-axis (revision, origin), two write surfaces', () => {
  it('a user edit and an external apply on DIFFERENT axes coalesce into one flush without mixing origins', () => {
    // Observer with the same dependencies as the storage effect — proves the
    // "one run for both writes" half directly instead of inferring it from
    // the outcome (review m1): registration + one batched run.
    let observerRuns = 0;
    const cleanup = $effect.root(() => {
      const view = createTableView();
      // All six axes bound explicitly — this test measures origin mechanics,
      // not the page-exclusion default (pinned in spike.composition).
      bindViewToStorage(view, { key: 'origin', storage, debounceMs: 100, axes: VIEW_AXES });
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
      view.applyExternal({ search: 'from-url' }, 'external'); // URL echo
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
      bindViewToStorage(view, { key: 'origin', storage, debounceMs: 100 });
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
      bindViewToStorage(view, { key: 'origin', storage, debounceMs: 100, axes: VIEW_AXES });
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
      bindViewToStorage(view, { key: 'origin', storage, debounceMs: 100 });
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
    // discard un-dirties the axis, so storage stays untouched — matching
    // today's behaviour, where the virtualization gate deliberately leaves
    // storage alone so the grouping re-applies on a non-virtualized load.
    // The first prototype stored `groupBy: null` here (the discard, recorded
    // as a user wish) — that failure is what this test pins.
    expect(storedView()).toBeNull();
    cleanup();
  });

  it('defaults and external hydration alone never write storage', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView({ defaults: { pageSize: 25 } });
      bindViewToStorage(view, { key: 'origin', storage, debounceMs: 100 });
      flushSync();
      view.applyExternal({ sort: { column: 'name', direction: 'asc' } }, 'external');
      flushSync();
    });
    vi.advanceTimersByTime(150);

    expect(storedView()).toBeNull();
    cleanup();
  });
});

describe('candidate 2 — a flag around the synchronous application (measured to fail)', () => {
  it('the observing effect runs after the flag is already reset — external writes get stored', () => {
    const written: string[] = [];
    const cleanup = $effect.root(() => {
      const view = createTableView();
      let applying = false;

      $effect(() => {
        void view.search;
        untrack(() => {
          // First run is registration; jsdom keeps this simple by checking a
          // marker value instead of a baseline.
          if (view.search === '') return;
          if (!applying) written.push(view.search);
        });
      });
      flushSync();

      applying = true;
      view.applyExternal({ search: 'external-value' }, 'external');
      applying = false;
      // The effect has NOT run yet — it runs in the next flush, when the flag
      // is long back to false:
      flushSync();
    });

    // The flag failed to protect: the external value was classified as a user
    // write. This is the measured death of candidate 2 — effects observe
    // state strictly after the synchronous application window.
    expect(written).toEqual(['external-value']);
    cleanup();
  });

  it('control: holding the flag across a forced flush works, at the cost of flushSync inside the binding', () => {
    const written: string[] = [];
    const cleanup = $effect.root(() => {
      const view = createTableView();
      let applying = false;

      $effect(() => {
        void view.search;
        untrack(() => {
          if (view.search === '') return;
          if (!applying) written.push(view.search);
        });
      });
      flushSync();

      applying = true;
      view.applyExternal({ search: 'external-value' }, 'external');
      flushSync(); // forced flush INSIDE the window
      applying = false;
    });

    // It works — but only by forcing synchronous flushes from inside a
    // binding, which couples every external application to a full effect
    // flush. Candidate 1 needs no such coupling.
    expect(written).toEqual([]);
    cleanup();
  });
});

describe('echo suppression at the write surface', () => {
  it('Object.is protects the primitive axes: same-value writes do not notify', () => {
    let runs = 0;
    const cleanup = $effect.root(() => {
      const view = createTableView();
      $effect(() => {
        void view.page;
        runs += 1;
      });
      flushSync();
      expect(runs).toBe(1);

      view.page = 1; // same as default
      flushSync();
    });
    expect(runs).toBe(1);
    cleanup();
  });

  it('filters need the structural guard: a fresh identical array does not notify, a different one does', () => {
    let runs = 0;
    const cleanup = $effect.root(() => {
      const view = createTableView();
      view.filters = [aFilter];
      $effect(() => {
        void view.filters;
        runs += 1;
      });
      flushSync();
      expect(runs).toBe(1);

      // structurally identical, referentially fresh — the URL parser's output
      view.applyExternal({ filters: [{ ...aFilter }] }, 'external');
      flushSync();
      expect(runs).toBe(1); // suppressed

      // positive control: a real change notifies
      view.applyExternal(
        { filters: [{ column: 'name', operator: 'contains', value: 'gr' }] },
        'external'
      );
      flushSync();
    });
    expect(runs).toBe(2);
    cleanup();
  });

  it('sort gets the same structural guard', () => {
    let runs = 0;
    const cleanup = $effect.root(() => {
      const view = createTableView();
      view.sort = { column: 'name', direction: 'asc' };
      $effect(() => {
        void view.sort;
        runs += 1;
      });
      flushSync();

      view.applyExternal({ sort: { column: 'name', direction: 'asc' } }, 'external');
      flushSync();
      expect(runs).toBe(1);

      view.applyExternal({ sort: { column: 'name', direction: 'desc' } }, 'external');
      flushSync();
    });
    expect(runs).toBe(2);
    cleanup();
  });
});

describe('M4 — the resurrection guard for consumer-driven axes', () => {
  it('the static replacement: an axis excluded from the storage binding is never written', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, {
        key: 'origin',
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
    // on a later visit. NOTE for Rev. 3: this is configuration discipline —
    // at the field-write surface, "the reader typed in the table" and "the
    // consumer's code assigned programmatically" are indistinguishable by
    // construction (both are plain property writes), so the origin mechanism
    // cannot automate M4. The `axes` exclusion is the replacement path.
    expect(storedView()).toEqual({ sort: { column: 'name', direction: 'asc' } });
    cleanup();
  });
});
