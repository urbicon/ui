// @vitest-environment jsdom
/**
 * The URL binding against the mocked `$app` trio (see src/test-support/):
 * reads reactive, `goto` applying asynchronously — the timing that made URL
 * ownership racy in the old model, reproduced here so the self-navigation
 * marker and the coalescing writer are measured, not argued.
 *
 * The view double is `test-support/test-view.svelte.ts`, shared with the
 * prefix suite.
 */
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  back,
  navigationLog,
  resetMockApp,
  setNavigationLatency
} from '../test-support/app-harness.svelte';
import { TestView } from '../test-support/test-view.svelte';
import type { TableQueryFilter } from './table-query';
import { __resetUrlWriterForTests, bindViewToUrl } from './view-binding.svelte';

// ── Harness plumbing ────────────────────────────────────────────────────────

import { page } from '../test-support/app-harness.svelte';

const search = () => page.url.search;

/** Flush the writer microtask, the goto microtask, then the effects. */
async function land(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flushSync();
}

/** Advance fake timers by `ms`, then let a scheduled navigation land. */
async function advance(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await land();
}

let roots: Array<() => void> = [];
function inRoot(fn: () => void): () => void {
  const destroy = $effect.root(fn);
  roots.push(destroy);
  flushSync();
  return destroy;
}

beforeEach(() => {
  vi.useFakeTimers();
  resetMockApp();
  __resetUrlWriterForTests();
});

afterEach(() => {
  for (const destroy of roots) destroy();
  roots = [];
  vi.useRealTimers();
});

// ── Init phase ──────────────────────────────────────────────────────────────

describe('bindViewToUrl — init', () => {
  it('applies the axes the URL names, synchronously, and marks them init-applied', () => {
    resetMockApp('?q=ada&sort=name&dir=desc');
    const view = new TestView({ pageSize: 25 });
    inRoot(() => bindViewToUrl(view));
    expect(view.search).toBe('ada');
    expect(view.sort).toEqual({ column: 'name', direction: 'desc' });
    expect(view.page).toBe(1); // unnamed axis: default stands
    expect(view.pageSize).toBe(25);
    expect(view.wasInitApplied('search')).toBe(true);
    expect(view.wasInitApplied('sort')).toBe(true);
    expect(view.wasInitApplied('page')).toBe(false);
  });

  it('treats `?sort=` as explicitly unsorted against a sorting default', () => {
    resetMockApp('?sort=');
    const view = new TestView({ sort: { column: 'date', direction: 'desc' } });
    inRoot(() => bindViewToUrl(view));
    expect(view.sort).toBeNull();
  });

  // Deliberately untested: the `building` guard (prerender reads no query
  // string). Vitest resolves `$app/environment` into a second module
  // instance for the production module, so a test-side flag flip never
  // reaches it — and the guard is the same one-line pattern `useUrlParam`
  // ships (equally untested there). Verified by reading, not by a test.

  it('is fail-loud on a second url binding claiming the same axis', () => {
    const view = new TestView();
    expect(() =>
      inRoot(() => {
        bindViewToUrl(view, { axes: ['search', 'sort'] });
        bindViewToUrl(view, { axes: ['sort'] });
      })
    ).toThrow(/duplicate claim url:sort/);
  });

  it('releases its claims on destroy, so a remounting child can bind again', () => {
    const view = new TestView();
    const destroy = inRoot(() => bindViewToUrl(view));
    destroy();
    roots = roots.filter((d) => d !== destroy);
    expect(() => inRoot(() => bindViewToUrl(view))).not.toThrow();
  });
});

// ── View → URL ──────────────────────────────────────────────────────────────

describe('bindViewToUrl — view to URL', () => {
  it('writes a user change debounced, eliding defaults, via replaceState', async () => {
    const view = new TestView({ pageSize: 25 });
    inRoot(() => bindViewToUrl(view));
    view.search = 'ada';
    view.page = 3;
    flushSync();
    expect(navigationLog.gotoCount).toBe(0); // debounced
    await advance(300);
    expect(navigationLog.gotoCount).toBe(1);
    expect(navigationLog.pushCount).toBe(0); // replaceState default
    const sp = new URLSearchParams(search());
    expect(sp.get('q')).toBe('ada');
    expect(sp.get('page')).toBe('3');
    expect(sp.get('size')).toBeNull(); // equals default 25 → elided
  });

  it('coalesces edits inside the debounce window into one navigation with the last state', async () => {
    const view = new TestView();
    inRoot(() => bindViewToUrl(view));
    view.search = 'a';
    flushSync();
    vi.advanceTimersByTime(150);
    view.search = 'ada';
    flushSync();
    await advance(300);
    expect(navigationLog.gotoCount).toBe(1);
    expect(new URLSearchParams(search()).get('q')).toBe('ada');
  });

  it('preserves foreign params on write (merge semantics)', async () => {
    resetMockApp('?tab=settings');
    const view = new TestView();
    inRoot(() => bindViewToUrl(view));
    view.search = 'ada';
    flushSync();
    await advance(300);
    const sp = new URLSearchParams(search());
    expect(sp.get('tab')).toBe('settings');
    expect(sp.get('q')).toBe('ada');
  });

  it('never lets an unbound axis reach the URL, and does not track it', async () => {
    const view = new TestView();
    inRoot(() => bindViewToUrl(view, { axes: ['search'] }));
    view.sort = { column: 'name', direction: 'asc' };
    flushSync();
    await advance(300);
    expect(navigationLog.gotoCount).toBe(0);
  });

  it('writes the empty filter marker when a filtering default is cleared', async () => {
    const filter: TableQueryFilter = { column: 'status', operator: 'equals', value: 'open' };
    const view = new TestView({ filters: [filter] });
    inRoot(() => bindViewToUrl(view));
    view.filters = [];
    flushSync();
    await advance(300);
    expect(new URLSearchParams(search()).get('filter')).toBe('');
  });

  it('suppresses the echo: a landed own navigation triggers no second goto', async () => {
    const view = new TestView();
    inRoot(() => bindViewToUrl(view));
    view.search = 'ada';
    flushSync();
    await advance(300);
    expect(navigationLog.gotoCount).toBe(1);
    // Let any (wrong) follow-up debounce run out.
    await advance(1000);
    expect(navigationLog.gotoCount).toBe(1);
    expect(view.search).toBe('ada');
  });

  it('mirrors an external application only with reflectExternal (then via replaceState)', async () => {
    const view = new TestView();
    inRoot(() => bindViewToUrl(view)); // default: false
    view.applyExternal({ search: 'stored' }, 'external');
    flushSync();
    await advance(1000);
    expect(navigationLog.gotoCount).toBe(0); // address bar untouched without interaction

    const mirrored = new TestView();
    __resetUrlWriterForTests();
    resetMockApp();
    inRoot(() => bindViewToUrl(mirrored, { reflectExternal: true }));
    mirrored.applyExternal({ search: 'stored' }, 'external');
    flushSync();
    await advance(300);
    expect(navigationLog.gotoCount).toBe(1);
    expect(navigationLog.pushCount).toBe(0);
    expect(new URLSearchParams(search()).get('q')).toBe('stored');
  });

  it('mirrors a system discard (the table cleaning virtualized grouping cleans the URL)', async () => {
    resetMockApp('?group=status');
    const view = new TestView();
    inRoot(() => bindViewToUrl(view));
    expect(view.groupBy).toBe('status');
    view.applyExternal({ groupBy: null }, 'system');
    flushSync();
    await advance(300);
    expect(new URLSearchParams(search()).get('group')).toBeNull();
  });
});

// ── URL → view (runtime) ────────────────────────────────────────────────────

describe('bindViewToUrl — URL to view', () => {
  it('back button: a bound axis whose param disappears returns to the default', async () => {
    const view = new TestView();
    inRoot(() => bindViewToUrl(view, { replaceState: false, debounceMs: 100 }));
    view.search = 'a';
    flushSync();
    await advance(100);
    view.search = 'b';
    flushSync();
    await advance(100);
    expect(navigationLog.pushCount).toBe(2);

    back(); // → ?q=a
    flushSync();
    expect(view.search).toBe('a');
    back(); // → bare URL
    flushSync();
    expect(view.search).toBe('');
  });

  it('does not flatten a storage seed applied between init and the first navigation', () => {
    const view = new TestView();
    inRoot(() => bindViewToUrl(view));
    // The storage binding's post-hydration apply, simulated:
    view.applyExternal({ search: 'stored' }, 'external');
    flushSync();
    expect(view.search).toBe('stored'); // the initial-run guard held
  });

  it('survives the in-flight window: a stale own landing does not overwrite a newer edit', async () => {
    const view = new TestView();
    inRoot(() => bindViewToUrl(view, { debounceMs: 100 }));
    setNavigationLatency(50);

    view.search = 'ada';
    flushSync();
    vi.advanceTimersByTime(100); // debounce fires → goto in flight (lands at +50)
    await Promise.resolve();
    await Promise.resolve();

    view.search = 'grace'; // edit while the navigation is in flight
    flushSync();

    await advance(50); // the stale `?q=ada` lands
    expect(new URLSearchParams(search()).get('q')).toBe('ada'); // URL momentarily stale
    expect(view.search).toBe('grace'); // the marker kept the edit alive

    await advance(200); // the pending debounce fires the second navigation
    await advance(50); // …which lands after the same latency
    expect(new URLSearchParams(search()).get('q')).toBe('grace');
    expect(view.search).toBe('grace');
  });
});

// ── Two bindings, one page (prefix) ─────────────────────────────────────────

describe('bindViewToUrl — two tables, one page', () => {
  it('keeps both slices in the URL and neither binding tramples the other', async () => {
    const a = new TestView();
    const b = new TestView();
    inRoot(() => {
      bindViewToUrl(a, { prefix: 'a_', debounceMs: 100 });
      bindViewToUrl(b, { prefix: 'b_', debounceMs: 400 });
    });

    b.search = 'bee'; // pending, debounce 400
    a.search = 'aye'; // pending, debounce 100
    flushSync();

    await advance(100); // a's navigation lands while b's edit is still pending
    expect(new URLSearchParams(search()).get('a_q')).toBe('aye');
    expect(b.search).toBe('bee'); // b classified the landing as self — not flattened

    await advance(300); // b's debounce fires
    const sp = new URLSearchParams(search());
    expect(sp.get('a_q')).toBe('aye'); // merge preserved a's slice
    expect(sp.get('b_q')).toBe('bee');
  });

  it('coalesces same-tick submissions into a single navigation', async () => {
    const a = new TestView();
    const b = new TestView();
    inRoot(() => {
      bindViewToUrl(a, { prefix: 'a_' });
      bindViewToUrl(b, { prefix: 'b_' });
    });
    a.search = 'aye';
    b.search = 'bee';
    flushSync();
    await advance(300); // both debounces fire in the same advance
    expect(navigationLog.gotoCount).toBe(1);
    const sp = new URLSearchParams(search());
    expect(sp.get('a_q')).toBe('aye');
    expect(sp.get('b_q')).toBe('bee');
  });

  it('back button applies to both bindings (a foreign landing is foreign for both)', async () => {
    const a = new TestView();
    const b = new TestView();
    inRoot(() => {
      bindViewToUrl(a, { prefix: 'a_', replaceState: false });
      bindViewToUrl(b, { prefix: 'b_', replaceState: false });
    });
    a.search = 'aye';
    b.search = 'bee';
    flushSync();
    await advance(300);

    back(); // → bare URL
    flushSync();
    expect(a.search).toBe('');
    expect(b.search).toBe('');
  });
});

// ── The writer's intended-search basis (adversarial review of cc338a26) ─────
//
// While a navigation is in flight, `page.url` is stale. A flush that merges
// or compares against the live URL there works with yesterday's state — the
// two attacks below are the review's red counter-examples, pinned green
// against the `intendedSearch` basis.

describe('bindViewToUrl — flushes while a navigation is in flight', () => {
  it('a revert typed during a slow navigation ends with view and URL consistent (attack 1)', async () => {
    // Clear, then retype the same value while the clearing navigation is in
    // flight: against the stale live URL the corrective flush read as
    // "cancels out" and was swallowed — permanent view↔URL divergence.
    resetMockApp('?q=a');
    const view = new TestView();
    inRoot(() => bindViewToUrl(view, { debounceMs: 100 }));
    expect(view.search).toBe('a'); // init applied

    setNavigationLatency(200);

    view.search = ''; // the reader clears the search…
    flushSync();
    await advance(100); // …debounce fires → clearing goto in flight (lands at +200)

    view.search = 'a'; // …and retypes while it is in flight
    flushSync();
    await advance(100); // this flush must base itself on the INTENDED search

    await advance(200); // both navigations land
    await advance(2000); // let any corrective debounce run out

    expect(view.search).toBe('a');
    expect(new URLSearchParams(search()).get('q')).toBe('a');
  });

  it('two prefixed bindings with staggered debounces under latency keep BOTH slices (attack 2, Prüfstein 14)', async () => {
    // b's flush happens while a's navigation is still in flight; merging on
    // the stale live URL (bare) erased a's slice from the URL for good.
    const a = new TestView();
    const b = new TestView();
    inRoot(() => {
      bindViewToUrl(a, { prefix: 'a_', debounceMs: 100 });
      bindViewToUrl(b, { prefix: 'b_', debounceMs: 200 });
    });
    setNavigationLatency(300);

    a.search = 'aye';
    b.search = 'bee';
    flushSync();

    await advance(100); // a's goto departs (lands at +300)
    await advance(100); // b's flush merges onto the intended search, not the stale URL
    await advance(300); // a's navigation lands
    await advance(300); // b's navigation lands
    await advance(2000); // any corrective debounce

    const sp = new URLSearchParams(search());
    expect(a.search).toBe('aye');
    expect(b.search).toBe('bee');
    expect(sp.get('a_q')).toBe('aye');
    expect(sp.get('b_q')).toBe('bee');
  });
});

describe('bindViewToUrl — mirror-only submissions (attack 3)', () => {
  it('reflectExternal replaces even in push mode — a seed mirror mints no history entry', async () => {
    // `replaceState: false` configures the *reader's* navigations. A pure
    // external mirror (a storage seed reaching the URL) is not one — it must
    // never grow the back-button stack, whatever the binding's push mode.
    const view = new TestView();
    inRoot(() => bindViewToUrl(view, { reflectExternal: true, replaceState: false }));
    view.applyExternal({ search: 'stored' }, 'external');
    flushSync();
    await advance(300);
    expect(new URLSearchParams(search()).get('q')).toBe('stored');
    expect(navigationLog.pushCount).toBe(0);
  });
});

describe('bindViewToUrl — the writer-side key registry', () => {
  it('two prefixless bindings on two different views fail loud, pointing at `prefix`', () => {
    // The view-level claims cannot see this one: each binding claims axes on
    // its OWN view, yet both manage the same URL keys — last flush wins and a
    // shared link loads the wrong table. The writer is the one place that
    // sees every binding on the page.
    const a = new TestView();
    const b = new TestView();
    inRoot(() => bindViewToUrl(a));
    expect(() => inRoot(() => bindViewToUrl(b))).toThrow(/prefix/);
  });

  it('a destroyed binding releases its keys — a later binding on another view is legal', () => {
    const a = new TestView();
    const destroy = inRoot(() => bindViewToUrl(a));
    destroy();
    roots = roots.filter((d) => d !== destroy);
    const b = new TestView();
    expect(() => inRoot(() => bindViewToUrl(b))).not.toThrow();
  });
});

describe('bindViewToUrl — teardown withdraws unflushed writer jobs', () => {
  it('a job submitted in the same task as the unmount never navigates', async () => {
    // The debounce can fire in the task that also unmounts the component:
    // the job is submitted, the coalescing flush microtask has not run yet.
    // Teardown must pull the job back, or the dead table's params navigate
    // onto whatever page comes next.
    const view = new TestView();
    const destroy = inRoot(() => bindViewToUrl(view, { debounceMs: 100 }));
    view.search = 'ada';
    flushSync();
    vi.advanceTimersByTime(100); // debounce fires → job submitted, flush queued
    destroy(); // unmount before the microtask flush
    roots = roots.filter((d) => d !== destroy);
    await land(); // the writer flush runs — and must find nothing to send
    expect(navigationLog.gotoCount).toBe(0);
  });
});
