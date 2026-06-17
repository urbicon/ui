import { describe, expect, it } from 'vitest';
import { I18nRegistry } from './registry.svelte';

/**
 * Resolution tests for the static registry.
 *
 * Ported from the old I18nService characterization suite. The registry holds no
 * mutable locale — every resolver takes `locale`/`fallbackLocale` explicitly — so
 * each test passes the locale in instead of mutating a stored value. Behaviour is
 * otherwise pinned exactly (these guarded the WP2 split).
 */

const PKG = {
  en: {
    greeting: 'Hello',
    welcome: 'Welcome {{name}}',
    apple: '{{count}} apple',
    apple_plural: '{"one":"{{count}} apple","other":"{{count}} apples"}',
    only_en: 'English only',
    nested: { deep: 'Deep value' }
  },
  de: {
    greeting: 'Hallo',
    welcome: 'Willkommen {{name}}',
    apple: '{{count}} Apfel',
    apple_plural: '{"one":"{{count}} Apfel","other":"{{count}} Äpfel"}',
    nested: { deep: 'Tiefer Wert' }
  }
};

function freshWithPkg(name = 'pkg') {
  const reg = new I18nRegistry();
  reg.registerPackage(name, PKG);
  return reg;
}

describe('package key resolution', () => {
  it('path 1: dotted key whose head is a registered package', () => {
    expect(freshWithPkg().translate('pkg.greeting', 'en', 'en')).toBe('Hello');
  });

  it('path 1: resolves nested package keys', () => {
    expect(freshWithPkg().translate('pkg.nested.deep', 'en', 'en')).toBe('Deep value');
  });

  it('path 2: explicit packageName option', () => {
    expect(
      freshWithPkg().translate('greeting', 'en', 'en', undefined, { packageName: 'pkg' })
    ).toBe('Hello');
  });

  it('returns the raw key when the package key is missing', () => {
    expect(freshWithPkg().translate('pkg.does.not.exist', 'en', 'en')).toBe('pkg.does.not.exist');
  });

  it('both paths fall back to fallbackLocale — path 1 only via the global mirror', () => {
    const reg = freshWithPkg();
    // de is active, `only_en` exists in en, not de.
    // Path 2 (explicit packageName) falls back en -> value, directly.
    expect(reg.translate('only_en', 'de', 'en', undefined, { packageName: 'pkg' })).toBe(
      'English only'
    );
    // Path 1 (dotted) finds nothing in de, then path 3 (fallbackToGlobal) hits
    // the en mirror written by registerPackage's global-merge.
    expect(reg.translate('pkg.only_en', 'de', 'en')).toBe('English only');
  });
});

describe('interpolation', () => {
  it('substitutes a string param', () => {
    expect(freshWithPkg().translate('pkg.welcome', 'en', 'en', { name: 'Ada' })).toBe(
      'Welcome Ada'
    );
  });

  it('leaves the placeholder when the param is missing', () => {
    expect(freshWithPkg().translate('pkg.welcome', 'en', 'en')).toBe('Welcome {{name}}');
  });
});

describe('locale resolution (explicit locale arg replaces stored locale)', () => {
  it('resolves the requested locale', () => {
    const reg = freshWithPkg();
    expect(reg.translate('pkg.greeting', 'en', 'en')).toBe('Hello');
    expect(reg.translate('pkg.greeting', 'de', 'en')).toBe('Hallo');
  });
});

describe('plural', () => {
  it('selects the plural rule for count > 1', () => {
    expect(
      freshWithPkg().pluralize('apple', { count: 3 }, 'en', 'en', { packageName: 'pkg' })
    ).toBe('3 apples');
  });

  it('selects the singular rule for count === 1', () => {
    expect(
      freshWithPkg().pluralize('apple', { count: 1 }, 'en', 'en', { packageName: 'pkg' })
    ).toBe('1 apple');
  });

  it('count 0 with only one/other rules resolves to other (CLDR, not the old zero)', () => {
    expect(
      freshWithPkg().pluralize('apple', { count: 0 }, 'en', 'en', { packageName: 'pkg' })
    ).toBe('0 apples');
  });

  it('no _plural object: returns the base string unchanged (no anglocentric +s)', () => {
    expect(
      freshWithPkg().pluralize('greeting', { count: 3 }, 'en', 'en', { packageName: 'pkg' })
    ).toBe('Hello');
  });

  it('malformed _plural lacking "other" falls through to the base form (no crash)', () => {
    const reg = new I18nRegistry();
    reg.registerPackage('mp', { en: { x: 'base {{count}}', x_plural: '{"one":"one {{count}}"}' } });
    expect(reg.pluralize('x', { count: 3 }, 'en', 'en', { packageName: 'mp' })).toBe('base 3');
  });

  it('preserves an intentional empty-string plural entry (?? not ||)', () => {
    const reg = new I18nRegistry();
    reg.registerPackage('es', {
      en: { y: 'base', y_plural: '{"one":"","other":"{{count}} items"}' }
    });
    expect(reg.pluralize('y', { count: 1 }, 'en', 'en', { packageName: 'es' })).toBe('');
  });
});

describe('getPluralRule (Intl.PluralRules / CLDR categories)', () => {
  // getPluralRule is private; reach it via a narrow cast. It delegates straight
  // to Intl.PluralRules, so it is correct for ANY BCP-47 locale — even ones
  // outside SUPPORTED_LOCALES.
  const ruleFor = (count: number, locale: string) =>
    (
      new I18nRegistry() as unknown as {
        getPluralRule(count: number, locale: string): Intl.LDMLPluralRule;
      }
    ).getPluralRule(count, locale);

  it('English/German collapse to one/other — the dead count===2 → two branch is gone', () => {
    expect(ruleFor(1, 'en')).toBe('one');
    expect(ruleFor(2, 'en')).toBe('other');
    expect(ruleFor(0, 'de')).toBe('other');
  });

  it('Slavic locales get few/many', () => {
    expect(ruleFor(3, 'pl')).toBe('few');
    expect(ruleFor(5, 'pl')).toBe('many');
    expect(ruleFor(2, 'ru')).toBe('few');
  });

  it('Arabic exercises the full category set', () => {
    expect(ruleFor(0, 'ar')).toBe('zero');
    expect(ruleFor(1, 'ar')).toBe('one');
    expect(ruleFor(2, 'ar')).toBe('two');
    expect(ruleFor(3, 'ar')).toBe('few');
  });

  it('caches per locale (same instance returned across calls)', () => {
    const reg = new I18nRegistry() as unknown as {
      getPluralRule(count: number, locale: string): Intl.LDMLPluralRule;
      pluralRulesCache: Map<string, Intl.PluralRules>;
    };
    reg.getPluralRule(1, 'en');
    reg.getPluralRule(5, 'en');
    expect(reg.pluralRulesCache.size).toBe(1);
  });
});

describe('global merge + fallbackToGlobal', () => {
  it('resolves a globally added key', () => {
    const reg = new I18nRegistry();
    reg.addTranslations('en', { plainGlobal: 'Plain global' });
    expect(reg.translate('plainGlobal', 'en', 'en')).toBe('Plain global');
  });

  it('registerPackage also mirrors into the global namespace', () => {
    const reg = freshWithPkg();
    expect(reg.getPackageTranslations('pkg')?.en).toMatchObject({ greeting: 'Hello' });
  });
});

describe('introspection API', () => {
  it('exists() reports package key presence', () => {
    const reg = freshWithPkg();
    expect(reg.exists('greeting', 'en', 'pkg')).toBe(true);
    expect(reg.exists('nope', 'en', 'pkg')).toBe(false);
  });

  it('getPackageLocales / hasPackage / registeredPackages', () => {
    const reg = freshWithPkg();
    expect(reg.getPackageLocales('pkg').sort()).toEqual(['de', 'en']);
    expect(reg.hasPackage('pkg')).toBe(true);
    expect(reg.hasPackage('ghost')).toBe(false);
    expect(reg.registeredPackages).toContain('pkg');
  });
});

describe('formatting (locale threaded explicitly)', () => {
  it('formatNumber uses the requested locale', () => {
    const reg = new I18nRegistry();
    // de groups thousands with '.', en with ','.
    expect(reg.formatNumber(1234.5, 'de')).toBe('1.234,5');
    expect(reg.formatNumber(1234.5, 'en')).toBe('1,234.5');
  });

  it('caches the default (option-less) NumberFormat per locale', () => {
    const reg = new I18nRegistry() as unknown as {
      formatNumber(value: number, locale: string): string;
      numberFormatCache: Map<string, Intl.NumberFormat>;
    };
    reg.formatNumber(1, 'en');
    reg.formatNumber(2, 'en');
    expect(reg.numberFormatCache.size).toBe(1);
  });
});
