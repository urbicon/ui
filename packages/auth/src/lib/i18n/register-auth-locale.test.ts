import type { Locale } from '@urbicon-ui/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { AuthLocale } from './keys.js';

/**
 * The bundle registry is module state, so each test takes a fresh module graph
 * (`vi.resetModules()` + dynamic import) rather than a reset hook: the package
 * exports no way to unregister, and adding one for the tests would put a verb
 * in the public API that no consumer has a use for. `useAuthLocale` needs a
 * Svelte context and is covered by `locale-registration.svelte.test.ts`; this
 * file drives the context-free half.
 */
async function freshI18n() {
  vi.resetModules();
  const [i18n, { de }, { en }] = await Promise.all([
    import('./index.js'),
    import('./de.js'),
    import('./en.js')
  ]);
  return { ...i18n, de, en };
}

describe('registerAuthLocale', () => {
  it('resolves an unregistered locale to English', async () => {
    const { resolveAuthLocale, en } = await freshI18n();

    expect(resolveAuthLocale('de')).toBe(en);
    expect(resolveAuthLocale('fr')).toBe(en);
    expect(resolveAuthLocale()).toBe(en);
  });

  it('resolves a registered locale to its bundle', async () => {
    const { registerAuthLocale, resolveAuthLocale, de } = await freshI18n();

    registerAuthLocale('de', de);

    expect(resolveAuthLocale('de')).toBe(de);
  });

  it('registers any supported locale, not just the two that ship a bundle', async () => {
    // `email.locale` is @urbicon-ui/i18n's `Locale`, a six-value union; only
    // `isLocaleSupported` gates registration, so a consumer's own French bundle
    // is as registrable as the shipped German one.
    const { registerAuthLocale, resolveAuthLocale, de } = await freshI18n();
    const fr = structuredClone(de);
    fr.auth.login.title = 'Connexion';

    registerAuthLocale('fr', fr);

    expect(resolveAuthLocale('fr').auth.login.title).toBe('Connexion');
  });

  it('replaces the bundle on re-registration', async () => {
    const { registerAuthLocale, resolveAuthLocale, de } = await freshI18n();
    const second = structuredClone(de);
    second.auth.login.title = 'Zweite Registrierung';

    registerAuthLocale('de', de);
    registerAuthLocale('de', second);

    expect(resolveAuthLocale('de')).toBe(second);
  });

  it('lets a registered `en` replace the built-in bundle, fallback included', async () => {
    const { registerAuthLocale, resolveAuthLocale, en } = await freshI18n();
    const ownEnglish = structuredClone(en);
    ownEnglish.auth.login.title = 'Welcome back';

    registerAuthLocale('en', ownEnglish);

    expect(resolveAuthLocale('en')).toBe(ownEnglish);
    // An unregistered locale falls back to whatever `en` is now — not to the
    // bundle the package shipped.
    expect(resolveAuthLocale('it')).toBe(ownEnglish);
  });

  it('throws on an unsupported locale, naming the supported list', async () => {
    const { registerAuthLocale, de } = await freshI18n();

    expect(() => registerAuthLocale('xx' as Locale, de)).toThrow(/unsupported locale "xx"/);
    expect(() => registerAuthLocale('xx' as Locale, de)).toThrow(/en, de, fr, es, it, nl/);
  });

  it('throws on a non-object bundle', async () => {
    const { registerAuthLocale } = await freshI18n();

    expect(() => registerAuthLocale('de', null as unknown as AuthLocale)).toThrow(
      /must be an AuthLocale object, got null/
    );
    expect(() => registerAuthLocale('de', [] as unknown as AuthLocale)).toThrow(
      /must be an AuthLocale object, got array/
    );
    expect(() => registerAuthLocale('de', 'de' as unknown as AuthLocale)).toThrow(
      /must be an AuthLocale object, got string/
    );
  });
});
