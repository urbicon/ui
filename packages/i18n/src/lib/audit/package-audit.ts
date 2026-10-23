import {
  assertTranslations,
  type Locale,
  type PackageSource,
  type PackageTranslations
} from '#lib/i18n/types.js';
import {
  type AuditTranslationsOptions,
  auditTranslations,
  type TranslationAuditReport
} from './translations';

/**
 * Audits a `createPackageI18n` package with {@link auditTranslations}: its eager
 * bundles, plus the bundle of every `options.loaders` locale that has no eager
 * one, each diffed against the package's base locale under the package's name —
 * all read from `pkg.source`, so the options take no `baseLocale`. Rejects when
 * a loader rejects or resolves no translations object. Registers nothing.
 *
 * ```ts
 * import { auditPackage } from '@urbicon-ui/i18n/audit';
 * import { shopI18n } from '#lib/i18n.js';
 *
 * it('translations pass the audit', async () => {
 *   expect((await auditPackage(shopI18n)).findings).toEqual([]);
 * });
 * ```
 */
export async function auditPackage(
  pkg: { readonly source: PackageSource },
  options?: Omit<AuditTranslationsOptions, 'baseLocale'>
): Promise<TranslationAuditReport> {
  const { name, base, translations, loaders } = pkg.source;
  const bundles: PackageTranslations = { ...translations };
  await Promise.all(
    Object.entries(loaders).map(async ([locale, loader]) => {
      // The runtime never calls the loader of a locale that has an eager bundle
      // (`registry.loadPackageLocale`), so that bundle is the one audited.
      if (!loader || translations[locale as Locale]) return;
      const bundle = await loader();
      // A loader whose module lacks the export resolves `undefined`, which the
      // audit would skip as an absent locale and report nothing for.
      assertTranslations(bundle, `auditPackage(${name}): the "${locale}" loader's bundle`);
      bundles[locale as Locale] = bundle;
    })
  );
  return auditTranslations(name, bundles, { ...options, baseLocale: base });
}
