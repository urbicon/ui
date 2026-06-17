import { describe, expect, it } from 'vitest';
import { createPackageI18n, validatePackageTranslations } from './package-integration';

/**
 * WP1 — type-safety end-to-end through the generic factory.
 *
 * Runtime resolution is covered in service.test.ts; this file pins the *types*.
 * The `@ts-expect-error` lines are verified at check time (svelte-check / tsc),
 * so if `createPackageI18n` ever regresses to accepting any string key again,
 * each directive becomes an "unused @ts-expect-error" compile error here.
 */

const sample = createPackageI18n('wp1-sample', {
  en: {
    dialog: { close: 'Close' },
    greeting: 'Hello {{name}}'
  } as const
});

describe('createPackageI18n — generic factory, runtime', () => {
  it('resolves a typed nested key', () => {
    expect(sample.t('dialog.close')).toBe('Close');
  });

  it('interpolates a param inferred from {{name}}', () => {
    expect(sample.t('greeting', { name: 'Ada' })).toBe('Hello Ada');
  });
});

describe('createPackageI18n — types (enforced by svelte-check, not by vitest)', () => {
  it('accepts known keys/params and rejects unknown keys / wrong params', () => {
    // ✓ valid uses
    sample.t('dialog.close');
    sample.t('greeting', { name: 'Ada' });

    // ✗ unknown nested key
    // @ts-expect-error 'dialog.nonexistent' is not a DeepKey of the en bundle
    sample.t('dialog.nonexistent');

    // ✗ unknown top-level key
    // @ts-expect-error 'nope' is not a key
    sample.t('nope');

    // ✗ required param `name` (inferred from {{name}}) is missing
    // @ts-expect-error missing param object
    sample.t('greeting');

    // ✗ misspelled param name
    // @ts-expect-error param must be `name`, not `naem`
    sample.t('greeting', { naem: 'Ada' });

    expect(true).toBe(true);
  });
});

describe('createPackageI18n — non-en locales are checked against the en schema', () => {
  it('rejects a de bundle that drops a key present in en', () => {
    createPackageI18n('wp1-parity-ok', {
      en: { a: 'A', b: 'B' } as const,
      de: { a: 'A', b: 'B' }
    });

    createPackageI18n('wp1-parity-bad', {
      en: { a: 'A', b: 'B' } as const,
      // @ts-expect-error de is missing key `b` that en declares
      de: { a: 'A' }
    });

    expect(true).toBe(true);
  });
});

describe('validatePackageTranslations — runtime deep-key parity (WP5)', () => {
  it('passes when locales share the same nested keys', () => {
    const r = validatePackageTranslations('p', {
      en: { a: 'A', nested: { x: 'X' } },
      de: { a: 'A', nested: { x: 'X' } }
    });
    expect(r.isValid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('flags a missing NESTED key as an error (a top-level-only check would miss it)', () => {
    const r = validatePackageTranslations('p', {
      en: { nested: { x: 'X', y: 'Y' } },
      de: { nested: { x: 'X' } }
    });
    expect(r.isValid).toBe(false);
    expect(r.errors.join()).toContain('nested.y');
  });

  it('flags an extra nested key as a warning', () => {
    const r = validatePackageTranslations('p', {
      en: { nested: { x: 'X' } },
      de: { nested: { x: 'X', z: 'Z' } }
    });
    expect(r.warnings.join()).toContain('nested.z');
  });

  it('flags structural divergence (object vs string at the same path)', () => {
    const r = validatePackageTranslations('p', {
      en: { a: { b: 'B' } },
      de: { a: 'A' }
    });
    // en's leaf `a.b` is absent in de (whose `a` is itself the leaf)
    expect(r.isValid).toBe(false);
    expect(r.errors.join()).toContain('a.b');
  });

  it('includes the package name in messages', () => {
    const r = validatePackageTranslations('mypkg', {
      en: { a: 'A' },
      de: {}
    });
    expect(r.errors.join()).toContain('[mypkg]');
  });
});
