// @vitest-environment jsdom
import { flushSync, untrack } from 'svelte';
import { describe, expect, it } from 'vitest';
import { resolveViewProp } from './ergonomics.svelte';
import { createTableView, type TableView } from './view.svelte';

/**
 * SPIKE §7.5 — ergonomics and contracts around the view object:
 * - the `viewDefaults` shorthand with its fail-loud exclusivity (M7),
 * - the onReady contract: held references to state pass-throughs stay live
 *   over the table's lifetime (Prüfstein 20),
 * - the live-update navigation effect reading the view object instead of
 *   six loose state fields — identical tracking behaviour (§7.5).
 */

describe('viewDefaults shorthand (M7)', () => {
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
      // What the v8 table state would do: loose fields become pass-throughs
      // onto the view object (§3.6), and onReady hands out THIS object.
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
   * Today's effect tracks six loose state fields (`void state.currentPage;
   * void state.sortColumn; …`) to auto-apply buffered live updates on
   * navigation. In the target model it tracks the view object. Measured:
   * same firing behaviour — it runs on any view axis change, and does NOT
   * run when unrelated state (the pending buffer) changes.
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
      // The buffer check MUST stay untracked, exactly like today's effect.
      // Measured without it first: a push triggered the effect, and clearing
      // the buffer inside re-invalidated it — 3 runs instead of 1. Reading
      // the view through one snapshot does not remove the need for untrack
      // on the non-navigation half.
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
