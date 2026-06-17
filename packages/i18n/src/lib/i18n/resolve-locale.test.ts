import { describe, expect, it } from 'vitest';
import { resolveLocale } from './resolve-locale';

describe('resolveLocale', () => {
  const opts = { supportedLocales: ['en', 'de'] as const, defaultLocale: 'en' as const };

  it('prefers a supported cookie value', () => {
    expect(resolveLocale({ cookie: 'urbicon-locale=de' }, opts)).toBe('de');
  });

  it('parses the locale cookie among other cookies', () => {
    expect(resolveLocale({ cookie: 'theme=dark; urbicon-locale=de; x=1' }, opts)).toBe('de');
  });

  it('ignores an unsupported cookie value and falls through to Accept-Language', () => {
    expect(
      resolveLocale({ cookie: 'urbicon-locale=fr', acceptLanguage: 'de-DE,de;q=0.9' }, opts)
    ).toBe('de');
  });

  it('honours Accept-Language q-weighting, skipping unsupported tags', () => {
    expect(resolveLocale({ acceptLanguage: 'fr;q=0.9, de;q=0.8, en;q=0.7' }, opts)).toBe('de');
  });

  it('matches the base language of a region tag', () => {
    expect(resolveLocale({ acceptLanguage: 'de-AT' }, opts)).toBe('de');
  });

  it('falls back to the default locale when nothing matches', () => {
    expect(resolveLocale({ acceptLanguage: 'fr,es' }, opts)).toBe('en');
    expect(resolveLocale({}, opts)).toBe('en');
  });

  it('reads cookie + Accept-Language from a Request', () => {
    const req = new Request('http://example.test', {
      headers: { cookie: 'urbicon-locale=de', 'accept-language': 'en' }
    });
    expect(resolveLocale(req, opts)).toBe('de');
  });

  it('honours a custom cookie name', () => {
    expect(resolveLocale({ cookie: 'lang=de' }, { ...opts, cookieName: 'lang' })).toBe('de');
  });
});
