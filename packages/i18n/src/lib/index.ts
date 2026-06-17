// --- Request-scoped i18n (WP2: SSR-correct, Context-based) ---

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
