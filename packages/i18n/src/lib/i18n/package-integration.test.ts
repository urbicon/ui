import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import BaseLocaleHarness from './__fixtures__/BaseLocaleHarness.svelte';
import { dePackage } from './__fixtures__/de-package';
import {
  type CreatePackageI18nOptions,
  createPackageI18n,
  createTypedPackage
} from './package-integration';
import { getRegistry } from './registry.svelte';

/**
 * Type-safety end-to-end through the generic factory.
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

describe('createPackageI18n — lazy registration (registry TDZ)', () => {
  it('does not touch the registry at creation, then registers synchronously on first use', () => {
    const registry = getRegistry();
    // Creating the package must NOT call getRegistry().registerPackage at module-eval
    // (that is the production class-TDZ trigger) — nothing is registered yet.
    const lazy = createPackageI18n('lazy-reg-test', { en: { greeting: 'Hi' } });
    expect(registry.hasPackage('lazy-reg-test')).toBe(false);
    // First use registers synchronously and resolves the real string (no raw key).
    expect(lazy.t('greeting')).toBe('Hi');
    expect(registry.hasPackage('lazy-reg-test')).toBe(true);
  });

  it('register() eagerly registers without a translate call', () => {
    const registry = getRegistry();
    const lazy = createPackageI18n('lazy-reg-test-2', { en: { a: 'A' } });
    expect(registry.hasPackage('lazy-reg-test-2')).toBe(false);
    lazy.register();
    expect(registry.hasPackage('lazy-reg-test-2')).toBe(true);
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

describe('createPackageI18n — `base` names a non-en base bundle', () => {
  it('type-checks a de-only package and types `t` from the de bundle', () => {
    dePackage.t('save');
    dePackage.t('greeting', { name: 'Ada' });
    // @ts-expect-error 'nope' is not a key of the de base bundle
    dePackage.t('nope');
    // @ts-expect-error missing param object for {{name}}
    dePackage.t('greeting');

    // Other locales are checked against the de schema.
    createPackageI18n(
      'base-de-parity-ok',
      { de: { a: 'A', b: 'B' } as const, en: { a: 'A', b: 'B' } },
      { base: 'de' }
    );
    // Overload errors are reported on the call, so each directive sits above one.
    // @ts-expect-error en is missing key `b` that the de base declares
    createPackageI18n('bad-b', { de: { a: 'A', b: 'B' } as const, en: { a: 'A' } }, { base: 'de' });
    // @ts-expect-error en declares key `z` that the de base does not
    createPackageI18n('bad-z', { de: { a: 'A' } as const, en: { a: 'A', z: 'Z' } }, { base: 'de' });
    // @ts-expect-error en is missing the nested key `n.y` that the de base declares
    createPackageI18n(
      'bad-nested-y',
      { de: { n: { x: 'X', y: 'Y' } } as const, en: { n: { x: 'X' } } },
      { base: 'de' }
    );
    // @ts-expect-error en declares the nested key `n.z` that the de base does not
    createPackageI18n(
      'bad-nested-z',
      { de: { n: { x: 'X' } } as const, en: { n: { x: 'X', z: 'Z' } } },
      { base: 'de' }
    );
    // @ts-expect-error with `base: 'de'` the de bundle is required
    createPackageI18n('base-de-missing', { en: { a: 'A' } }, { base: 'de' });
    // @ts-expect-error without `base` the en bundle is still required
    createPackageI18n('base-en-missing', { de: { a: 'A' } });
    // @ts-expect-error without a type argument the options name the en base
    const deOptions: CreatePackageI18nOptions = { base: 'de' };
    void deOptions;

    // The deprecated en-only wrapper keeps its typed `t`.
    const typed = createTypedPackage('base-typed-shim', { en: { a: 'A' } as const });
    typed.t('a');
    // @ts-expect-error 'nope' is not a key of the en bundle
    typed.t('nope');

    expect(true).toBe(true);
  });

  it('resolves its strings without a provider (non-hook t, exists)', () => {
    expect(dePackage.t('save')).toBe('Speichern');
    expect(dePackage.t('greeting', { name: 'Ada' })).toBe('Hallo Ada');
    expect(dePackage.exists('save')).toBe(true);
    expect(dePackage.getLocales()).toEqual(['de']);
  });

  it('ends the lookup chain at the de base: active en, fallback en → de string, not the raw key', () => {
    dePackage.register();
    // Exactly the call useTranslate makes under <I18nProvider locale="en">.
    expect(
      getRegistry().translate('save', 'en', 'en', undefined, { packageName: 'base-de-fixture' })
    ).toBe('Speichern');
  });

  it('a package-prefixed global key walks the same chain before the global namespace', () => {
    dePackage.register();
    // `useI18n().t('base-de-fixture.save')` under a provider on en/en.
    expect(getRegistry().translate('base-de-fixture.save', 'en', 'en')).toBe('Speichern');

    const prefixed = createPackageI18n(
      'base-prefix',
      { en: { a: 'A', b: 'B' } as const, fr: { a: 'A-fr', b: '' } },
      {}
    );
    prefixed.register();
    expect(getRegistry().translate('base-prefix.a', 'fr', 'de')).toBe('A-fr');
    // Missing in fr (empty) and in the de fallback (no bundle) → the en base.
    expect(getRegistry().translate('base-prefix.b', 'fr', 'de')).toBe('B');
  });

  it('a re-registration without a base keeps the stored base', () => {
    const registry = getRegistry();
    registry.registerPackage('base-kept', { de: { a: 'Basis' } }, 'de');
    registry.registerPackage('base-kept', { de: { a: 'Basis' } });
    expect(registry.translate('a', 'en', 'en', undefined, { packageName: 'base-kept' })).toBe(
      'Basis'
    );
  });

  it('keeps the order active → fallback → base', () => {
    const pkg = createPackageI18n(
      'base-de-order',
      {
        de: { onlyBase: 'Basis', inFallback: 'Basis', inActive: 'Basis' } as const,
        en: { onlyBase: '', inFallback: 'Fallback', inActive: 'Fallback' },
        fr: { onlyBase: '', inFallback: '', inActive: 'Actif' }
      },
      { base: 'de' }
    );
    pkg.register();
    const resolve = (key: string) =>
      getRegistry().translate(key, 'fr', 'en', undefined, { packageName: 'base-de-order' });
    expect(resolve('inActive')).toBe('Actif');
    expect(resolve('inFallback')).toBe('Fallback');
    expect(resolve('onlyBase')).toBe('Basis');
  });

  it('renders the de base under a provider whose locale and fallback are en (SSR)', () => {
    expect(render(BaseLocaleHarness, { props: { locale: 'en' } }).body).toContain('Speichern');
    expect(render(BaseLocaleHarness, { props: {} }).body).toContain('Speichern');
  });

  it('leaves en packages unchanged: provider-less t resolves en, a miss stays the raw key', () => {
    const en = createPackageI18n('base-en-default', { en: { a: 'A' } as const, de: { a: 'A-de' } });
    expect(en.t('a')).toBe('A');
    expect(en.exists('a')).toBe(true);
    const loose = en.t as unknown as (key: string) => string;
    expect(loose('missing')).toBe('missing');
  });

  it('throws on an unsupported base locale', () => {
    expect(() =>
      // @ts-expect-error deliberately unsupported locale
      createPackageI18n('base-bad', { xx: { a: 'A' } }, { base: 'xx' })
    ).toThrow(/unsupported base locale "xx"/);
  });
});
