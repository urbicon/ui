import type { DeepKeys } from '$lib/utils/deep-keys';

/**
 * Single source of truth for the locales the library declares support for.
 *
 * "Declared, data optional": `en`/`de` ship translation data; `fr`/`es`/`it`/`nl`
 * are valid target locales a consumer can register its own bundles for. The list
 * lives here exactly once — both the `Locale` union and the runtime
 * `isLocaleSupported` guard derive from it, so the type and the runtime check can
 * never drift apart (previously the same six codes were hardcoded twice).
 */
export const SUPPORTED_LOCALES = ['en', 'de', 'fr', 'es', 'it', 'nl'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Runtime guard derived from {@link SUPPORTED_LOCALES} — the single source of
 * truth. Used by both the registry and the request-scoped locale state, so the
 * type and the runtime check can never drift apart.
 */
export function isLocaleSupported(locale: string): locale is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

// Type for nested translation objects
export type Translations = {
  [key: string]: string | Translations;
};

export type PackageTranslations = Partial<Record<Locale, Translations>>;

/**
 * Base translation function signature
 */
export type TranslationFunction = (key: string, params?: Record<string, unknown>) => string;

/**
 * Translation store interface
 */
export interface TranslationStore {
  locale: Locale;
  translations: PackageTranslations;
  t: TranslationFunction;
}

// Enhanced parameter types with template string extraction
export type TranslationParams = Record<string, string | number | boolean | (() => string)>;

// Extract parameters from template strings like "Hello {{name}}, you have {{count}} messages"
type ExtractParams<T extends string> = T extends `${string}{{${infer Param}}}${infer Rest}`
  ? Param | ExtractParams<Rest>
  : never;

// Smart parameter inference for specific translation keys
export type TranslationParametersFor<T extends Translations, K extends DeepKeys<T>> =
  PathValue<T, K> extends string
    ? ExtractParams<PathValue<T, K>> extends never
      ? Record<string, never> // No parameters needed
      : Record<ExtractParams<PathValue<T, K>>, string | number | boolean>
    : TranslationParams;

// Enhanced translation function with typed keys and parameters
export type TypedTranslationFunction<T extends Translations> = <K extends DeepKeys<T>>(
  key: K,
  ...args: TranslationParametersFor<T, K> extends Record<string, never>
    ? [params?: TranslationParams, options?: TranslationOptions]
    : [params: TranslationParametersFor<T, K>, options?: TranslationOptions]
) => string;

// I18n store interface
export interface I18nStore {
  locale: Locale;
  translations: Partial<Record<Locale, Translations>>;
  fallbackLocale: Locale;
  packageTranslations: Map<string, Partial<Record<Locale, Translations>>>;
  loadedLocales: Set<Locale>;
  loadingLocales: Set<Locale>;
}

// I18n configuration
export interface I18nConfig {
  defaultLocale?: Locale;
  fallbackLocale?: Locale;
  translations?: Partial<Record<Locale, Translations>>;
  detectBrowserLocale?: boolean;
  lazyLoad?: boolean;
  /**
   * Optional error handler. Invoked when a registered loader rejects
   * (loadLocale failure) or when an unsupported locale is requested
   * (setLocale failure). When omitted, the service falls back to
   * `console.warn` so consumers still see something during development.
   */
  onError?: (error: I18nError) => void;
}

// Errors surfaced through I18nConfig.onError.
export type I18nError =
  | { type: 'load-failed'; locale: Locale; cause: unknown }
  | { type: 'unsupported-locale'; locale: string }
  | { type: 'load-failed-no-fallback'; locale: Locale };

/**
 * Surfaced through {@link I18nConfigureOptions.onMissingKey} when `translate`
 * resolves a key *nowhere* — neither the active nor the fallback locale, in any
 * package or the global bundle — and falls back to returning the key string
 * itself. The loud signal for "this will render as its raw key in production".
 */
export interface I18nMissingKey {
  /** The unresolved key, exactly as passed to `t` / `translate`. */
  key: string;
  /** Active locale at the time of the miss. */
  locale: Locale;
  /** Fallback locale that was also tried and also missed. */
  fallbackLocale: Locale;
  /** Package scope, when the call was package-scoped (`useTranslate` / `packageName`). */
  packageName?: string;
  /** Always `no-translation` today; a discriminant reserved for future miss reasons. */
  reason: 'no-translation';
}

// Utility type: widen all string literal values to string, deeply
type WidenStringLiteralsDeep<T> = T extends string
  ? string
  : T extends Array<infer U>
    ? Array<WidenStringLiteralsDeep<U>>
    : T extends object
      ? { [K in keyof T]: WidenStringLiteralsDeep<T[K]> }
      : T;

// Schema type to validate translation shape while allowing locale-specific strings
export type TranslationSchema<T extends Translations> = WidenStringLiteralsDeep<T>;

// Translation options
export interface TranslationOptions {
  packageName?: string;
  fallbackToGlobal?: boolean;
  interpolate?: boolean;
  /**
   * @internal Whether an unresolved key reports through `onMissingKey`. Defaults
   * to `true`. Set `false` for internal probes that expect a miss — the
   * `pluralize` lookup of an *optional* `<key>_plural` object, which legitimately
   * resolves nowhere and must not masquerade as a missing translation.
   */
  reportMissing?: boolean;
}

// Translation loader types for dynamic imports
export type TranslationLoader = (locale: Locale) => Promise<Translations>;

export type PackageTranslationLoader = (
  packageName: string,
  locale: Locale
) => Promise<Translations>;

// Advanced type for nested translation access
type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

// Pluralization support
export interface PluralRules {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export interface PluralParams extends TranslationParams {
  count: number;
}

// Template string validation
export type ValidateTemplate<T extends string> = T extends `${string}{{${string}}}${string}`
  ? T
  : never;

// Export type utilities for package authors
export type CreatePackageTypes<T extends Translations> = {
  keys: DeepKeys<T>;
  params: {
    [K in DeepKeys<T>]: PathValue<T, K> extends string
      ? ExtractParams<PathValue<T, K>> extends never
        ? Record<string, never>
        : Record<ExtractParams<PathValue<T, K>>, string | number | boolean>
      : Record<string, never>;
  };
};

// Package integration types
export interface PackageI18n<T extends Translations> {
  /**
   * Context-scoped translation **hook**. Call during component initialisation to
   * get a typed `t` bound to the nearest `<I18nProvider>`'s locale (or the base
   * locale when none is mounted). This is the SSR-correct, reactive accessor —
   * re-exported by consumers as `use<Package>I18n`.
   */
  useTranslate: () => TypedTranslationFunction<T>;
  /**
   * Typed `t` for non-component use (tests, server-side utilities) where no
   * component context is available. Not bound to a `<I18nProvider>`. In
   * components always prefer {@link useTranslate}, which is provider-scoped and
   * reactive.
   */
  t: TypedTranslationFunction<T>;
  exists: (key: string) => boolean;
  getLocales: () => Locale[];
  register: () => void;
  /**
   * Eagerly and **additively** register one locale's already-imported bundle for
   * this package — the SSR escape hatch for a locale declared as a lazy
   * `options.loaders` entry. Call once at server/app start (with e.g.
   * `import de from '@urbicon-ui/blocks/i18n/de'`) so the first server render
   * already resolves that locale instead of rendering the fallback until the
   * client-only on-mount chunk load lands. Merges — it does not drop the eager
   * base bundle. Throws on an unsupported locale or a non-object bundle.
   */
  registerLocale: (locale: Locale, bundle: Translations) => void;
  types: CreatePackageTypes<T>;
}

// Component props for I18n integration
export interface I18nComponentProps {
  locale?: Locale;
  fallbackToGlobal?: boolean;
  useI18n?: boolean;
}
