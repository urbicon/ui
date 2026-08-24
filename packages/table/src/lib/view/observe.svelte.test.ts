// @vitest-environment jsdom
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Filter, TablePage } from '$lib/types/tableTypes';
import { createManagedFetch, observeView } from './observe.svelte';
import type { TableSource } from './source';
import { createTableView, type TableView, type TableViewSnapshot } from './view.svelte';

/**
 * The managed fetch layer and `observeView`, ported from the v8 spike
 * (§7.4, spike.fetch / spike.review-fixes at 5c0f42f8): exactly one fetch
 * per interaction, the first immediate, echoes free of second fetches
 * (Prüfstein 12), identity-hardening against fresh source literals, abort
 * on supersede, destroy teardowns (M4), and `observeView` as the
 * `onQueryChange` replacement (Prüfstein 13).
 *
 * The full circle over a real URL binding (user change → goto → echo parsed
 * → no second fetch) and the two-timer divergence between URL debounce and
 * fetch debounce moved to sveltekit-utils with the URL binding.
 *
 * Product delta against the spike: `FetchSink.onError` receives
 * `string | null` — `null` for a rejection without a message (the spike
 * passed the literal 'fetch failed'); the sink supplies its own (i18n)
 * fallback.
 */

const aFilter: Filter = { column: 'name', operator: 'contains', value: 'ad' };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Fake-timer-safe microtask drain (queueMicrotask/promises stay real). */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flushSync();
}

function makeCountingQuery() {
  const calls: TableViewSnapshot[] = [];
  const query = async (q: TableViewSnapshot): Promise<TablePage> => {
    calls.push(q);
    return { items: [{ id: calls.length }], total: calls.length };
  };
  return { calls, query };
}

describe('fetch counter (Prüfstein 12)', () => {
  // Positive controls (red seen), one sabotage per guarantee:
  // - `initialDone` seeded true (first fetch debounced instead of immediate)
  //   → 11 tests red across the file;
  // - the supersede abort removed from `execute` → the abort test red;
  // - the debounce reset (`clearTimeout`) removed from the fetch effect →
  //   the coalescing test red;
  // - echo-freedom is DOUBLY carried: cutting only the structural filters
  //   guard in `axisEqual` left the echo test green (the structural
  //   `viewKey` held), cutting only `viewKey` to identity leaves the guard
  //   holding — red required both cut at once. Two independent lines, both
  //   measured.
  it('fires exactly once at init, immediately (delay 0)', async () => {
    const { calls, query } = makeCountingQuery();
    const results: TablePage[] = [];
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(view, () => ({ processing: 'server' as const, query }), {
        onResult: (r) => results.push(r)
      });
    });
    flushSync();
    vi.advanceTimersByTime(0);
    await flushMicrotasks();

    expect(calls).toHaveLength(1);
    expect(results).toHaveLength(1);
    cleanup();
  });

  it('one interaction → one fetch, after the source debounce', async () => {
    const { calls, query } = makeCountingQuery();
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(view, () => ({ processing: 'server' as const, query, debounceMs: 300 }), {
        onResult: () => {}
      });
      flushSync();
      vi.advanceTimersByTime(0);

      view.page = 2;
      flushSync();
    });
    await flushMicrotasks();
    expect(calls).toHaveLength(1); // only the initial one so far

    vi.advanceTimersByTime(299);
    await flushMicrotasks();
    expect(calls).toHaveLength(1);

    vi.advanceTimersByTime(1);
    await flushMicrotasks();
    expect(calls).toHaveLength(2);
    expect(calls[1].page).toBe(2);
    cleanup();
  });

  it('two interactions inside the debounce window coalesce into one fetch with the last state', async () => {
    const { calls, query } = makeCountingQuery();
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(view, () => ({ processing: 'server' as const, query, debounceMs: 300 }), {
        onResult: () => {}
      });
      flushSync();
      vi.advanceTimersByTime(0);

      view.search = 'a';
      flushSync();
      vi.advanceTimersByTime(100);
      view.search = 'ad';
      flushSync();
      vi.advanceTimersByTime(300);
    });
    await flushMicrotasks();

    expect(calls).toHaveLength(2);
    expect(calls[1].search).toBe('ad');
    cleanup();
  });

  it('an external echo with fresh filter references triggers NO second fetch', async () => {
    const { calls, query } = makeCountingQuery();
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(view, () => ({ processing: 'server' as const, query, debounceMs: 300 }), {
        onResult: () => {}
      });
      flushSync();
      vi.advanceTimersByTime(0);

      view.filters = [aFilter];
      flushSync();
      vi.advanceTimersByTime(300);

      // the URL echo: structurally identical, referentially fresh
      view.applyExternal({ filters: [{ ...aFilter }] }, 'external');
      flushSync();
      vi.advanceTimersByTime(600);
    });
    await flushMicrotasks();

    expect(calls).toHaveLength(2); // init + the filter change; the echo added none
    cleanup();
  });

  it('an external CHANGE (a navigation, not an echo) fetches like a user change', async () => {
    const { calls, query } = makeCountingQuery();
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(view, () => ({ processing: 'server' as const, query, debounceMs: 300 }), {
        onResult: () => {}
      });
      flushSync();
      vi.advanceTimersByTime(0);

      // A back/forward navigation applies a genuinely different state — the
      // fetch layer keys on structure, not on origin.
      view.applyExternal({ page: 5 }, 'external');
      flushSync();
      vi.advanceTimersByTime(300);
    });
    await flushMicrotasks();

    expect(calls).toHaveLength(2);
    expect(calls[1].page).toBe(5);
    cleanup();
  });

  it('a parent re-render with a fresh source literal refetches nothing and keeps the result', async () => {
    const results: TablePage[] = [];
    const { calls, query } = makeCountingQuery();
    const cleanup = $effect.root(() => {
      const view = createTableView();
      let renderTrigger = $state(0);
      const getSource = () => {
        void renderTrigger;
        // fresh object AND fresh arrow per render — the #153-regression shape
        return {
          processing: 'server' as const,
          query: (q: TableViewSnapshot) => query(q),
          debounceMs: 300
        };
      };
      createManagedFetch(view, getSource, { onResult: (r) => results.push(r) });
      flushSync();
      vi.advanceTimersByTime(0);

      renderTrigger += 1; // parent re-render
      flushSync();
      vi.advanceTimersByTime(600);
    });
    await flushMicrotasks();

    expect(calls).toHaveLength(1);
    expect(results).toHaveLength(1);
    cleanup();
  });

  it('a client source never fetches — the managed gate stays closed', async () => {
    const results: TablePage[] = [];
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(view, () => ({ processing: 'client' as const, items: [{ id: 1 }] }), {
        onResult: (r) => results.push(r)
      });
      flushSync();
      view.page = 2;
      flushSync();
    });
    vi.advanceTimersByTime(1000);
    await flushMicrotasks();

    expect(results).toHaveLength(0);
    cleanup();
  });

  it('a superseded in-flight fetch is aborted and its result discarded', async () => {
    const resolvers: Array<(r: TablePage) => void> = [];
    const seenSignals: AbortSignal[] = [];
    const results: TablePage[] = [];
    const query = (_q: TableViewSnapshot, o: { signal: AbortSignal }): Promise<TablePage> => {
      seenSignals.push(o.signal);
      return new Promise((resolve) => resolvers.push(resolve));
    };
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(view, () => ({ processing: 'server' as const, query, debounceMs: 100 }), {
        onResult: (r) => results.push(r)
      });
      flushSync();
      vi.advanceTimersByTime(0); // fetch 1 starts, stays in flight

      view.page = 2;
      flushSync();
      vi.advanceTimersByTime(100); // fetch 2 starts, aborts fetch 1
    });
    await flushMicrotasks();

    expect(seenSignals).toHaveLength(2);
    expect(seenSignals[0].aborted).toBe(true);
    expect(seenSignals[1].aborted).toBe(false);

    resolvers[0]({ items: [{ id: 'stale' }], total: 1 }); // stale resolve
    resolvers[1]({ items: [{ id: 'fresh' }], total: 1 });
    await flushMicrotasks();

    expect(results).toHaveLength(1);
    expect(results[0].items[0].id).toBe('fresh');
    cleanup();
  });
});

describe('a live source flip away from managed (the isManaged gate)', () => {
  it('aborts the in-flight fetch, keeps its late result out of the sink, and refetches immediately on flip-back', async () => {
    // The flip means "these client items are the truth now" — an in-flight
    // managed fetch resolving afterwards must not land on top of them, and a
    // later flip back to managed is a fresh start (immediate first fetch,
    // not a debounced one).
    const resolvers: Array<(r: TablePage) => void> = [];
    const seenSignals: AbortSignal[] = [];
    const results: TablePage[] = [];
    const calls: TableViewSnapshot[] = [];
    const query = (q: TableViewSnapshot, o: { signal: AbortSignal }): Promise<TablePage> => {
      calls.push(q);
      seenSignals.push(o.signal);
      return new Promise((resolve) => resolvers.push(resolve));
    };
    let source = $state<TableSource>({ processing: 'server' as const, query, debounceMs: 100 });
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(view, () => source, { onResult: (r) => results.push(r) });
    });
    flushSync();
    vi.advanceTimersByTime(0); // fetch 1 departs, stays in flight
    await flushMicrotasks();
    expect(calls).toHaveLength(1);

    source = { processing: 'client' as const, items: [{ id: 1 }] }; // the parent flips to a client source mid-flight
    flushSync();
    expect(seenSignals[0].aborted).toBe(true); // aborted at the flip, not on supersede

    resolvers[0]({ items: [{ id: 'stale' }], total: 1 }); // the promise resolves late
    await flushMicrotasks();
    expect(results).toHaveLength(0); // the sink never hears from it

    source = { processing: 'server' as const, query, debounceMs: 100 }; // flip back to managed
    flushSync();
    vi.advanceTimersByTime(0); // initialDone was reset → first fetch is immediate again
    await flushMicrotasks();
    expect(calls).toHaveLength(2);

    resolvers[1]({ items: [{ id: 'fresh' }], total: 1 });
    await flushMicrotasks();
    expect(results).toHaveLength(1);
    expect(results[0].items[0].id).toBe('fresh');
    cleanup();
  });

  it('a pre-debounce mark survives the unmanaged spell, is spent once on the flip back — and is not what makes that fetch immediate', async () => {
    // `takePreDebounced` (the search bar's hand-off, #255) has one property
    // the dependency graph does NOT give it: while no managed source is
    // wired, the effect returns before `void viewKey`, so view changes stop
    // re-running it and a mark armed in that spell sits there until the flip
    // back. What keeps that harmless is `initialDone = false` in the same
    // branch — the last assertion here is the one that fails without it.
    const { calls, query } = makeCountingQuery();
    let armed = false;
    let view!: TableView;
    let source = $state<TableSource>({ processing: 'server' as const, query, debounceMs: 100 });
    const cleanup = $effect.root(() => {
      view = createTableView();
      createManagedFetch(view, () => source, { onResult: () => {} }, undefined, {
        takePreDebounced: () => {
          const was = armed;
          armed = false;
          return was;
        }
      });
    });
    flushSync();
    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    expect(calls).toHaveLength(1);

    // Unmanaged, then armed: the client-mode search write the bar would have
    // marked. Nothing consumes it — a view change here does not even re-run
    // the effect, let alone fetch.
    source = { processing: 'client' as const, items: [{ id: 1 }] };
    flushSync();
    armed = true;
    view.search = 'ada';
    flushSync();
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    expect(calls).toHaveLength(1);

    // The flip back spends the stale mark…
    source = { processing: 'server' as const, query, debounceMs: 100 };
    flushSync();
    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    expect(calls).toHaveLength(2);
    expect(armed).toBe(false);

    // …and it is gone: the next change waits the source out in full.
    view.page = 2;
    flushSync();
    vi.advanceTimersByTime(99);
    await flushMicrotasks();
    expect(calls).toHaveLength(2);
    vi.advanceTimersByTime(1);
    await flushMicrotasks();
    expect(calls).toHaveLength(3);

    // A second flip, with no mark to hide behind: the first fetch after it is
    // immediate on `initialDone`'s account alone. Drop that reset and this is
    // a 100 ms debounce instead — which the run above, with the mark armed,
    // could not have told you.
    source = { processing: 'client' as const, items: [{ id: 2 }] };
    flushSync();
    source = { processing: 'server' as const, query, debounceMs: 100 };
    flushSync();
    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    expect(calls).toHaveLength(4);
    cleanup();
  });
});

describe('the sink contract', () => {
  it('onLoading precedes every result', async () => {
    const events: string[] = [];
    const { query } = makeCountingQuery();
    let view!: TableView;
    const cleanup = $effect.root(() => {
      view = createTableView();
      createManagedFetch(view, () => ({ processing: 'server' as const, query, debounceMs: 100 }), {
        onLoading: () => events.push('loading'),
        onResult: () => events.push('result')
      });
    });
    flushSync();
    vi.advanceTimersByTime(0);
    await flushMicrotasks(); // the init result lands before the interaction

    view.search = 'ada';
    flushSync();
    vi.advanceTimersByTime(100);
    await flushMicrotasks();

    expect(events).toEqual(['loading', 'result', 'loading', 'result']);
    cleanup();
  });

  it('a rejection with an Error surfaces its message', async () => {
    const errors: Array<string | null> = [];
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(
        view,
        () => ({
          processing: 'server' as const,
          query: async () => {
            throw new Error('boom');
          }
        }),
        { onResult: () => {}, onError: (message) => errors.push(message) }
      );
    });
    flushSync();
    vi.advanceTimersByTime(0);
    await flushMicrotasks();

    expect(errors).toEqual(['boom']);
    cleanup();
  });

  it('a rejection without a message reports null — the sink supplies its own fallback', async () => {
    const errors: Array<string | null> = [];
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(
        view,
        () => ({
          processing: 'server' as const,
          query: () => Promise.reject('kaputt') // not an Error — no message to forward
        }),
        { onResult: () => {}, onError: (message) => errors.push(message) }
      );
    });
    flushSync();
    vi.advanceTimersByTime(0);
    await flushMicrotasks();

    expect(errors).toEqual([null]);
    cleanup();
  });
});

describe('getFetchSnapshot — the projection the fetch asks for', () => {
  // The provider projects `page` onto the displayed (clamped) page. The
  // contract that makes the recovery work is that the structural KEY and the
  // EXECUTION read the same projection: a key over the raw view with an
  // execution over the projection would skip exactly the refetch that
  // recovers an out-of-range deep link. (The end-to-end recovery, against a
  // mounted table, is pinned in Table.servermode.svelte.test.ts.)
  it('a change in the projection alone refetches, and the query receives it', async () => {
    const { calls, query } = makeCountingQuery();
    let projectedPage = $state(99);
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(
        view,
        () => ({ processing: 'server' as const, query, debounceMs: 100 }),
        { onResult: () => {} },
        () => ({ ...view.snapshot(), page: projectedPage })
      );
    });
    flushSync();
    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    expect(calls.map((c) => c.page)).toEqual([99]);

    // What a response revealing the total does to the provider's projection.
    projectedPage = 20;
    flushSync();
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    expect(calls.map((c) => c.page)).toEqual([99, 20]);
    cleanup();
  });
});

describe('observeView (Prüfstein 13)', () => {
  // Positive controls (red seen): the initial synchronous emission removed →
  // 2 tests red (this one and the teardown test's baseline); the debounce
  // replaced with a synchronous callback → the same 2 red, at the debounce
  // assertions. Echo-freedom rides the write surface's structural guard,
  // measured at view.svelte.test.ts.
  it('fires synchronously once on registration, then debounced per change, echo-free', async () => {
    const seen: TableViewSnapshot[] = [];
    const cleanup = $effect.root(() => {
      const view = createTableView();
      observeView(view, (s) => seen.push(s), { debounceMs: 200 });
      flushSync();
      expect(seen).toHaveLength(1); // initial emission, synchronous

      view.sort = { column: 'name', direction: 'asc' };
      flushSync();
      expect(seen).toHaveLength(1); // debounced
      vi.advanceTimersByTime(200);
      expect(seen).toHaveLength(2);
      expect(seen[1].sort).toEqual({ column: 'name', direction: 'asc' });

      // echo: structurally identical fresh references change nothing
      view.applyExternal({ sort: { column: 'name', direction: 'asc' } }, 'external');
      flushSync();
      vi.advanceTimersByTime(400);
    });

    expect(seen).toHaveLength(2);
    cleanup();
  });

  it('the default debounce is 300ms — pinned at the boundary', () => {
    // Prüfstein 22 names the value, so the value is the assertion: without a
    // `debounceMs` option, 299ms of silence must not call and the 300th
    // millisecond must. The suite's other observeView tests pass the knob
    // explicitly, so only this boundary notices the default itself drifting —
    // measured: with the default changed to 50 the suite stayed green until
    // this test existed. Positive control (red seen): default `?? 50` → this
    // test red. (The managed-fetch debounce knob and default are pinned
    // separately: hard-coding 300 over `resolved.debounceMs` went red in the
    // two 100ms tests here, and the source-level `?? 300` default is pinned
    // by source.svelte.test.ts.)
    const seen: TableViewSnapshot[] = [];
    const cleanup = $effect.root(() => {
      const view = createTableView();
      observeView(view, (s) => seen.push(s));
      flushSync();
      view.search = 'ada';
      flushSync();
      vi.advanceTimersByTime(299);
      expect(seen).toHaveLength(1); // still only the initial emission
      vi.advanceTimersByTime(1);
    });
    expect(seen).toHaveLength(2);
    cleanup();
  });
});

describe('destroy teardown (M4)', () => {
  it('a pending fetch debounce dies with the scope, and an in-flight fetch is aborted', async () => {
    const calls: TableViewSnapshot[] = [];
    const seenSignals: AbortSignal[] = [];
    const results: TablePage[] = [];
    const query = (q: TableViewSnapshot, o: { signal: AbortSignal }): Promise<TablePage> => {
      calls.push(q);
      seenSignals.push(o.signal);
      return new Promise(() => {}); // stays in flight forever
    };
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(view, () => ({ processing: 'server' as const, query, debounceMs: 300 }), {
        onResult: (r) => results.push(r)
      });
      flushSync();
      vi.advanceTimersByTime(0); // initial fetch departs, stays in flight
      view.page = 2; // schedules the debounced second fetch
      flushSync();
    });
    cleanup(); // unmount before the debounce fires
    vi.advanceTimersByTime(1000);
    await flushMicrotasks();

    expect(calls).toHaveLength(1); // the pending second fetch never ran
    expect(seenSignals[0].aborted).toBe(true); // the in-flight one was aborted
    expect(results).toHaveLength(0);
  });

  it('a pending observeView debounce dies with the scope — no callback after unmount', () => {
    let callbacks = 0;
    const cleanup = $effect.root(() => {
      const view = createTableView();
      observeView(
        view,
        () => {
          callbacks += 1;
        },
        { debounceMs: 300 }
      );
      flushSync();
      expect(callbacks).toBe(1); // initial synchronous emission
      view.search = 'ada';
      flushSync();
    });
    cleanup();
    vi.advanceTimersByTime(1000);

    expect(callbacks).toBe(1);
  });
});

describe('what a managed query receives (#162)', () => {
  it('is the view snapshot itself — the six axes under the view names', async () => {
    // The projection this used to go through (`viewToQuery`) is gone: the
    // query vocabulary and the view vocabulary are one, so `source.query` is
    // handed `view.snapshot()` directly. Positive control: re-introduce a
    // renaming projection in `execute` and the key assertion below goes red.
    const seen: TableViewSnapshot[] = [];
    const query = async (q: TableViewSnapshot): Promise<TablePage> => {
      seen.push(q);
      return { items: [], total: 0 };
    };
    const cleanup = $effect.root(() => {
      const view = createTableView({
        defaults: {
          search: 'ada',
          sort: { column: 'amount', direction: 'desc' },
          page: 3,
          pageSize: 50,
          filters: [aFilter],
          groupBy: 'status'
        }
      });
      createManagedFetch(view, () => ({ processing: 'server' as const, query }), {
        onResult: () => {}
      });
    });
    flushSync();
    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    cleanup();

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({
      search: 'ada',
      sort: { column: 'amount', direction: 'desc' },
      page: 3,
      pageSize: 50,
      filters: [aFilter],
      groupBy: 'status'
    });
  });
});
