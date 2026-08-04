// @vitest-environment jsdom
import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';
import { I18nState } from './context.svelte';
import { I18nRegistry } from './registry.svelte';

/**
 * Reactivity invariants after the WP2 split.
 *
 * Two independent reactive sources must keep `$derived` resolution live:
 *  - the registry's `SvelteMap` of package translations (re-resolve when a
 *    package registers more keys, e.g. a lazily-loaded sub-package), and
 *  - the request-scoped `I18nState.locale` `$state` (re-resolve on `setLocale`).
 *
 * Both run inside `$effect.root` + `flushSync`, no component context — but they
 * do need the DOM environment, which is why the docblock above is not optional.
 * Written without it, this file passed for months while running nothing: only
 * vitest's web transform mode consults `resolve.conditions`, so under the node
 * default Svelte resolved to its server build, where `$effect.root` is a no-op
 * that discards its callback unread. Sabotaging `setLocale` to `return false`
 * left both tests green. They fail now.
 */
describe('reactivity', () => {
  it('$derived(registry.translate(...)) re-computes when a package registers', () => {
    const registry = new I18nRegistry();
    const cleanup = $effect.root(() => {
      let seen = '';
      const label = $derived(registry.translate('rxpkg.k', 'en', 'en'));
      $effect(() => {
        seen = label;
      });

      flushSync();
      expect(seen).toBe('rxpkg.k'); // not registered yet → raw key

      registry.registerPackage('rxpkg', { en: { k: 'REGISTERED' } });
      flushSync();
      expect(seen).toBe('REGISTERED'); // derived re-ran on the SvelteMap mutation
    });
    cleanup();
  });

  it('$derived over I18nState.locale re-computes on setLocale', () => {
    const registry = new I18nRegistry();
    registry.registerPackage('rxloc', { en: { k: 'EN' }, de: { k: 'DE' } });
    const state = new I18nState('en');

    const cleanup = $effect.root(() => {
      let seen = '';
      const label = $derived(registry.translate('rxloc.k', state.locale, state.fallbackLocale));
      $effect(() => {
        seen = label;
      });

      flushSync();
      expect(seen).toBe('EN');

      state.setLocale('de');
      flushSync();
      expect(seen).toBe('DE');
    });
    cleanup();
  });
});
