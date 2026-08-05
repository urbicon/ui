import { render } from 'svelte/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ViewModuleScopeHarness from './__fixtures__/ViewModuleScopeHarness.svelte';
import ViewSsrHarness from './__fixtures__/ViewSsrHarness.svelte';
import { createTableView } from './view.svelte';

/**
 * SPIKE — the SSR half: construction and getters resolve during the server
 * render (Prüfstein 1 at unit scale), requests do not share view state when
 * the view is component-scoped (Prüfstein 15), the module-scope counter-probe
 * demonstrates the leak the m4 rule exists for, and the DEV guard's
 * `hasContext` probe actually distinguishes the two situations.
 *
 * Node environment on purpose — same pattern as Table.ssr.test.ts.
 */

describe('SSR renders the linked view (Prüfstein 1, unit scale)', () => {
  it('a sort/search-carrying URL reaches the server HTML synchronously', () => {
    const { body } = render(ViewSsrHarness, {
      props: { search: '?sort=amount&dir=desc&q=ada&page=3' }
    });

    expect(body).toContain('amount:desc');
    expect(body).toContain('ada');
    expect(body).toContain('page:3');
  });

  it('a bare URL renders the defaults', () => {
    const { body } = render(ViewSsrHarness, { props: { search: '' } });

    expect(body).toContain('unsorted');
    expect(body).toContain('empty');
    expect(body).toContain('page:1');
    expect(body).toContain('size:10');
  });

  it('an explicit empty sort param renders unsorted even against a default sort', () => {
    const { body } = render(ViewSsrHarness, { props: { search: '?sort=' } });
    expect(body).toContain('unsorted');
  });
});

describe('request isolation (Prüfstein 15)', () => {
  it('two renders of a component-scoped view do not share state', () => {
    const first = render(ViewSsrHarness, { props: { search: '?q=first-request' } });
    const second = render(ViewSsrHarness, { props: { search: '' } });

    expect(first.body).toContain('first-request');
    expect(second.body).not.toContain('first-request');
    expect(second.body).toContain('empty');
  });

  it('counter-probe: a module-scope view LEAKS between renders — the defect the rule bans', () => {
    const first = render(ViewModuleScopeHarness, { props: { write: 'leaked-from-request-1' } });
    const second = render(ViewModuleScopeHarness, { props: {} });

    expect(first.body).toContain('leaked-from-request-1');
    // The second "request" wrote nothing and still sees the first one's
    // state. This is why module-scope construction must be caught in DEV.
    expect(second.body).toContain('leaked-from-request-1');
  });
});

describe('the DEV guard for module-scope construction (m4)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns when constructed outside component init on the server', () => {
    // This test body IS the module-scope situation: node, no window, no
    // component context. The `hasContext` probe throws here, so the guard
    // fires — measured, not assumed.
    createTableView();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(String(warnSpy.mock.calls[0][0])).toContain('module-scope view');
  });

  it('does not warn during a component render on the server', () => {
    render(ViewSsrHarness, { props: { search: '' } });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
