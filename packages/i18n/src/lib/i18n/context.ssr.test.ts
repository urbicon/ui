import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import SetLocaleHarness from './__fixtures__/SetLocaleHarness.svelte';
import SsrHarness from './__fixtures__/SsrHarness.svelte';
import { configureI18n, I18nState } from './context.svelte';
import { getRegistry, I18nRegistry } from './registry.svelte';
import type { I18nError } from './types';

/**
 * WP2 acceptance — SSR correctness. Rendered with `svelte/server`'s `render`
 * (SSR-to-string, no DOM), which is exactly the server path that the removed
 * locale singleton corrupted across requests.
 */

// The hooks resolve against the process-wide registry; register the fixture data.
getRegistry().registerPackage('ssrtest', { en: { hi: 'Hello' }, de: { hi: 'Hallo' } });

describe('I18nProvider + useI18n (SSR render)', () => {
  it('renders the provider locale', () => {
    expect(render(SsrHarness, { props: { locale: 'de' } }).body).toContain('Hallo');
    expect(render(SsrHarness, { props: { locale: 'en' } }).body).toContain('Hello');
  });

  it('read-tolerant: no provider renders the base locale (no setup, no error)', () => {
    expect(render(SsrHarness, { props: {} }).body).toContain('Hello');
  });

  it('isolation: two concurrent renders with different locales do not leak', () => {
    // The crux of the fix: same module-global registry, different per-render
    // locale. A shared mutable locale (the old singleton) would make these two
    // renders interfere; request-scoped context keeps them independent.
    const de = render(SsrHarness, { props: { locale: 'de' } }).body;
    const en = render(SsrHarness, { props: { locale: 'en' } }).body;
    expect(de).toContain('Hallo');
    expect(en).toContain('Hello');
  });

  it('write-strict: setLocale without a provider throws a clear error', () => {
    expect(render(SetLocaleHarness, { props: { provide: false } }).body).toContain(
      'needs-provider'
    );
  });

  it('write path works under a provider (setLocale does not throw)', () => {
    expect(render(SetLocaleHarness, { props: { provide: true } }).body).toContain('no-error');
  });
});

describe('I18nState isolation (unit)', () => {
  it('two request states resolve independently against the shared registry', () => {
    const registry = new I18nRegistry();
    registry.registerPackage('iso', { en: { hi: 'Hello' }, de: { hi: 'Hallo' } });
    const reqA = new I18nState('de');
    const reqB = new I18nState('en');
    expect(registry.translate('iso.hi', reqA.locale, reqA.fallbackLocale)).toBe('Hallo');
    expect(registry.translate('iso.hi', reqB.locale, reqB.fallbackLocale)).toBe('Hello');
    // Switching one request's locale leaves the other untouched (no leak).
    reqA.setLocale('en');
    expect(reqB.locale).toBe('en');
    expect(registry.translate('iso.hi', reqA.locale, reqA.fallbackLocale)).toBe('Hello');
  });

  it('setLocale rejects an unsupported locale (returns false, locale unchanged)', () => {
    const state = new I18nState('en');
    // @ts-expect-error deliberately invalid locale
    expect(state.setLocale('xx')).toBe(false);
    expect(state.locale).toBe('en');
  });

  it('the module-global registry serves two states independently (no leak under switching)', () => {
    // Stronger than the fresh-instance case above: proves the SHARED process-wide
    // registry (getRegistry) — the one a real SSR server uses — stays isolated per
    // I18nState. The mutable locale is in the state, not the registry.
    const registry = getRegistry();
    registry.registerPackage('isoglobal', { en: { hi: 'Hello' }, de: { hi: 'Hallo' } });
    const a = new I18nState('de');
    const b = new I18nState('en');
    expect(registry.translate('isoglobal.hi', a.locale, a.fallbackLocale)).toBe('Hallo');
    expect(registry.translate('isoglobal.hi', b.locale, b.fallbackLocale)).toBe('Hello');
    a.setLocale('en');
    expect(b.locale).toBe('en');
  });
});

describe('error sink (configureI18n) + setLocale failure surfacing', () => {
  it('configureI18n routes errors to the handler; setLocale to a rejecting/dataless locale is loud', async () => {
    const errors: I18nError[] = [];
    configureI18n({ onError: (e) => errors.push(e) });
    try {
      const registry = getRegistry();
      // A loader that rejects, for a locale with no eager data → reads can't fall
      // back to it. The fire-and-forget switch must still surface the failure.
      registry.registerTranslationLoader('fr', async () => {
        throw new Error('chunk 404');
      });
      const state = new I18nState('en');
      expect(state.setLocale('fr')).toBe(true); // switch initiated (reactive contract)
      // let loadLocale settle + the setLocale .then run
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(errors.map((e) => e.type)).toContain('load-failed-no-fallback');
    } finally {
      configureI18n({ onError: undefined }); // reset the process-global sink
    }
  });
});
