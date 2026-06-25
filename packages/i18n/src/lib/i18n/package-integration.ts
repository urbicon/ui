import { collectDeepKeys } from '$lib/utils/deep-keys';
import { BASE_LOCALE, useI18nState } from './context.svelte';
import { getRegistry } from './registry.svelte';
import type {
  CreatePackageTypes,
  Locale,
  PackageI18n,
  PackageTranslations,
  TranslationOptions,
  TranslationParams,
  TranslationSchema,
  Translations,
  TypedTranslationFunction
} from './types';

/**
 * Loose translation call (key as plain string + optional params/options).
 * `TypedTranslationFunction<Translations>` enforces exact key unions; inside
 * generic helpers we accept any string key and delegate fallback behaviour
 * to the global i18n runtime.
 */
type LooseTranslate = (
  key: string,
  params?: TranslationParams,
  options?: TranslationOptions
) => string;

export interface CreatePackageI18nOptions {
  /**
   * Per-locale lazy loaders (WP4 code-splitting). Each returns the package's
   * bundle for that locale as a dynamic-import chunk, e.g.
   * `() => import('./translations/de').then((m) => m.default)`. Listed locales
   * stay out of the initial bundle until activated by the provider / `setLocale`;
   * the eager bundle passed in `translations` (typically `en`) is the base/
   * fallback. Compile-time key parity is NOT checked for lazy locales — pair with
   * `validatePackageTranslations` in a test to guard parity at runtime/CI.
   */
  loaders?: Partial<Record<Locale, () => Promise<Translations>>>;
}

/**
 * Creates a standardized i18n integration for a package.
 *
 * Generic over the `en` bundle: with `<const T>` the literal key/param types of
 * `en` flow through `PackageI18n<T>` into a fully typed `t` — real `DeepKeys<T>`
 * plus `ExtractParams`, so `t('dialog.close')` autocompletes and
 * `t('dialog.nope')` is a compile error. Other locales are checked against
 * `TranslationSchema<T>` (T's structure with its string values widened), which
 * enforces key parity at compile time while allowing locale-specific strings.
 *
 * Opt-in code-splitting (WP4): pass `options.loaders` to keep non-base locales
 * out of the initial bundle as dynamic-import chunks, loaded only when activated.
 */
export function createPackageI18n<const T extends Translations>(
  packageName: string,
  translations: { en: T } & Partial<Record<Locale, TranslationSchema<T>>>,
  options?: CreatePackageI18nOptions
): PackageI18n<T> {
  // Lazy, first-use registration — deliberately NOT at module-eval (Codeberg #22).
  // A consumer's top-level `export const x = createPackageI18n(...)` must not call
  // getRegistry() during module initialisation: in a reordered *production* chunk
  // (Rollup, `sideEffects: false`) that call can run before the registry module's
  // `class I18nRegistry` statement, hitting the class temporal dead zone →
  // `new (undefined)()` → "is not a constructor" → blank page on hydration. The
  // hoisted getRegistry() keeps the *getter* reachable, but the *class* it
  // constructs is still a TDZ binding, so the hoist guard alone was insufficient.
  //
  // Deferring registration to the first useTranslate()/t()/exists() call removes
  // the ordering dependency at the source: by render / first-call time every module
  // is fully evaluated, so `new I18nRegistry()` is always safe. Registration is
  // synchronous (it runs before the translate read), so the first call resolves the
  // real string — unlike the old queueMicrotask variant that returned the raw key.
  // registerPackage mutates the reactive SvelteMap, but first touch is a component
  // init (`useTranslate` body) or a non-reactive call (`t`/tests), never inside a
  // `$derived`, so it cannot trip `state_unsafe_mutation`.
  let registered = false;
  const ensureRegistered = (): void => {
    if (registered) return;
    registered = true;
    const registry = getRegistry();
    registry.registerPackage(packageName, translations as PackageTranslations);
    // Opt-in lazy locales (WP4): dynamic-import loaders alongside the eager base
    // bundle, loaded on demand by the provider / setLocale.
    if (options?.loaders) {
      for (const [locale, loader] of Object.entries(options.loaders)) {
        if (loader) registry.registerPackageLoader(packageName, locale as Locale, loader);
      }
    }
  };

  // Context-scoped hook — the SSR-correct, reactive accessor. Captures the
  // request-scoped locale state at component init (or `undefined` without a
  // provider → base locale), then resolves against the static registry. Reading
  // `state.locale` inside the returned closure (called from a `$derived`) makes
  // call-sites re-render on locale change; reading the registry's SvelteMap makes
  // them re-render when a package registers more translations.
  const useTranslate = (): TypedTranslationFunction<T> => {
    ensureRegistered();
    const state = useI18nState();
    const registry = getRegistry();
    return ((key: string, params?: TranslationParams, options?: TranslationOptions) =>
      registry.translate(
        key,
        state?.locale ?? BASE_LOCALE,
        state?.fallbackLocale ?? BASE_LOCALE,
        params,
        { packageName, ...options }
      )) as TypedTranslationFunction<T>;
  };

  // Non-hook `t` for non-component use (tests, server utilities). Resolves
  // against the base locale — there is no request-scoped state outside a
  // component. Components use `useTranslate` for the reactive, provider-scoped
  // locale.
  const t = ((key: string, params?: TranslationParams, options?: TranslationOptions) => {
    ensureRegistered();
    return getRegistry().translate(key, BASE_LOCALE, BASE_LOCALE, params, {
      packageName,
      ...options
    });
  }) as TypedTranslationFunction<T>;

  const exists = (key: string): boolean => {
    ensureRegistered();
    return getRegistry().exists(key, BASE_LOCALE, packageName);
  };

  const getLocales = (): Locale[] => {
    ensureRegistered();
    return getRegistry().getPackageLocales(packageName);
  };

  // Eager-register escape hatch: a consumer that wants the package present before
  // the first useTranslate()/t() (e.g. to preload a lazy locale) can call this.
  // Previously a no-op; now it performs the idempotent first-use registration.
  const register = (): void => ensureRegistered();

  return {
    useTranslate,
    t,
    exists,
    getLocales,
    register,
    types: {} as CreatePackageTypes<T>
  };
}

/**
 * Creates a package-translations descriptor (data only — does NOT register).
 *
 * @deprecated Superseded by {@link createPackageI18n}, which registers and
 * returns a typed `t` in one step. Retained for back-compat; the `types` field
 * is a non-functional placeholder (`CreatePackageTypes<Translations>` degenerates
 * to `string` keys, predating the generic factory).
 */
export function createPackageTranslations(
  packageName: string,
  translations: Partial<Record<Locale, Translations>>
) {
  return {
    packageName,
    translations,
    types: {} as CreatePackageTypes<Translations>
  };
}

/**
 * Creates a typed translation package with auto-registration.
 *
 * @deprecated Use {@link createPackageI18n} directly. Since that factory became
 * generic (`<const T>`) it already infers literal keys and returns a fully typed
 * `t`; this wrapper adds only a redundant `tt` alias and a `packageName`/
 * `translations` passthrough. Kept as a thin, typed shim for back-compat — it
 * will be removed in a future major.
 */
export function createTypedPackage<const T extends Translations>(
  packageName: string,
  translations: { en: T } & Partial<Record<Locale, TranslationSchema<T>>>
) {
  const packageI18n = createPackageI18n(packageName, translations);

  return {
    ...packageI18n,
    packageName,
    translations,
    // Convenient alias
    tt: packageI18n.t
  };
}

/**
 * Register translation loaders for lazy loading
 * Useful for larger packages with many translations
 */
export function registerTranslationLoaders(loaders: Record<Locale, () => Promise<Translations>>) {
  Object.entries(loaders).forEach(([locale, loader]) => {
    getRegistry().registerTranslationLoader(locale as Locale, loader);
  });
}

/**
 * Smart component integration helper
 * Provides common patterns for component i18n integration
 */
export function createComponentI18n<const T extends Translations>(
  packageName: string,
  translations: { en: T } & Partial<Record<Locale, TranslationSchema<T>>>,
  defaultOptions?: {
    useI18n?: boolean;
    fallbackToGlobal?: boolean;
  }
) {
  const packageI18n = createPackageI18n(packageName, translations);

  return {
    ...packageI18n,

    // Smart text resolution for components
    getText: (
      key: string,
      customText?: string,
      params?: TranslationParams,
      options?: { useI18n?: boolean }
    ): string => {
      // If custom text provided and i18n disabled, use custom text
      if (customText && options?.useI18n === false) {
        return customText;
      }

      const loose = packageI18n.t as unknown as LooseTranslate;
      return loose(key, params, {
        fallbackToGlobal: defaultOptions?.fallbackToGlobal ?? true
      });
    },

    // Conditional translation (useful for optional i18n)
    maybeT: (
      key: string,
      params?: TranslationParams,
      options?: { useI18n?: boolean; fallback?: string }
    ): string => {
      if (options?.useI18n === false) {
        return options.fallback || key;
      }

      const loose = packageI18n.t as unknown as LooseTranslate;
      return loose(key, params);
    }
  };
}

/**
 * Batch register multiple packages
 * Useful for apps that use many packages
 */
export function registerPackages(
  packages: Array<{
    name: string;
    translations: PackageTranslations;
  }>
) {
  packages.forEach(({ name, translations }) => {
    getRegistry().registerPackage(name, translations);
  });
}

/**
 * Validates deep-key parity across a package's locale bundles.
 *
 * Compares the full recursive leaf-key set (not just top-level keys) of every
 * locale against the base locale (`en` first by convention). A missing nested
 * key is an error; an extra nested key is a warning. Pair with a per-package
 * vitest assertion (`expect(errors).toEqual([])`) to fail CI on drift —
 * complementing the compile-time parity `satisfies`/generic factory enforce for
 * statically-typed bundles, and covering dynamically/lazily loaded ones.
 */
// Non-generic on purpose: this is a runtime structural check. A generic
// `<T>(…: Partial<Record<Locale, T>>)` would bind every locale to the SAME `T`
// inferred from `en`, so a `de` bundle with different string literals (the
// normal case under `as const`) fails to assign. `Translations` widens the
// values, decoupling the locales — parity is verified at runtime via keys.
export function validatePackageTranslations(
  packageName: string,
  translations: Partial<Record<Locale, Translations>>
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const locales = Object.keys(translations) as Locale[];
  if (locales.length === 0) {
    errors.push(`[${packageName}] No translations provided`);
    return { isValid: false, errors, warnings };
  }

  // Prefer `en` as the base: the error (missing) vs warning (extra) asymmetry
  // is only meaningful against the canonical source locale, not whichever key
  // Object.keys happens to return first.
  const baseLocale = locales.includes('en') ? 'en' : locales[0];
  const baseBundle = translations[baseLocale];
  if (!baseBundle) {
    errors.push(`[${packageName}] Base locale ${baseLocale} has no translations`);
    return { isValid: false, errors, warnings };
  }

  const baseKeys = collectDeepKeys(baseBundle);
  const baseKeySet = new Set(baseKeys);

  locales.slice(1).forEach((locale) => {
    const bundle = translations[locale];
    if (!bundle) return;
    const localeKeySet = new Set(collectDeepKeys(bundle));

    const missingKeys = baseKeys.filter((key) => !localeKeySet.has(key));
    const extraKeys = [...localeKeySet].filter((key) => !baseKeySet.has(key));

    if (missingKeys.length > 0) {
      errors.push(`[${packageName}] Locale ${locale} missing keys: ${missingKeys.join(', ')}`);
    }
    if (extraKeys.length > 0) {
      warnings.push(`[${packageName}] Locale ${locale} has extra keys: ${extraKeys.join(', ')}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
