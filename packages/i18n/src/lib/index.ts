// Public surface of @urbicon-ui/i18n — request-scoped runtime (SSR-correct,
// context-based), package integration, and the data-level audit utilities.
// (Export order is Biome-sorted by module path; see the per-group comments.)

export type {
  MissingKeyCollector,
  MissingKeyRecord
} from '$lib/audit/missing-key-collector';
// Runtime missing-key sink: wire `createMissingKeyCollector().onMissingKey` into
// configureI18n to assert "no raw-key renders" across a test/E2E run.
export { createMissingKeyCollector } from '$lib/audit/missing-key-collector';
export type {
  AuditTranslationsOptions,
  TranslationAuditReport,
  TranslationFinding,
  TranslationFindingCode,
  TranslationFindingSeverity
} from '$lib/audit/translations';
// Translation audit (data-level parity & quality). Pure, dependency-free — run in
// a vitest test (`expect(auditTranslations(bundles).ok).toBe(true)`) or via the
// `urbicon i18n parity` CLI. The richer successor to validatePackageTranslations.
export { auditTranslations } from '$lib/audit/translations';
// Provider + general hook: mount one <I18nProvider> at the app root, read locale
// control and locale-aware formatting via useI18n() inside components.
export { I18nProvider, T } from '$lib/components';
export type { I18nApi, I18nConfigureOptions } from '$lib/i18n/context.svelte';
export { BASE_LOCALE, configureI18n, provideI18n, useI18n } from '$lib/i18n/context.svelte';
export type { CreatePackageI18nOptions } from '$lib/i18n/package-integration';
// Package integration utilities
export {
  createComponentI18n,
  createPackageI18n,
  createPackageTranslations,
  createTypedPackage,
  registerPackages,
  registerTranslationLoaders,
  validatePackageTranslations
} from '$lib/i18n/package-integration';
// The `explicit prop → provider → base locale` chain a component resolves an
// `Intl` tag through. Distinct from `resolveLocale` below: this one answers
// "what do I format with", not "what locale is this request in".
export { resolveDateLocale } from '$lib/i18n/resolve-date-locale';
export type { LocaleSource, ResolveLocaleOptions } from '$lib/i18n/resolve-locale';
// Server-side initial-locale resolution (cookie + Accept-Language) for the
// provider's `locale` prop. SSR/hydration-stable.
export { resolveLocale } from '$lib/i18n/resolve-locale';
// Types
export type {
  CreatePackageTypes,
  I18nComponentProps,
  I18nConfig,
  I18nError,
  I18nMissingKey,
  I18nStore,
  Locale,
  PackageI18n,
  PackageTranslations,
  PluralParams,
  PluralRules,
  TranslationFunction,
  TranslationLoader,
  TranslationOptions,
  TranslationParams,
  Translations,
  TypedTranslationFunction
} from '$lib/i18n/types';
// Supported-locale list + runtime guard — single source of truth; `Locale` derives from it.
export { isLocaleSupported, SUPPORTED_LOCALES } from '$lib/i18n/types';

// Utility types and functions
export type { DeepKeys, DeepValue } from '$lib/utils/deep-keys';
export { collectDeepKeys, getDeepValue, hasDeepKey } from '$lib/utils/deep-keys';
