import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveDateLocale } from './resolve-date-locale';

/**
 * The chain `explicit prop → provider → base locale`, and specifically why the
 * two rungs are not treated alike.
 *
 * Every tag asserted here was measured against the real `Intl` first, not
 * assumed — the three-way split (valid / throws / silently resolves elsewhere)
 * is the whole reason this helper exists:
 *
 *   'de-DE'   → "März"                    valid
 *   'de_DE'   → RangeError                underscore instead of hyphen
 *   ''        → RangeError
 *   'xx'      → "March", resolved en-US   NO throw — follows the runtime
 *   'english' → "March", resolved en-US   NO throw
 *
 * The silent group is the dangerous one: `Intl` falls back to the *runtime*
 * default, which differs between a Node server and a user's browser. A date
 * would then render one way in the prerendered HTML and another after
 * hydration — the exact failure the `'auto'` default was introduced to remove.
 */
describe('resolveDateLocale', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('the prop wins and is trusted', () => {
    it('passes an explicit tag straight through', () => {
      expect(resolveDateLocale('ja-JP', 'de')).toBe('ja-JP');
    });

    it('accepts tags the library ships no translations for', () => {
      // The library formats dates in any locale ICU knows; it only *translates*
      // into six. Restricting the prop to SUPPORTED_LOCALES would conflate the
      // two and make `locale="pt-BR"` impossible.
      for (const tag of ['pt-BR', 'ja-JP', 'ar-EG', 'en-GB']) {
        expect(resolveDateLocale(tag, 'en')).toBe(tag);
      }
    });

    it('does not repair a malformed prop — explicit input fails loudly', () => {
      // Deliberate: the throw comes from `Intl` at the call site that caused it.
      // Silently swapping in `en` here would hide a consumer's typo forever.
      expect(resolveDateLocale('de_DE', 'de')).toBe('de_DE');
    });

    it('treats `auto` as "no explicit choice", not as a tag', () => {
      expect(resolveDateLocale('auto', 'de')).toBe('de');
    });

    it('treats undefined as "no explicit choice"', () => {
      expect(resolveDateLocale(undefined, 'fr')).toBe('fr');
    });
  });

  describe('the context value is verified before it reaches Intl', () => {
    it('passes a supported provider locale through', () => {
      for (const tag of ['en', 'de', 'fr', 'es', 'it', 'nl']) {
        expect(resolveDateLocale(undefined, tag)).toBe(tag);
      }
    });

    it('falls back rather than throwing on a malformed provider locale', () => {
      // `I18nState`'s constructor does not validate, so this reaches components
      // that never saw the value. Without the guard: RangeError → SSR 500.
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(resolveDateLocale(undefined, 'de_DE')).toBe('en');
      expect(resolveDateLocale(undefined, '')).toBe('en');
    });

    it('falls back on a well-formed but unsupported provider locale', () => {
      // The subtler half: these do NOT throw. Left alone, `Intl` resolves them
      // to the runtime default, which differs across the SSR boundary.
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      for (const tag of ['xx', 'zz-ZZ', 'english']) {
        expect(resolveDateLocale(undefined, tag)).toBe('en');
      }
    });

    it('names the offending value and the way out, in DEV', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      resolveDateLocale(undefined, 'klingon');
      expect(warn).toHaveBeenCalledTimes(1);
      const message = String(warn.mock.calls[0]?.[0]);
      // The prefix names the package the warning comes from — it moved here
      // from `blocks` on 2026-08-02, and a message still claiming `[blocks]`
      // would send a reader hunting in the wrong package.
      expect(message).toMatch(/^\[i18n\]/);
      expect(message).toContain('klingon');
      // The remedy has to be in the message: a consumer wanting a locale the
      // library does not translate into should pass it as a prop, not fight the
      // provider.
      expect(message).toContain('locale="ja-JP"');
    });

    it('stays quiet when the provider locale is fine', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      resolveDateLocale(undefined, 'de');
      resolveDateLocale('ja-JP', 'de');
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it('never returns a tag Intl rejects, for any provider value', () => {
    // The property that matters, stated as one: whatever a consumer puts in the
    // provider, a date component must still render.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const tag of ['de_DE', '', 'xx', 'english', 'de-DE-!!', '123', 'zz-ZZ']) {
      const resolved = resolveDateLocale(undefined, tag);
      expect(() => new Intl.DateTimeFormat(resolved).format(new Date())).not.toThrow();
    }
  });
});
