// @vitest-environment jsdom
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TableQuery, TableQueryResult } from '$lib/types/tableTypes';
import { bindViewToStorage, bindViewToUrl, FakeUrl } from './bindings.svelte';
import { createManagedFetch, observeView } from './fetcher.svelte';
import { searchParamsToViewPartial } from './serialize';
import { createTableView, type TableView } from './view.svelte';

/**
 * SPIKE — measurements added after the adversarial review of the spike
 * (2026-08-05). Each block names the finding it answers. Two of them pin a
 * KNOWN LIMIT rather than a fix — the lost-update window of an in-flight
 * navigation (M2) and the same-tick collision of two URL writers (M3's
 * residual dimension) — both are build-time obligations, and the tests
 * document the exact failure they must remove.
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

let storage: Storage;

beforeEach(() => {
  vi.useFakeTimers();
  storage = memoryStorage();
});

afterEach(() => {
  vi.useRealTimers();
});

async function settleUrl(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  flushSync();
}

describe('M1 — claims survive interleaved binding kinds', () => {
  it('url → storage → url on the same axis still throws', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, new FakeUrl(''), { axes: ['page'] });
      bindViewToStorage(view, { key: 'ilv', storage, axes: ['page'] });
      // The Map<axis, kind> form let this one through: the storage claim
      // overwrote the slot, and the second url binding registered silently.
      expect(() => bindViewToUrl(view, new FakeUrl(''), { axes: ['page'] })).toThrow(
        /two url bindings claim the axis "page"/
      );
    });
    cleanup();
  });

  it('storage → url → storage throws symmetrically', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'ilv', storage, axes: ['sort'] });
      bindViewToUrl(view, new FakeUrl(''), { axes: ['sort'] });
      expect(() => bindViewToStorage(view, { key: 'ilv2', storage, axes: ['sort'] })).toThrow(
        /two storage bindings claim the axis "sort"/
      );
    });
    cleanup();
  });
});

describe('M3 — foreign params survive the binding’s writes', () => {
  it('a `?tab=` param owned by nobody survives an interaction', async () => {
    const url = new FakeUrl('?tab=details');
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, url, { debounceMs: 100 });
      flushSync();
      view.sort = { column: 'amount', direction: 'desc' };
      flushSync();
    });
    vi.advanceTimersByTime(100);
    await settleUrl();

    const params = new URLSearchParams(url.search);
    expect(params.get('tab')).toBe('details');
    expect(params.get('sort')).toBe('amount');
    expect(params.get('dir')).toBe('desc');
    cleanup();
  });

  it('a foreign param does not poison echo suppression into goto loops', async () => {
    const url = new FakeUrl('?tab=details');
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, url, { debounceMs: 100 });
      flushSync();
      view.page = 2;
      flushSync();
    });
    vi.advanceTimersByTime(100);
    await settleUrl();
    const gotosAfterInteraction = url.gotoCount;
    // Let any echo-induced timers fire.
    vi.advanceTimersByTime(1000);
    await settleUrl();

    expect(url.gotoCount).toBe(gotosAfterInteraction); // exactly one goto, no loop
    expect(url.gotoCount).toBe(1);
    cleanup();
  });

  it('KNOWN LIMIT (build obligation): two independent URL bindings cannot coexist even with staggered debounces', async () => {
    // Expected to work — measured to fail, and the failure is structural:
    // when binding A's navigation lands (sort=amount), binding B's runtime
    // rule "absent on a bound axis = default" fires against a URL that does
    // not carry B's still-debouncing page=2, resets the view's page to 1,
    // and B's own timer then finds nothing left to mirror. Every navigation
    // by one binding is a FOREIGN navigation to the other — so independent
    // URL bindings on one page lose axes on every write, not only in the
    // same-tick race below. Prüfstein 14 therefore requires one coalesced
    // URL writer per page (or a self-navigation marker + merge-on-apply);
    // this test pins the exact failure that writer must remove.
    const url = new FakeUrl('');
    let view!: TableView;
    const cleanup = $effect.root(() => {
      view = createTableView();
      bindViewToUrl(view, url, { axes: ['sort'], debounceMs: 100 });
      bindViewToUrl(view, url, { axes: ['page'], debounceMs: 250 });
      flushSync();
      view.sort = { column: 'amount', direction: 'asc' };
      view.page = 2;
      flushSync();
    });
    vi.advanceTimersByTime(100);
    await settleUrl(); // sort lands — and flattens B's unmirrored page
    vi.advanceTimersByTime(150);
    await settleUrl();

    const params = new URLSearchParams(url.search);
    expect(params.get('sort')).toBe('amount');
    expect(params.get('page')).toBeNull(); // B's axis never reached the URL…
    expect(view.page).toBe(1); // …and the reader's page=2 was reset in the view
    cleanup();
  });

  it('KNOWN LIMIT (build obligation): two URL writers firing in the SAME tick lose the first write', async () => {
    // Both debounces fire in one timer tick; the second goto merges into the
    // URL as it was BEFORE the first applied (goto is async — the real
    // SvelteKit shape too, and today's two-syncQuery wiring shares it). The
    // last writer wins and the first axis is dropped — and the URL→view
    // runtime then flattens that axis back to its default. v8 needs ONE
    // coalesced URL writer per page (or per-application merge) before
    // Prüfstein 14 can pass; this test pins the exact failure.
    const url = new FakeUrl('');
    let view!: TableView;
    const cleanup = $effect.root(() => {
      view = createTableView();
      bindViewToUrl(view, url, { axes: ['sort'], debounceMs: 100 });
      bindViewToUrl(view, url, { axes: ['page'], debounceMs: 100 });
      flushSync();
      view.sort = { column: 'amount', direction: 'asc' };
      view.page = 2;
      flushSync();
    });
    vi.advanceTimersByTime(100);
    await settleUrl();
    await settleUrl();

    const params = new URLSearchParams(url.search);
    expect(params.get('page')).toBe('2'); // the later writer
    expect(params.get('sort')).toBeNull(); // the earlier write is gone
    cleanup();
  });
});

describe('M2 — the in-flight lost-update window, measured (build obligation)', () => {
  it('a user revert during a slow navigation is overwritten by the landing URL', async () => {
    // goto takes 250 ms to land (a real navigation's load phase). The user
    // sorts, the mirror fires, and DURING the flight they revert. The
    // revert serialises to the same string as the still-current URL, so echo
    // suppression swallows it; when the stale navigation lands, URL→view
    // applies the abandoned sort as external. The reader's revert is lost.
    // Build obligation: a self-navigation marker (the #41 pattern) plus
    // comparing against the *intended* URL, not the current one.
    const url = new FakeUrl('', { latencyMs: 250 });
    let view!: TableView;
    const cleanup = $effect.root(() => {
      view = createTableView();
      bindViewToUrl(view, url, { debounceMs: 100 });
      flushSync();

      view.sort = { column: 'amount', direction: 'asc' }; // t0: user sorts
      flushSync();
    });
    vi.advanceTimersByTime(100); // t100: goto('sort=amount') departs, lands t350
    view.sort = null; // t100+: user reverts while in flight
    flushSync();
    vi.advanceTimersByTime(250); // t350: stale navigation lands
    await settleUrl();

    // The measured lost update: the view carries the sort the reader
    // abandoned, and the URL agrees with it — consistent, but wrong.
    expect(view.sort).toEqual({ column: 'amount', direction: 'asc' });
    expect(new URLSearchParams(url.search).get('sort')).toBe('amount');
    cleanup();
  });
});

describe('M4 — destroy clears every pending timer', () => {
  it('a pending URL debounce dies with the scope — no goto after unmount', async () => {
    const url = new FakeUrl('');
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, url, { debounceMs: 300 });
      flushSync();
      view.sort = { column: 'amount', direction: 'asc' };
      flushSync();
    });
    cleanup(); // unmount BEFORE the debounce fires
    vi.advanceTimersByTime(1000);
    await settleUrl();

    expect(url.gotoCount).toBe(0);
    expect(url.search).toBe('');
  });

  it('a pending storage write dies with the scope — no setItem after unmount', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'destroy', storage, debounceMs: 300 });
      flushSync();
      view.filters = [{ column: 'name', operator: 'contains', value: 'ad' }];
      flushSync();
    });
    cleanup();
    vi.advanceTimersByTime(1000);

    expect(storage.length).toBe(0);
  });

  it('a pending fetch debounce dies with the scope, and an in-flight fetch is aborted', async () => {
    const calls: TableQuery[] = [];
    const seenSignals: AbortSignal[] = [];
    const results: TableQueryResult[] = [];
    const query = (q: TableQuery, o: { signal: AbortSignal }): Promise<TableQueryResult> => {
      calls.push(q);
      seenSignals.push(o.signal);
      return new Promise(() => {}); // stays in flight forever
    };
    const cleanup = $effect.root(() => {
      const view = createTableView();
      createManagedFetch(view, () => ({ query, debounceMs: 300 }), {
        onResult: (r) => results.push(r)
      });
      flushSync();
      vi.advanceTimersByTime(0); // initial fetch departs, stays in flight
      view.page = 2; // schedules the debounced second fetch
      flushSync();
    });
    cleanup(); // unmount before the debounce fires
    vi.advanceTimersByTime(1000);
    await settleUrl();

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

describe('n3 — read-tolerance falls back to the configured defaults', () => {
  it('an unparsable size on a present key claims the axis at the VIEW default, not a hard-coded 10', () => {
    const partial = searchParamsToViewPartial(new URLSearchParams('?size=abc'), {
      page: 1,
      pageSize: 25
    });
    expect(partial.pageSize).toBe(25);
  });

  it('wired through the binding: ?size=abc against viewDefaults pageSize 25 stays 25', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView({ defaults: { pageSize: 25 } });
      bindViewToUrl(view, new FakeUrl('?size=abc'));
      expect(view.pageSize).toBe(25);
    });
    cleanup();
  });
});
