// @vitest-environment jsdom
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Filter, TableQuery, TableQueryResult } from '$lib/types/tableTypes';
import { bindViewToUrl, FakeUrl } from './bindings.svelte';
import { createManagedFetch, observeView } from './fetcher.svelte';
import type { TableSource } from './source';
import { createTableView, type TableViewSnapshot } from './view.svelte';

/**
 * SPIKE §7.4 — the server-mode contract: exactly one fetch per interaction,
 * the first immediate, echoes free of second fetches (Prüfstein 12); the
 * two-timer divergence between URL debounce and fetch debounce; and
 * `observeView` as the `onQueryChange` replacement (Prüfstein 13).
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
  const calls: TableQuery[] = [];
  const query = async (q: TableQuery): Promise<TableQueryResult> => {
    calls.push(q);
    return { items: [{ id: calls.length }], totalItems: calls.length };
  };
  return { calls, query };
}

describe('fetch counter (Prüfstein 12)', () => {
  it('fires exactly once at init, immediately (delay 0)', async () => {
    const { calls, query } = makeCountingQuery();
    const results: TableQueryResult[] = [];
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(view, () => ({ query }), { onResult: (r) => results.push(r) });
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
      createManagedFetch(view, () => ({ query, debounceMs: 300 }), { onResult: () => {} });
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
      createManagedFetch(view, () => ({ query, debounceMs: 300 }), { onResult: () => {} });
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
    expect(calls[1].searchTerm).toBe('ad');
    cleanup();
  });

  it('an external echo with fresh filter references triggers NO second fetch', async () => {
    const { calls, query } = makeCountingQuery();
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(view, () => ({ query, debounceMs: 300 }), { onResult: () => {} });
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

  it('a parent re-render with a fresh source literal refetches nothing and keeps the result', async () => {
    const results: TableQueryResult[] = [];
    const { calls, query } = makeCountingQuery();
    const cleanup = $effect.root(() => {
      const view = createTableView();
      let renderTrigger = $state(0);
      const getSource = (): TableSource => {
        void renderTrigger;
        // fresh object AND fresh arrow per render — the #153-regression shape
        return { query: (q, o) => query(q), debounceMs: 300 };
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

  it('a superseded in-flight fetch is aborted and its result discarded', async () => {
    const resolvers: Array<(r: TableQueryResult) => void> = [];
    const seenSignals: AbortSignal[] = [];
    const results: TableQueryResult[] = [];
    const query = (q: TableQuery, o: { signal: AbortSignal }): Promise<TableQueryResult> => {
      seenSignals.push(o.signal);
      return new Promise((resolve) => resolvers.push(resolve));
    };
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(view, () => ({ query, debounceMs: 100 }), {
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

    resolvers[0]({ items: [{ id: 'stale' }], totalItems: 1 }); // stale resolve
    resolvers[1]({ items: [{ id: 'fresh' }], totalItems: 1 });
    await flushMicrotasks();

    expect(results).toHaveLength(1);
    expect(results[0].items[0].id).toBe('fresh');
    cleanup();
  });
});

describe('full circle with a URL binding — echoes end the loop (Prüfstein 12)', () => {
  it('user filter change → URL updated → echo parsed → no second fetch', async () => {
    const { calls, query } = makeCountingQuery();
    const url = new FakeUrl('');
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, url, { debounceMs: 100 });
      createManagedFetch(view, () => ({ query, debounceMs: 100 }), { onResult: () => {} });
      flushSync();
      vi.advanceTimersByTime(0); // initial fetch

      view.filters = [aFilter];
      flushSync();
      vi.advanceTimersByTime(100); // both the goto and the fetch fire
    });
    await flushMicrotasks(); // goto applies → URL→view effect parses fresh filter refs
    vi.advanceTimersByTime(600); // any echo-induced debounce would fire now
    await flushMicrotasks();

    expect(url.search).toBe('filter=name%3Acontains%3Aad');
    expect(calls).toHaveLength(2); // init + interaction — the echo added none
    cleanup();
  });
});

describe('two timers — URL debounce vs. fetch debounce (§7.4)', () => {
  it('with diverging debounces the URL updates before the data does — a measurable transient', async () => {
    const { calls, query } = makeCountingQuery();
    const url = new FakeUrl('');
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, url, { debounceMs: 100 });
      createManagedFetch(view, () => ({ query, debounceMs: 500 }), { onResult: () => {} });
      flushSync();
      vi.advanceTimersByTime(0);

      view.search = 'ada';
      flushSync();
      vi.advanceTimersByTime(100);
    });
    await flushMicrotasks();

    // At t=100 the address bar names a state the table has not fetched yet.
    expect(url.search).toBe('q=ada');
    expect(calls).toHaveLength(1);

    vi.advanceTimersByTime(400);
    await flushMicrotasks();
    expect(calls).toHaveLength(2); // the fetch catches up at t=500

    // Rev. 3 verdict: the divergence window is exactly |fetchDebounce −
    // urlDebounce| and shows a shareable URL ahead of its data — harmless
    // for correctness (the fetch always lands on the final state), but the
    // defaults should match so the window is 0 out of the box.
    cleanup();
  });
});

describe('observeView (Prüfstein 13)', () => {
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
});
