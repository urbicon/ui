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
