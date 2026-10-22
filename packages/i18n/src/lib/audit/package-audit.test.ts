import { describe, expect, it, vi } from 'vitest';
import { createPackageI18n } from '#lib/i18n/package-integration.js';
import { getRegistry } from '#lib/i18n/registry.svelte.js';
import type { Translations } from '#lib/i18n/types.js';
import { auditPackage } from './package-audit';
import type { TranslationAuditReport } from './translations';

const findingsOf = (report: TranslationAuditReport) =>
  report.findings.map(({ code, locale, key }) => ({ code, locale, key }));

describe('auditPackage — audits a package against the base the package names', () => {
  it('reports the key a lazy en bundle lacks in a de-based package', async () => {
    const pkg = createPackageI18n(
      'audit-de-base',
      { de: { a: 'A', b: 'B' } as const },
      { base: 'de', loaders: { en: async () => ({ a: 'A' }) } }
    );
    const report = await auditPackage(pkg);
    expect(report.ok).toBe(false);
    expect(findingsOf(report)).toEqual([{ code: 'missing-key', locale: 'en', key: 'b' }]);

    // @ts-expect-error the base comes from the package; the options take no baseLocale
    const overridden = await auditPackage(pkg, { baseLocale: 'en' });
    expect(findingsOf(overridden)).toEqual(findingsOf(report));

    expect(findingsOf(await auditPackage(pkg, { ignoreKeys: ['b'] }))).toEqual([]);
    expect(getRegistry().hasPackage('audit-de-base')).toBe(false);
  });

  it('diffs against en when the package names no base', async () => {
    const pkg = createPackageI18n(
      'audit-en-base',
      { en: { a: 'A', b: 'B' } as const },
      { loaders: { de: async () => ({ a: 'A', z: 'Z' }) } }
    );
    expect(findingsOf(await auditPackage(pkg))).toEqual([
      { code: 'missing-key', locale: 'de', key: 'b' },
      { code: 'extra-key', locale: 'de', key: 'z' }
    ]);
  });

  it('audits the eager bundle of a locale that also has a loader, as the runtime serves it', async () => {
    const loader = vi.fn(async () => ({}));
    const pkg = createPackageI18n(
      'audit-eager-wins',
      { en: { a: 'A' } as const, de: { a: 'A-de' } },
      { loaders: { de: loader } }
    );
    expect((await auditPackage(pkg)).findings).toEqual([]);
    expect(loader).not.toHaveBeenCalled();
  });

  it('rejects when a loader rejects', async () => {
    const pkg = createPackageI18n(
      'audit-loader-rejects',
      { en: { a: 'A' } as const },
      { loaders: { de: () => Promise.reject(new Error('chunk failed')) } }
    );
    await expect(auditPackage(pkg)).rejects.toThrow('chunk failed');
  });

  it('rejects when a loader resolves no bundle, instead of skipping the locale', async () => {
    const pkg = createPackageI18n(
      'audit-loader-no-default',
      { en: { a: 'A' } as const },
      {
        loaders: {
          // A module without a default export, read as if it had one.
          de: () =>
            import('#lib/i18n/__fixtures__/de-package.js').then(
              (m) => (m as unknown as { default: Translations }).default
            )
        }
      }
    );
    await expect(auditPackage(pkg)).rejects.toThrow(
      '[i18n] auditPackage(audit-loader-no-default): the "de" loader\'s bundle must be a translations object, got undefined.'
    );
  });
});
