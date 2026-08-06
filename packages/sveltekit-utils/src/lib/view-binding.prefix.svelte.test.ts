// @vitest-environment jsdom
/**
 * Prüfstein 14, in its literal wording: **two tables, one page** —
 * `bindViewToUrl(viewA)` plus `bindViewToUrl(viewB, { prefix: 't2_' })`.
 *
 * The spike could not measure this: its serializer had no `prefix`, and the
 * review found two independent URL bindings on one URL *structurally
 * incompatible* — every navigation of one is foreign to the other, and the
 * runtime rule ("absence on a bound axis means the default") flattened the
 * sibling's unmirrored axes. The coalescing writer with its self-navigation
 * marker (§12.9) was the build obligation that followed. This file measures
 * whether the obligation was met in the asymmetric configuration: the
 * *unprefixed* binding owns the bare keys (`q`, `sort`, `page`, …), which are
 * exactly the keys a naive prefix implementation would let the second binding
 * read or overwrite.
 *
 * `view-binding.svelte.test.ts` covers the symmetric pair (`a_`/`b_`),
 * including the staggered-debounce and under-latency attacks; what is pinned
 * here is the init phase per prefix, the asymmetric write path, and what
 * unmounting one of the two leaves behind.
 */
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { back, navigationLog, page, resetMockApp } from '../test-support/app-harness.svelte';
import { TestView } from '../test-support/test-view.svelte';
import { __resetUrlWriterForTests, bindViewToUrl } from './view-binding.svelte';

const search = () => page.url.search;
const params = () => new URLSearchParams(search());

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

function destroyRoot(destroy: () => void): void {
  destroy();
  roots = roots.filter((d) => d !== destroy);
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

describe('Prüfstein 14 — one unprefixed and one prefixed binding, init', () => {
  it('seeds each view from its own keys only', () => {
    resetMockApp('?q=ada&t2_sort=amount&t2_dir=desc&t2_page=3');
    const a = new TestView();
    const b = new TestView();
    inRoot(() => {
      bindViewToUrl(a);
      bindViewToUrl(b, { prefix: 't2_' });
    });

    // The bare keys are the first table's…
    expect(a.search).toBe('ada');
    expect(a.sort).toBeNull();
    expect(a.page).toBe(1);
    // …and the prefixed ones the second's. Neither reads across: `t2_q` is
    // absent, so b's search stays at its default even though `q` is set.
    expect(b.search).toBe('');
    expect(b.sort).toEqual({ column: 'amount', direction: 'desc' });
    expect(b.page).toBe(3);
  });

  it('marks init-applied per binding, so storage seeds only the axes its own URL half left unclaimed', () => {
    resetMockApp('?q=ada&t2_sort=amount');
    const a = new TestView();
    const b = new TestView();
    inRoot(() => {
      bindViewToUrl(a);
      bindViewToUrl(b, { prefix: 't2_' });
    });

    expect(a.wasInitApplied('search')).toBe(true);
    expect(a.wasInitApplied('sort')).toBe(false);
    expect(b.wasInitApplied('search')).toBe(false); // `q` is not b's key
    expect(b.wasInitApplied('sort')).toBe(true);
  });

  it('is fail-loud when the second binding repeats the first prefix instead of varying it', () => {
    // The registry compares URL keys, not views: two `t2_` bindings manage the
    // same keys, and the copy-paste that forgets to change the prefix is the
    // way this happens.
    const a = new TestView();
    const b = new TestView();
    inRoot(() => bindViewToUrl(a, { prefix: 't2_' }));
    expect(() => inRoot(() => bindViewToUrl(b, { prefix: 't2_' }))).toThrow(/prefix/);
  });
});

describe('Prüfstein 14 — one unprefixed and one prefixed binding, writing', () => {
  it('writes both slices, and neither flattens the other', async () => {
    const a = new TestView();
    const b = new TestView();
    inRoot(() => {
      bindViewToUrl(a, { debounceMs: 100 });
      bindViewToUrl(b, { prefix: 't2_', debounceMs: 400 });
    });

    b.search = 'bee'; // pending, 400
    a.search = 'aye'; // pending, 100
    flushSync();

    await advance(100); // a's navigation lands while b's edit is still pending
    expect(params().get('q')).toBe('aye');
    expect(b.search).toBe('bee'); // the landing is self for b too — not flattened

    await advance(300); // b's debounce fires
    expect(params().get('q')).toBe('aye'); // merged, not replaced
    expect(params().get('t2_q')).toBe('bee');
    expect(a.search).toBe('aye');
  });

  it('coalesces same-tick submissions of both bindings into one navigation', async () => {
    const a = new TestView();
    const b = new TestView();
    inRoot(() => {
      bindViewToUrl(a);
      bindViewToUrl(b, { prefix: 't2_' });
    });
    a.page = 2;
    b.page = 5;
    flushSync();
    await advance(300);

    expect(navigationLog.gotoCount).toBe(1);
    expect(params().get('page')).toBe('2');
    expect(params().get('t2_page')).toBe('5');
  });

  it('a genuinely foreign landing applies to both — each from its own keys', async () => {
    const a = new TestView();
    const b = new TestView();
    inRoot(() => {
      bindViewToUrl(a, { replaceState: false });
      bindViewToUrl(b, { prefix: 't2_', replaceState: false });
    });
    a.search = 'aye';
    b.search = 'bee';
    flushSync();
    await advance(300);
    expect(params().get('t2_q')).toBe('bee');

    back(); // → the bare URL, foreign for both
    flushSync();

    // The back-button contract, per binding: absence on a bound axis restores
    // the default rather than leaving yesterday's value standing.
    expect(a.search).toBe('');
    expect(b.search).toBe('');
  });
});

describe('Prüfstein 14 — unmounting one of the two', () => {
  it('leaves the survivor writing its own keys and preserves the dead binding’s params', async () => {
    const a = new TestView();
    const b = new TestView();
    const destroyA = inRoot(() => bindViewToUrl(a));
    inRoot(() => bindViewToUrl(b, { prefix: 't2_' }));

    a.search = 'aye';
    flushSync();
    await advance(300);
    expect(params().get('q')).toBe('aye');

    destroyA(); // the first table leaves the page

    b.search = 'bee';
    flushSync();
    await advance(300);

    // `q` is now nobody's key, so it survives as a foreign param — the merge
    // semantics that keep `?tab=settings` alive do not know the difference.
    // Route-level cleanup is the consumer's job; the binding never deletes a
    // key it does not manage.
    expect(params().get('q')).toBe('aye');
    expect(params().get('t2_q')).toBe('bee');
  });

  it('frees the bare keys for a later unprefixed binding', () => {
    const a = new TestView();
    const destroyA = inRoot(() => bindViewToUrl(a));
    destroyRoot(destroyA);

    // The remounting `{#if}` case, across tables: the registry is keyed by
    // live binding, not by the keys ever used.
    const c = new TestView();
    expect(() => inRoot(() => bindViewToUrl(c))).not.toThrow();
  });
});
