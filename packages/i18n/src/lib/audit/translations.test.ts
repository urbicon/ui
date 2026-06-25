import { describe, expect, it } from 'vitest';
import { auditTranslations } from './translations';

describe('auditTranslations — parity', () => {
  it('passes for key-compatible bundles with no quality issues', () => {
    const r = auditTranslations('p', {
      en: { a: 'Apple', nested: { x: 'Ex' } },
      de: { a: 'Apfel', nested: { x: 'Iks' } }
    });
    expect(r.ok).toBe(true);
    expect(r.findings).toEqual([]);
  });

  it('flags a missing nested key as an error (a top-level diff would miss it)', () => {
    const r = auditTranslations('p', {
      en: { nested: { x: 'X', y: 'Y' } },
      de: { nested: { x: 'X' } }
    });
    expect(r.ok).toBe(false);
    expect(
      r.errors.some((f) => f.code === 'missing-key' && f.key === 'nested.y' && f.locale === 'de')
    ).toBe(true);
  });

  it('flags an extra key as a warning (not an error)', () => {
    const r = auditTranslations('p', {
      en: { a: 'A' },
      de: { a: 'A', z: 'Z' }
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((f) => f.code === 'extra-key' && f.key === 'z')).toBe(true);
  });

  it('reports "no translations" as an error for an empty bundle map', () => {
    const r = auditTranslations('p', {});
    expect(r.ok).toBe(false);
    expect(r.errors[0]?.code).toBe('no-translations');
  });

  it('prefixes every detail with the package name', () => {
    const r = auditTranslations('mypkg', { en: { a: 'A' }, de: {} });
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.every((f) => f.detail.startsWith('[mypkg]'))).toBe(true);
  });
});

describe('auditTranslations — empty values', () => {
  it('is an error when a non-base locale empties a non-empty base value', () => {
    const r = auditTranslations('p', { en: { a: 'Apple' }, de: { a: '   ' } });
    const f = r.findings.find((x) => x.code === 'empty-value' && x.locale === 'de');
    expect(f?.severity).toBe('error');
  });

  it('is only a warning when the base value is itself empty', () => {
    const r = auditTranslations('p', { en: { a: '' }, de: { a: '' } });
    expect(r.ok).toBe(true);
    expect(
      r.findings.filter((f) => f.code === 'empty-value').every((f) => f.severity === 'warning')
    ).toBe(true);
  });
});

describe('auditTranslations — interpolation params', () => {
  it('errors when a locale drops a param the base declares', () => {
    const r = auditTranslations('p', { en: { greet: 'Hi {{name}}' }, de: { greet: 'Hallo' } });
    const f = r.errors.find((x) => x.code === 'param-mismatch' && x.key === 'greet');
    expect(f).toBeDefined();
    expect(f?.detail).toContain('{{name}}');
  });

  it('errors when a locale adds a param the base never passes', () => {
    const r = auditTranslations('p', { en: { greet: 'Hi' }, de: { greet: 'Hallo {{name}}' } });
    expect(r.errors.some((f) => f.code === 'param-mismatch')).toBe(true);
  });

  it('passes when params match across locales', () => {
    const r = auditTranslations('p', {
      en: { greet: 'Hi {{name}}' },
      de: { greet: '{{name}}, hallo' }
    });
    expect(r.errors.some((f) => f.code === 'param-mismatch')).toBe(false);
  });
});

describe('auditTranslations — plural objects', () => {
  it('errors on a malformed _plural JSON value', () => {
    const r = auditTranslations('p', { en: { x: '1', x_plural: 'definitely not json' } });
    expect(r.errors.some((f) => f.code === 'plural-shape-invalid')).toBe(true);
  });

  it('errors when a _plural object lacks a string "other" form', () => {
    const r = auditTranslations('p', { en: { x: '1', x_plural: JSON.stringify({ one: 'a' }) } });
    expect(r.errors.some((f) => f.code === 'plural-shape-invalid' && /other/.test(f.detail))).toBe(
      true
    );
  });

  it('warns when a _plural object misses a CLDR form required by the locale', () => {
    // de cardinal categories are [one, other]; only `other` present → `one` missing.
    const r = auditTranslations('p', {
      de: { x: '1', x_plural: JSON.stringify({ other: 'viele' }) }
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((f) => f.code === 'plural-category-incomplete')).toBe(true);
  });
});

describe('auditTranslations — placeholder & same-as-base', () => {
  it('warns when a value equals its own key', () => {
    const r = auditTranslations('p', { en: { foo: 'foo' } });
    expect(r.warnings.some((f) => f.code === 'value-equals-key' && f.key === 'foo')).toBe(true);
  });

  it('does not run same-as-base by default, but does when opted in', () => {
    const bundles = { en: { hello: 'Hello' }, de: { hello: 'Hello' } };
    expect(auditTranslations('p', bundles).warnings.some((f) => f.code === 'same-as-base')).toBe(
      false
    );
    const r = auditTranslations('p', bundles, { checks: { 'same-as-base': true } });
    expect(r.warnings.some((f) => f.code === 'same-as-base' && f.key === 'hello')).toBe(true);
  });
});

describe('auditTranslations — options', () => {
  it('skips ignored keys (exact and prefix glob) across all checks', () => {
    const r = auditTranslations(
      'p',
      { en: { keep: 'K', errors: { a: 'A', b: 'B' } }, de: { keep: 'K' } },
      { ignoreKeys: ['errors.*'] }
    );
    expect(r.ok).toBe(true);
    expect(r.findings.some((f) => f.key.startsWith('errors'))).toBe(false);
  });

  it('respects an explicit baseLocale', () => {
    // de is the base; en adds an extra key → warning against de, not an error.
    const r = auditTranslations(
      'p',
      { en: { a: 'A', b: 'B' }, de: { a: 'A' } },
      { baseLocale: 'de' }
    );
    expect(r.ok).toBe(true);
    expect(
      r.warnings.some((f) => f.code === 'extra-key' && f.key === 'b' && f.locale === 'en')
    ).toBe(true);
  });
});

describe('auditTranslations — structural defects', () => {
  it('flags a non-string scalar leaf as wrong-type (a key-diff cannot see it)', () => {
    const r = auditTranslations('p', { en: { a: 42 } });
    expect(r.ok).toBe(false);
    expect(
      r.errors.some((f) => f.code === 'wrong-type' && f.key === 'a' && /number/.test(f.detail))
    ).toBe(true);
  });

  it('flags an empty-object leaf where the base has a string (same path, different shape)', () => {
    const r = auditTranslations('p', { en: { a: { b: 'Hi' } }, de: { a: { b: {} } } });
    expect(
      r.errors.some((f) => f.code === 'wrong-type' && f.locale === 'de' && f.key === 'a.b')
    ).toBe(true);
  });

  it('reports an unsupported locale tag as a finding instead of crashing on Intl', () => {
    // Locale keys are typed, but a JS consumer can pass a bad tag — and a `_plural`
    // entry would otherwise crash `Intl.PluralRules('de_DE')` and abort the audit.
    const r = auditTranslations('p', {
      en: { x: '1' },
      de_DE: { x: '1', x_plural: '{"other":"viele"}' }
    } as never);
    expect(r.errors.some((f) => f.code === 'invalid-locale' && /de_DE/.test(f.detail))).toBe(true);
  });
});
