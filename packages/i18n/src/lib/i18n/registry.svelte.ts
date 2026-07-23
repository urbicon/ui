import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { getDeepValue } from '$lib/utils/deep-keys';
import type {
  I18nError,
  I18nMissingKey,
  Locale,
  PackageTranslations,
  PluralParams,
  PluralRules,
  TranslationLoader,
  TranslationOptions,
  TranslationParams,
  Translations
} from './types';
import { isLocaleSupported } from './types';

/**
 * Module-global translation **registry** — the static, request-identical half of
 * the old `I18nService`.
 *
 * It holds only read-only translation *data* (package bundles, the global
 * mirror, loaded/loading status) and stateless resolution logic. Every resolver
 * takes the active `locale`/`fallbackLocale` as **explicit arguments** instead of
 * reading a stored value, so a single module-global instance is safe to share
 * across SSR requests: there is no mutable per-request state here. The mutable
 * locale lives in the request-scoped {@link I18nState} context instead.
 *
 * The data fields stay reactive (`SvelteMap`/`SvelteSet`/`$state`) so that a
 * package registering or a locale chunk loading *after* first render still
 * invalidates the `$derived` expressions that read them — but those mutations are
 * idempotent and identical for every request, so they cannot leak request state.
 */
export class I18nRegistry {
  // SvelteMap/SvelteSet are reactive-wrapped so mutations (add/delete) trigger
  // downstream $derived recomputation. Plain Map/Set inside $state are
  // shallow-reactive only.
  private packageTranslations = new SvelteMap<string, Partial<Record<Locale, Translations>>>();
  private translations = $state<Partial<Record<Locale, Translations>>>({});
  private loadedLocales = new SvelteSet<Locale>();
  private loadingLocales = new SvelteSet<Locale>();

  // Non-reactive per-instance cache; SvelteMap is unnecessary here.
  private translationLoaders = new Map<Locale, TranslationLoader>();

  // Per-package lazy loaders (WP4 code-splitting), keyed `${packageName}::${locale}`.
  // Registered at module-eval, read in setLocale/loadLocale (not in a $derived), so
  // a plain Map suffices. The *loaded data* lands in the reactive packageTranslations,
  // which is what re-resolves `$derived` reads when a chunk arrives.
  private packageLoaders = new Map<string, () => Promise<Translations>>();
  // Reactive: `isLoading` derives from its size.
  private loadingPackageLocales = new SvelteSet<string>();

  // Per-locale Intl caches. Constructing an Intl.* object negotiates the locale
  // on every `new`; caching by locale avoids that cost when plural()/formatNumber
  // run inside a large {#each}. Keyed by locale only (options-bearing calls skip
  // the cache — they are rare and varied).
  private pluralRulesCache = new Map<Locale, Intl.PluralRules>();
  private numberFormatCache = new Map<Locale, Intl.NumberFormat>();

  /**
   * Optional error sink. Set once by the app (e.g. via the provider) so loader
   * failures surface somewhere; defaults to `console.warn`.
   */
  onError?: (error: I18nError) => void;

  /**
   * Optional missing-key sink. Set once by the app via `configureI18n`. Unlike
   * `onError` there is NO default `console.warn`: a provider-less, read-tolerant
   * render legitimately misses keys, so warning on every miss would be noise.
   * Opt-in only — the loud signal for "this key resolved nowhere" when a consumer
   * wants it (dev overlay, telemetry, a test collector). Fires exactly once per
   * resolved-nowhere `translate` call, just before the key-as-itself fallback.
   */
  onMissingKey?: (info: I18nMissingKey) => void;

  get registeredPackages(): string[] {
    return Array.from(this.packageTranslations.keys());
  }

  get isLoading(): boolean {
    return this.loadingLocales.size > 0 || this.loadingPackageLocales.size > 0;
  }

  private reportError(error: I18nError): void {
    if (this.onError) {
      this.onError(error);
      return;
    }
    switch (error.type) {
      case 'load-failed':
        console.warn(`Failed to load translations for locale: ${error.locale}`, error.cause);
        break;
      case 'unsupported-locale':
        console.warn(`Locale ${error.locale} is not supported`);
        break;
      case 'load-failed-no-fallback':
        console.warn(`Failed to load locale ${error.locale}, falling back to current locale`);
        break;
    }
  }

  private reportMissingKey(
    key: string,
    locale: Locale,
    fallbackLocale: Locale,
    packageName?: string
  ): void {
    if (!this.onMissingKey) return;
    try {
      this.onMissingKey({ key, locale, fallbackLocale, packageName, reason: 'no-translation' });
    } catch (error) {
      // The miss sink is observability, never load-bearing: a throwing consumer
      // handler must not break rendering or skip the read-tolerant key-as-itself
      // fallback. Mirrors interpolate()'s defensive treatment of consumer callbacks.
      console.warn(`onMissingKey handler threw for key "${key}"`, error);
    }
  }

  // --- registration / loading (static data; idempotent, request-identical) ---

  registerPackage(packageName: string, translations: PackageTranslations): void {
    this.packageTranslations.set(packageName, translations);

    Object.entries(translations).forEach(([locale, trans]) => {
      this.addTranslations(locale as Locale, { [packageName]: trans });
    });
  }

  registerTranslationLoader(locale: Locale, loader: TranslationLoader): void {
    this.translationLoaders.set(locale, loader);
  }

  /**
   * Register a per-package lazy loader for one locale (WP4 code-splitting). The
   * loader returns that package's bundle for `locale` (typically
   * `() => import('./translations/de').then((m) => m.default)`), kept out of the
   * initial chunk until the locale is activated.
   */
  registerPackageLoader(
    packageName: string,
    locale: Locale,
    loader: () => Promise<Translations>
  ): void {
    this.packageLoaders.set(`${packageName}::${locale}`, loader);
  }

  /**
   * Additively register one locale's already-loaded bundle for a package — the
   * synchronous, eager counterpart to {@link loadPackageLocale}.
   *
   * Unlike {@link registerPackage} (which `.set`s the *whole* package entry and so
   * drops any sibling locale already registered), this **merges** the single
   * locale into the existing entry, preserving the eager base bundle. That makes
   * it the correct primitive for an eager-register escape hatch: a consumer that
   * has passed a locale as a lazy `loader` can register its imported bundle up
   * front (e.g. once at SSR/app start) so the very first server render already
   * resolves that locale — no fallback-locale flash, no hydration text mismatch —
   * instead of waiting for the provider's client-only on-mount chunk load.
   *
   * A fresh object reference is written so the reactive SvelteMap notifies
   * `$derived` readers (an in-place mutation would not). Idempotent-friendly:
   * re-registering the same locale simply overwrites it with identical data.
   */
  registerPackageLocale(packageName: string, locale: Locale, data: Translations): void {
    const existing = this.packageTranslations.get(packageName) ?? {};
    this.packageTranslations.set(packageName, { ...existing, [locale]: data });
    this.addTranslations(locale, { [packageName]: data });
  }

  hasLoader(locale: Locale): boolean {
    if (this.translationLoaders.has(locale)) return true;
    for (const key of this.packageLoaders.keys()) {
      if (this.loaderKeyLocale(key) === locale) return true;
    }
    return false;
  }

  // Reflects only *global* loader loads (registerTranslationLoader), not
  // per-package lazy loads — a purely-lazy-package locale stays `false` here. The
  // setLocale gate pairs it with hasLoader() and relies on load*Locale being
  // idempotent, so the narrowed meaning is safe there; don't reuse it as a general
  // "is this locale's data present" check (use packageTranslations/getPackageLocales).
  isLoaded(locale: Locale): boolean {
    return this.loadedLocales.has(locale);
  }

  private loaderKeyLocale(key: string): string {
    return key.slice(key.lastIndexOf('::') + 2);
  }

  addTranslations(locale: Locale, translations: Translations): void {
    if (!this.translations[locale]) {
      this.translations[locale] = {};
    }
    this.translations[locale] = this.deepMerge(this.translations[locale], translations);
  }

  /**
   * Load every lazy bundle registered for `locale` — the legacy global loader and
   * all per-package loaders — merging each into the (reactive) registry so that
   * `$derived` reads re-resolve once the chunks arrive. Idempotent: bundles
   * already present (eager or previously loaded) are skipped. Returns `false` if
   * any triggered load rejected.
   */
  async loadLocale(locale: Locale): Promise<boolean> {
    const tasks: Promise<boolean>[] = [this.loadGlobalLocale(locale)];
    for (const key of this.packageLoaders.keys()) {
      if (this.loaderKeyLocale(key) === locale) {
        tasks.push(this.loadPackageLocale(key.slice(0, key.lastIndexOf('::')), locale));
      }
    }
    const results = await Promise.all(tasks);
    return results.every(Boolean);
  }

  // Legacy global-loader path. Returns true when there is nothing to do (no
  // global loader / already loaded) — "no loader" is not a failure.
  private async loadGlobalLocale(locale: Locale): Promise<boolean> {
    const loader = this.translationLoaders.get(locale);
    if (!loader || this.loadedLocales.has(locale) || this.loadingLocales.has(locale)) {
      return true;
    }
    this.loadingLocales.add(locale);
    try {
      const translations = await loader(locale);
      this.addTranslations(locale, translations);
      this.loadedLocales.add(locale);
      return true;
    } catch (error) {
      this.reportError({ type: 'load-failed', locale, cause: error });
      return false;
    } finally {
      this.loadingLocales.delete(locale);
    }
  }

  /**
   * Load one package's bundle for `locale` via its registered loader and merge it
   * into the package map (so the package-scoped hook lookup finds it) and the
   * global mirror. Idempotent; no-op when the bundle is already present or no
   * loader is registered.
   */
  async loadPackageLocale(packageName: string, locale: Locale): Promise<boolean> {
    if (this.packageTranslations.get(packageName)?.[locale]) return true;
    const key = `${packageName}::${locale}`;
    const loader = this.packageLoaders.get(key);
    if (!loader || this.loadingPackageLocales.has(key)) return true;
    this.loadingPackageLocales.add(key);
    try {
      const data = await loader();
      // Delegate the additive merge to registerPackageLocale (same primitive the
      // eager escape hatch uses). It reads `existing` fresh — here, AFTER the
      // await — so two concurrent loads of different non-base locales for the same
      // package (e.g. de + fr) each see the other's already-merged result and don't
      // lose a write, and it writes a new object reference so the SvelteMap
      // notifies its `$derived` subscribers.
      this.registerPackageLocale(packageName, locale, data);
      return true;
    } catch (error) {
      this.reportError({ type: 'load-failed', locale, cause: error });
      return false;
    } finally {
      this.loadingPackageLocales.delete(key);
    }
  }

  /**
   * Whether `locale` has any resolvable data (eager or already lazily loaded).
   * Used by the request-scoped state to decide if switching to it is safe even
   * when its loader rejected.
   */
  hasTranslations(locale: Locale): boolean {
    return (
      !!this.translations[locale] ||
      Array.from(this.packageTranslations.values()).some((pkg) => !!pkg[locale])
    );
  }

  // --- resolution (locale threaded explicitly — no stored locale) ---

  translate(
    key: string,
    locale: Locale,
    fallbackLocale: Locale,
    params?: TranslationParams,
    options?: TranslationOptions | string
  ): string {
    const opts: TranslationOptions =
      typeof options === 'string'
        ? { packageName: options, fallbackToGlobal: true, interpolate: true }
        : { fallbackToGlobal: true, interpolate: true, ...options };

    let translation: string | undefined;

    if (!opts.packageName && key.includes('.')) {
      const potentialPackage = key.split('.')[0];
      if (this.packageTranslations.has(potentialPackage)) {
        const packageKey = key.substring(potentialPackage.length + 1);
        translation = this.getPackageTranslation(potentialPackage, packageKey, locale);
        if (translation) {
          return opts.interpolate ? this.interpolate(translation, locale, params) : translation;
        }
      }
    }

    if (opts.packageName) {
      translation = this.getPackageTranslation(opts.packageName, key, locale);
      if (translation) {
        return opts.interpolate ? this.interpolate(translation, locale, params) : translation;
      }

      translation = this.getPackageTranslation(opts.packageName, key, fallbackLocale);
      if (translation) {
        return opts.interpolate ? this.interpolate(translation, locale, params) : translation;
      }
    }

    if (opts.fallbackToGlobal !== false) {
      translation = this.getTranslation(key, locale) || this.getTranslation(key, fallbackLocale);
    }

    if (!translation) {
      // Resolved nowhere — package, fallback, and global all missed. Surface the
      // loud signal (opt-in) before the read-tolerant key-as-itself fallback.
      // `reportMissing: false` callers (the optional `_plural` probe) opt out.
      if (opts.reportMissing !== false) {
        this.reportMissingKey(key, locale, fallbackLocale, opts.packageName);
      }
      translation = key;
    }

    return opts.interpolate ? this.interpolate(translation, locale, params) : translation;
  }

  pluralize(
    key: string,
    params: PluralParams,
    locale: Locale,
    fallbackLocale: Locale,
    options?: TranslationOptions
  ): string {
    const count = params.count;

    const pluralKey = `${key}_plural`;
    // `reportMissing: false`: a `<key>_plural` object is optional, so this probe
    // legitimately resolves nowhere for keys without CLDR forms — it must not fire
    // onMissingKey. A miss on the base `key` below still reports (it's a real one).
    const pluralTranslation = this.translate(pluralKey, locale, fallbackLocale, undefined, {
      ...options,
      interpolate: false,
      reportMissing: false
    });

    if (pluralTranslation !== pluralKey) {
      try {
        const rules: PluralRules = JSON.parse(pluralTranslation);
        const rule = this.getPluralRule(count, locale);
        // `??`, not `||`: an intentional empty-string entry must survive. A
        // well-formed object always provides `other`; JSON.parse does not enforce
        // that, so if the parsed object lacks it (or holds a non-string), treat it
        // as malformed and fall through to the base form via catch — never
        // interpolate `undefined` (which would throw inside String.replace).
        const selectedTranslation = rules[rule] ?? rules.other;
        if (typeof selectedTranslation !== 'string') {
          throw new Error(`_plural object for "${key}" lacks a string "other" entry`);
        }
        return this.interpolate(selectedTranslation, locale, params);
      } catch {
        // Malformed `_plural` JSON: fall through to the base form below rather
        // than guess. fail-honest, not fail-wrong.
      }
    }

    // No CLDR `_plural` object for this key. Return the base translation as-is
    // (deterministically the singular/`other` form the author wrote) instead of
    // the old anglocentric `+'s'` heuristic, which produced wrong strings for
    // every non-English locale. Correct pluralization requires a `<key>_plural`
    // entry; see PluralRules.
    const singularTranslation = this.translate(key, locale, fallbackLocale, undefined, {
      ...options,
      interpolate: false
    });
    return this.interpolate(singularTranslation, locale, params);
  }

  // CLDR plural category for `count` in `locale`, delegated to the platform's
  // Intl.PluralRules. Covers zero/one/two/few/many/other for any BCP-47 locale —
  // consistent with formatNumber/formatDate, which already use Intl.
  private getPluralRule(count: number, locale: Locale): Intl.LDMLPluralRule {
    let rules = this.pluralRulesCache.get(locale);
    if (!rules) {
      rules = new Intl.PluralRules(locale);
      this.pluralRulesCache.set(locale, rules);
    }
    return rules.select(count);
  }

  private interpolate(text: string, locale: Locale, params?: TranslationParams): string {
    if (!params) return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      const value = this.getNestedParam(params, trimmedKey);
      if (value === undefined || value === null) {
        console.warn(`Missing translation parameter: ${trimmedKey}`);
        return match;
      }
      if (typeof value === 'function') {
        try {
          return (value as () => unknown)()?.toString() ?? match;
        } catch (error) {
          console.warn(`Error executing function parameter: ${trimmedKey}`, error);
          return match;
        }
      }
      if (typeof value === 'number') {
        return this.formatNumber(value, locale);
      }
      if (value instanceof Date) {
        return this.formatDate(value, locale);
      }
      return String(value);
    });
  }

  private getNestedParam(params: TranslationParams, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      return current && typeof current === 'object'
        ? (current as Record<string, unknown>)[key]
        : undefined;
    }, params);
  }

  private getPackageTranslation(
    packageName: string,
    key: string,
    locale: Locale
  ): string | undefined {
    const pkgTranslations = this.packageTranslations.get(packageName);
    const entry = pkgTranslations?.[locale];
    if (entry) {
      const value = getDeepValue(entry, key);
      return typeof value === 'string' ? value : undefined;
    }
    return undefined;
  }

  private getTranslation(key: string, locale: Locale): string | undefined {
    const entry = this.translations[locale];
    if (entry) {
      const value = getDeepValue(entry, key);
      return typeof value === 'string' ? value : undefined;
    }
    return undefined;
  }

  private deepMerge(target: Translations, source: Translations): Translations {
    const output = { ...target };
    for (const key in source) {
      if (Object.hasOwn(source, key)) {
        const sourceValue = source[key];
        const targetValue = target[key];
        if (
          typeof sourceValue === 'object' &&
          sourceValue !== null &&
          !Array.isArray(sourceValue) &&
          typeof targetValue === 'object' &&
          targetValue !== null &&
          !Array.isArray(targetValue)
        ) {
          output[key] = this.deepMerge(targetValue as Translations, sourceValue as Translations);
        } else {
          output[key] = sourceValue;
        }
      }
    }
    return output;
  }

  // --- introspection ---

  getAvailableLocales(): Locale[] {
    // Local accumulator — not reactive state.
    const allLocales = new Set<Locale>();
    Object.keys(this.translations).forEach((locale) => {
      allLocales.add(locale as Locale);
    });
    this.packageTranslations.forEach((packageTrans) => {
      Object.keys(packageTrans).forEach((locale) => {
        allLocales.add(locale as Locale);
      });
    });
    this.translationLoaders.forEach((_, locale) => {
      allLocales.add(locale);
    });
    // Locales reachable only through a not-yet-loaded per-package lazy loader.
    this.packageLoaders.forEach((_, key) => {
      allLocales.add(this.loaderKeyLocale(key) as Locale);
    });
    return Array.from(allLocales);
  }

  getPackageLocales(packageName: string): Locale[] {
    // Eager/loaded locales plus any registered lazy loaders for the package.
    const locales = new Set<Locale>(
      Object.keys(this.packageTranslations.get(packageName) ?? {}) as Locale[]
    );
    const prefix = `${packageName}::`;
    this.packageLoaders.forEach((_, key) => {
      if (key.startsWith(prefix)) locales.add(this.loaderKeyLocale(key) as Locale);
    });
    return Array.from(locales);
  }

  hasPackage(packageName: string): boolean {
    return this.packageTranslations.has(packageName);
  }

  getPackageTranslations(packageName: string): Partial<Record<Locale, Translations>> | undefined {
    return this.packageTranslations.get(packageName);
  }

  exists(key: string, locale: Locale, packageName?: string): boolean {
    if (packageName) {
      return this.getPackageTranslation(packageName, key, locale) !== undefined;
    }
    return this.getTranslation(key, locale) !== undefined;
  }

  // --- formatting (locale threaded explicitly) ---

  formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
    if (options) {
      return new Intl.NumberFormat(locale, options).format(value);
    }
    let fmt = this.numberFormatCache.get(locale);
    if (!fmt) {
      fmt = new Intl.NumberFormat(locale);
      this.numberFormatCache.set(locale, fmt);
    }
    return fmt.format(value);
  }

  formatDate(date: Date, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(locale, options).format(date);
  }

  formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit, locale: Locale): string {
    return new Intl.RelativeTimeFormat(locale).format(value, unit);
  }

  formatTimeAgo(date: Date, locale: Locale, fallbackLocale: Locale): string {
    // Local timestamp — not reactive state.
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const tr = (key: string, params?: TranslationParams) =>
      this.translate(key, locale, fallbackLocale, params);
    if (seconds < 45) return tr('time.ago.now');
    if (minutes < 45)
      return tr(minutes === 1 ? 'time.units.minute' : 'time.units.minutes', { count: minutes });
    if (hours < 22)
      return tr(hours === 1 ? 'time.units.hour' : 'time.units.hours', { count: hours });
    if (days < 30) return tr(days === 1 ? 'time.units.day' : 'time.units.days', { count: days });
    return this.formatDate(date, locale);
  }

  /** Re-exported for callers that need the guard without importing from types. */
  isLocaleSupported = isLocaleSupported;

  reportLoadError(error: I18nError): void {
    this.reportError(error);
  }
}

// Lazy, hoisted accessor for the process-wide registry. Holding the registry at
// module scope is correct *because* it carries no per-request mutable locale —
// only static, request-identical translation data. But it is built on first
// touch (not at module top-level) and reached through this hoisted function so
// that a consumer chunk's top-level `createPackageI18n` side-effect — which
// Vite 8 / Rolldown may order before this module's body — still finds a callable
// binding and an initialised instance, instead of a value in the temporal dead
// zone (the `Cannot read properties of undefined (reading 'registerPackage')`
// class of bug the old lazy singleton guarded against).
let _registry: I18nRegistry | undefined;

export function getRegistry(): I18nRegistry {
  _registry ??= new I18nRegistry();
  return _registry;
}
