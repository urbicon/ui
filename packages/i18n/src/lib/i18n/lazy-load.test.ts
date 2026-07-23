import { describe, expect, it, vi } from 'vitest';
import { createPackageI18n } from './package-integration';
import { I18nRegistry } from './registry.svelte';

/**
 * WP4 — opt-in per-package locale code-splitting. The eager bundle (typically
 * `en`) is the base; other locales register as lazy loaders and resolve to the
 * fallback until their chunk is loaded, then to their own bundle.
 */
describe('WP4 — per-package lazy loading', () => {
  it('package hook path: lazy locale falls back until loaded, then resolves itself', async () => {
    const reg = new I18nRegistry();
    reg.registerPackage('lz', { en: { hi: 'Hello' } }); // eager base
    const loader = vi.fn(async () => ({ hi: 'Hallo' }));
    reg.registerPackageLoader('lz', 'de', loader);

    // Before load: the package-scoped lookup (the hook's path) misses de and
    // falls back to the eager en bundle. The loader has NOT run.
    expect(reg.translate('hi', 'de', 'en', undefined, { packageName: 'lz' })).toBe('Hello');
    expect(loader).not.toHaveBeenCalled();

    expect(await reg.loadPackageLocale('lz', 'de')).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);

    // After load: de resolves to its own bundle (the data landed in the reactive
    // packageTranslations, so a $derived read would re-resolve here).
    expect(reg.translate('hi', 'de', 'en', undefined, { packageName: 'lz' })).toBe('Hallo');
    // ...also via the dotted global path.
    expect(reg.translate('lz.hi', 'de', 'en')).toBe('Hallo');

    // Idempotent: a second load does not re-run the loader.
    expect(await reg.loadPackageLocale('lz', 'de')).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("loadLocale loads every package's bundle for the locale", async () => {
    const reg = new I18nRegistry();
    reg.registerPackage('a', { en: { k: 'A-en' } });
    reg.registerPackage('b', { en: { k: 'B-en' } });
    reg.registerPackageLoader('a', 'de', async () => ({ k: 'A-de' }));
    reg.registerPackageLoader('b', 'de', async () => ({ k: 'B-de' }));

    expect(await reg.loadLocale('de')).toBe(true);
    expect(reg.translate('a.k', 'de', 'en')).toBe('A-de');
    expect(reg.translate('b.k', 'de', 'en')).toBe('B-de');
  });

  it('lazy locales are visible in getPackageLocales / getAvailableLocales before load', () => {
    const reg = new I18nRegistry();
    reg.registerPackage('p', { en: { k: 'x' } });
    reg.registerPackageLoader('p', 'fr', async () => ({ k: 'y' }));
    expect(reg.getPackageLocales('p').sort()).toEqual(['en', 'fr']);
    expect(reg.getAvailableLocales()).toContain('fr');
  });

  it('createPackageI18n registers loaders from options.loaders', () => {
    const pkg = createPackageI18n(
      'lzfactory',
      { en: { hi: 'Hello' } as const },
      { loaders: { de: async () => ({ hi: 'Hallo' }) } }
    );
    // The non-hook t resolves the base locale.
    expect(pkg.t('hi')).toBe('Hello');
    // The lazy locale shows up as available before its chunk loads.
    expect(pkg.getLocales().sort()).toEqual(['de', 'en']);
  });

  it('a failed lazy load reports load-failed and resolves false', async () => {
    const reg = new I18nRegistry();
    const errors: unknown[] = [];
    reg.onError = (e) => errors.push(e);
    reg.registerPackage('f', { en: { k: 'x' } });
    reg.registerPackageLoader('f', 'de', async () => {
      throw new Error('chunk 404');
    });
    expect(await reg.loadPackageLocale('f', 'de')).toBe(false);
    expect(errors).toHaveLength(1);
    // The eager base still resolves — the failed locale just never appears.
    expect(reg.translate('f.k', 'de', 'en')).toBe('x');
  });
});

/**
 * Eager, additive registration — the SSR escape hatch. `registerPackageLocale`
 * (registry) and `registerLocale` (factory) let a consumer register a lazy
 * locale's bundle up front so it resolves on the very first render, without
 * waiting for the provider's client-only chunk load. It must MERGE, not clobber
 * the eager base bundle (the failure mode that a plain second `registerPackage`
 * would cause).
 */
describe('eager additive registration (registerPackageLocale / registerLocale)', () => {
  it('registerPackageLocale merges a locale without dropping the eager base', () => {
    const reg = new I18nRegistry();
    reg.registerPackage('p', { en: { hi: 'Hello' } }); // eager base
    // Register de eagerly and additively — no loader, resolves synchronously.
    reg.registerPackageLocale('p', 'de', { hi: 'Hallo' });

    expect(reg.translate('hi', 'de', 'en', undefined, { packageName: 'p' })).toBe('Hallo');
    // Crucially, en survives the second registration (a plain registerPackage
    // would have .set()-clobbered it).
    expect(reg.translate('hi', 'en', 'en', undefined, { packageName: 'p' })).toBe('Hello');
    expect(reg.getPackageLocales('p').sort()).toEqual(['de', 'en']);
  });

  it('registerLocale (factory) registers a lazy locale eagerly, resolving without the loader', () => {
    const loader = vi.fn(async () => ({ hi: 'Hallo' }));
    const pkg = createPackageI18n(
      'eagerfactory',
      { en: { hi: 'Hello' } as const },
      { loaders: { de: loader } }
    );
    // Eager-register de from an imported bundle instead of via the lazy chunk.
    pkg.registerLocale('de', { hi: 'Hallo' });
    // The loader was never invoked — the eager path made de present directly.
    expect(loader).not.toHaveBeenCalled();
    // Resolvable in both locales via the dotted global path.
    expect(pkg.t('hi')).toBe('Hello');
    expect(pkg.getLocales().sort()).toEqual(['de', 'en']);
  });

  it('registerLocale is write-strict: throws on an unsupported locale or non-object bundle', () => {
    const pkg = createPackageI18n('strictfactory', { en: { hi: 'Hello' } as const });
    // @ts-expect-error deliberately invalid locale
    expect(() => pkg.registerLocale('xx', { hi: 'x' })).toThrow(/unsupported locale/);
    // @ts-expect-error deliberately invalid bundle
    expect(() => pkg.registerLocale('de', null)).toThrow(/must be a translations object/);
    // @ts-expect-error deliberately invalid bundle
    expect(() => pkg.registerLocale('de', [])).toThrow(/must be a translations object/);
  });
});
