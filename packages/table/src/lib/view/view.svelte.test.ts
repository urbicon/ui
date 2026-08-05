// @vitest-environment jsdom
import { flushSync, untrack } from 'svelte';
import { describe, expect, it } from 'vitest';
import type { Filter } from '$lib/types/tableTypes';
import { createTableView, resolveViewProp, type TableView } from './view.svelte';

/**
 * The view object's own measurements, ported from the v8 spike
 * (spike.origin / spike.ergonomics / spike.composition /
 * spike.review-fixes at 5c0f42f8) against the productised module:
 *
 * - the echo/equality guard at the write surface (the three cases,
 *   including the fresh-but-identical filter reference a URL parser emits),
 * - per-axis (revision, origin) bookkeeping under effect batching — the
 *   design's candidate 1 — plus the measured death of candidate 2 (a flag
 *   around the synchronous application),
 * - claims with fail-loud composition, keyed by `kind:axis` so interleaved
 *   kinds cannot defeat the guard (M1), and the product's new
 *   `releaseAxes` for remounting bindings,
 * - `resolveViewProp` (M7), the onReady contract (Prüfstein 20), and the
 *   live-update navigation effect reading the view object (§7.5).
 *
 * The binding-level half of the origin measurements (what actually lands in
 * storage) lives in storage-binding.svelte.test.ts.
 */

const aFilter: Filter = { column: 'name', operator: 'contains', value: 'ad' };

describe('construction — defaults resolution', () => {
  it('resolves partial defaults fully and starts the view on them', () => {
    const view = createTableView({
      defaults: { pageSize: 25, sort: { column: 'date', direction: 'desc' } }
    });
    expect(view.defaults).toEqual({
      search: '',
      sort: { column: 'date', direction: 'desc' },
      page: 1,
      pageSize: 25,
      filters: [],
      groupBy: null
    });
    expect(view.snapshot()).toEqual(view.defaults);
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

describe('per-axis (revision, origin) bookkeeping — candidate 1', () => {
  it('a user edit and an external apply on DIFFERENT axes coalesce into one flush without mixing origins', () => {
    // Observer with view dependencies — proves the "one run for both writes"
    // half directly instead of inferring it from the outcome (review m1).
    let observerRuns = 0;
    const cleanup = $effect.root(() => {
      const view = createTableView();
      $effect(() => {
        void view.page;
        void view.search;
        observerRuns += 1;
      });
      flushSync(); // registration pass
      expect(observerRuns).toBe(1);

      // The §7.1 setup: a click and a programmatic navigation in the same tick.
      view.page = 3; // reader interaction
      view.applyExternal({ search: 'from-url' }, 'external'); // URL application
      flushSync();
      expect(observerRuns).toBe(2); // ONE batched run for both writes

      // Per-axis bookkeeping keeps the origins apart even though the effect
      // ran once for both. A single boolean/global origin would have answered
      // wrongly here. (What this means for storage: storage-binding tests.)
      expect(view.originOf('page')).toEqual({ revision: 1, origin: 'user' });
      expect(view.originOf('search')).toEqual({ revision: 1, origin: 'external' });
    });
    cleanup();
  });

  it('an echo on the SAME axis touches neither signal nor origin bookkeeping', () => {
    const view = createTableView();
    view.filters = [aFilter];
    expect(view.originOf('filters')).toEqual({ revision: 1, origin: 'user' });

    // The URL echo delivers a structurally identical but referentially fresh
    // array — the case Object.is does not cover.
    view.applyExternal({ filters: [{ ...aFilter }] }, 'external');
    expect(view.originOf('filters')).toEqual({ revision: 1, origin: 'user' }); // unchanged
    expect(view.filters).toEqual([aFilter]);
  });

  it('when an external write CHANGES the same axis after the user, last writer wins', () => {
    const view = createTableView();
    view.page = 3;
    view.applyExternal({ page: 7 }, 'external'); // a genuinely different value
    expect(view.page).toBe(7);
    expect(view.originOf('page')).toEqual({ revision: 2, origin: 'external' });
  });

  it('a system discard is recorded as system, not as the reader’s change', () => {
    const view = createTableView();
    view.groupBy = 'status';
    view.applyExternal({ groupBy: null }, 'system'); // virtualized × grouping
    expect(view.groupBy).toBeNull();
    expect(view.originOf('groupBy')).toEqual({ revision: 2, origin: 'system' });
  });

  it('applyExternal is a partial — unnamed axes keep their state and their origin', () => {
    const view = createTableView();
    view.applyExternal({ page: 2 }, 'external');
    expect(view.page).toBe(2);
    expect(view.search).toBe('');
    expect(view.originOf('search')).toEqual({ revision: 0, origin: 'init' });
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

describe('claims — fail-loud composition (Prüfstein 16 / M1)', () => {
  it('two bindings of the same kind on one axis throw', () => {
    const view = createTableView();
    view.claimAxes('url', ['sort', 'page']);
    expect(() => view.claimAxes('url', ['page'])).toThrow(/two url bindings claim the axis "page"/);
  });

  it('two bindings of the same kind on disjoint axes are legal', () => {
    const view = createTableView();
    view.claimAxes('url', ['sort']);
    expect(() => view.claimAxes('url', ['page'])).not.toThrow();
  });

  it('a url claim and a storage claim may share an axis — that is the composition', () => {
    const view = createTableView();
    view.claimAxes('url', ['sort']);
    expect(() => view.claimAxes('storage', ['sort'])).not.toThrow();
  });

  it('claims survive interleaved kinds: url → storage → url on the same axis still throws', () => {
    const view = createTableView();
    view.claimAxes('url', ['page']);
    view.claimAxes('storage', ['page']);
    // The Map<axis, kind> form let this one through: the storage claim
    // overwrote the slot, and the second url claim registered silently.
    expect(() => view.claimAxes('url', ['page'])).toThrow(/two url bindings claim the axis "page"/);
  });

  it('storage → url → storage throws symmetrically', () => {
    const view = createTableView();
    view.claimAxes('storage', ['sort']);
    view.claimAxes('url', ['sort']);
    expect(() => view.claimAxes('storage', ['sort'])).toThrow(
      /two storage bindings claim the axis "sort"/
    );
  });

  it('releaseAxes frees the claim — the same kind can claim again (the remount case)', () => {
    const view = createTableView();
    view.claimAxes('url', ['page']);
    view.releaseAxes('url', ['page']);
    expect(() => view.claimAxes('url', ['page'])).not.toThrow();
  });

  it('releaseAxes releases only the named kind — the other kind keeps its claim', () => {
    const view = createTableView();
    view.claimAxes('url', ['page']);
    view.claimAxes('storage', ['page']);
    view.releaseAxes('storage', ['page']);
    expect(() => view.claimAxes('url', ['page'])).toThrow(/two url bindings/);
    expect(() => view.claimAxes('storage', ['page'])).not.toThrow();
  });
});

describe('markInitApplied — init application is a historical fact', () => {
  it('marked axes report true, unmarked ones false', () => {
    const view = createTableView();
    view.markInitApplied(['sort', 'search']);
    expect(view.wasInitApplied('sort')).toBe(true);
    expect(view.wasInitApplied('search')).toBe(true);
    expect(view.wasInitApplied('page')).toBe(false);
  });

  it('is not cleared by releaseAxes — a binding teardown does not rewrite history', () => {
    const view = createTableView();
    view.claimAxes('url', ['sort']);
    view.markInitApplied(['sort']);
    view.releaseAxes('url', ['sort']);
    expect(view.wasInitApplied('sort')).toBe(true);
  });
});

describe('resolveViewProp — the viewDefaults shorthand (M7)', () => {
  it('viewDefaults alone builds an internal view with those defaults', () => {
    const view = resolveViewProp(undefined, { pageSize: 25 });
    expect(view.pageSize).toBe(25);
    expect(view.defaults.pageSize).toBe(25);
  });

  it('a consumer view passes through untouched', () => {
    const own = createTableView({ defaults: { pageSize: 50 } });
    expect(resolveViewProp(own, undefined)).toBe(own);
  });

  it('both at once fail loud', () => {
    const own = createTableView();
    expect(() => resolveViewProp(own, { pageSize: 25 })).toThrow(/mutually exclusive/);
  });

  it('neither yields a plain default view (zero-config)', () => {
    const view = resolveViewProp(undefined, undefined);
    expect(view.pageSize).toBe(10);
    expect(view.page).toBe(1);
  });
});

describe('onReady contract (Prüfstein 20)', () => {
  it('a held state-bag reference with getter pass-throughs onto the view stays live', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      // What the v8 table state does: loose fields become pass-throughs onto
      // the view object (§3.6), and onReady hands out THIS object.
      const state = {
        get searchTerm() {
          return view.search;
        },
        get currentPage() {
          return view.page;
        }
      };

      // The consumer holds the reference (onReady fires once)…
      const held = state;
      expect(held.searchTerm).toBe('');

      // …and later reads observe every later change, through both surfaces.
      view.search = 'ada';
      view.applyExternal({ page: 4 }, 'external');
      flushSync();
      expect(held.searchTerm).toBe('ada');
      expect(held.currentPage).toBe(4);
    });
    cleanup();
  });

  it('the pass-through stays reactive inside effects — a consumer effect re-runs on view changes', () => {
    const seen: string[] = [];
    const cleanup = $effect.root(() => {
      const view = createTableView();
      const state = {
        get searchTerm() {
          return view.search;
        }
      };
      $effect(() => {
        seen.push(state.searchTerm);
      });
      flushSync();
      view.search = 'gr';
      flushSync();
    });
    expect(seen).toEqual(['', 'gr']);
    cleanup();
  });
});

describe('live-update navigation effect over the view object (§7.5)', () => {
  /**
   * The v7 effect tracked six loose state fields (`void state.currentPage;
   * void state.sortColumn; …`) to auto-apply buffered live updates on
   * navigation. In the v8 model it tracks the view object. Measured: same
   * firing behaviour — it runs on any view axis change, and does NOT run
   * when unrelated state (the pending buffer) changes.
   */
  function navigationEffectHarness(view: TableView) {
    const counters = { runs: 0, applied: 0 };
    let pendingCount = $state(0);
    const harness = {
      counters,
      push: () => {
        pendingCount += 1;
      },
      get pending() {
        return pendingCount;
      }
    };
    $effect(() => {
      // The v8 shape: one snapshot read tracks every axis.
      void view.snapshot();
      counters.runs += 1;
      // The buffer check MUST stay untracked, exactly like the v7 effect.
      // Measured without it in the spike: a push triggered the effect, and
      // clearing the buffer inside re-invalidated it — 3 runs instead of 1.
      untrack(() => {
        if (harness.pending > 0) {
          counters.applied += 1;
          pendingCount = 0;
        }
      });
    });
    return harness;
  }

  it('fires on every view axis change', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      const harness = navigationEffectHarness(view);
      flushSync();
      expect(harness.counters.runs).toBe(1);

      view.sort = { column: 'name', direction: 'asc' };
      flushSync();
      expect(harness.counters.runs).toBe(2);

      view.applyExternal({ page: 3 }, 'external'); // URL navigation counts too
      flushSync();
      expect(harness.counters.runs).toBe(3);
    });
    cleanup();
  });

  it('does NOT fire when only the pending buffer changes — updates wait for the next navigation', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      const harness = navigationEffectHarness(view);
      flushSync();

      harness.push(); // a live update arrives — no navigation
      flushSync();
      expect(harness.counters.runs).toBe(1);
      expect(harness.counters.applied).toBe(0);

      view.page = 2; // the reader navigates
      flushSync();
      expect(harness.counters.applied).toBe(1);
      expect(harness.pending).toBe(0);
    });
    cleanup();
  });

  it('an echo does not fire it — the structural guard reaches this consumer too', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      view.sort = { column: 'name', direction: 'asc' };
      const harness = navigationEffectHarness(view);
      flushSync();

      view.applyExternal({ sort: { column: 'name', direction: 'asc' } }, 'external');
      flushSync();
      expect(harness.counters.runs).toBe(1);
    });
    cleanup();
  });
});
