/**
 * The URL binding under SSR — two consecutive server requests against the
 * same route (the B1 blocker of the v8 review). Runs in the **ssr** vitest
 * project: deliberately WITHOUT `resolve.conditions: ['browser']`, so Svelte
 * resolves to its server build, where `$effect` is a no-op — exactly the SSR
 * situation, in which the destroy teardown (`releaseAxes` +
 * `writer.unregister`) does not exist. `$app/environment` resolves to the
 * server half (`browser: false`); see vitest.config.ts.
 *
 * Red seen (2026-08-06, pre-fix): with `writer.register(owner, managedKeys)`
 * called unconditionally in the constructor, "request 2" threw
 * `[bindViewToUrl] two url bindings on this page manage the URL key "q"` and
 * the module-global live-key registry grew by one entry per request — the
 * measured 500-on-every-request-after-the-first for a Node-adapter consumer,
 * and the unbounded leak across disjoint routes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { page, resetMockApp } from '../test-support/app-harness.svelte';
import { TestView } from '../test-support/test-view.svelte';
import {
  __resetUrlWriterForTests,
  __urlWriterLiveKeyCountForTests,
  bindViewToUrl
} from './view-binding.svelte';

beforeEach(() => {
  resetMockApp();
  __resetUrlWriterForTests();
});

describe('bindViewToUrl — SSR requests against the module-global writer', () => {
  it('request 2 of the same route does not throw (each request is a fresh view, the writer is not)', () => {
    // "Request 1" — a complete component init on the server.
    expect(() => bindViewToUrl(new TestView())).not.toThrow();
    // "Request 2" — a new request, a fresh request-scoped view, same route,
    // same URL keys. The writer module is the same instance across both.
    expect(() => bindViewToUrl(new TestView())).not.toThrow();
  });

  it('the live-key registry does not grow across requests (no per-route leak)', () => {
    bindViewToUrl(new TestView());
    const afterFirst = __urlWriterLiveKeyCountForTests();
    // A second route's render (distinct keys via prefix — the disjoint-routes
    // shape, which never even threw, it only leaked).
    bindViewToUrl(new TestView(), { prefix: 't_' });
    expect(__urlWriterLiveKeyCountForTests()).toBe(afterFirst);
    // The registry serves the client writer only — on the server it stays
    // empty altogether.
    expect(afterFirst).toBe(0);
  });

  it('still applies a deep link during SSR (the fix must not gate the init phase)', () => {
    // Positive control for this suite: the init half runs on the server —
    // a `?q=…` link reaches the view before the server render.
    resetMockApp('?q=ada&page=3');
    const view = new TestView();
    bindViewToUrl(view);
    expect(view.search).toBe('ada');
    expect(view.page).toBe(3);
    expect(page.url.search).toBe('?q=ada&page=3');
  });
});
