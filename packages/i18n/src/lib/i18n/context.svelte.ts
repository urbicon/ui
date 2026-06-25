import { getContext, hasContext, setContext, untrack } from 'svelte';
import { getRegistry } from './registry.svelte';
import type {
  I18nError,
  I18nMissingKey,
  Locale,
  PluralParams,
  TranslationOptions,
  TranslationParams
} from './types';
import { isLocaleSupported } from './types';

/**
 * The constant base locale used for read-tolerant resolution when no
 * `<I18nProvider>` is mounted. A constant — never global mutable state — so a
 * provider-less render is SSR-safe and identical on server and client (no
 * hydration mismatch), and reads never leak across requests. Consumers who need
 * a different or switchable locale mount a provider.
 */
export const BASE_LOCALE: Locale = 'en';

/**
 * Request-scoped reactive locale state. The *only* mutable per-request i18n
 * value — created by `<I18nProvider>` and read through the context. Encapsulated:
 * `locale` is exposed read-only; switching goes through `setLocale`.
 */
export class I18nState {
  // Private $state field: external code can read `.locale` but must go through
  // `setLocale` to change it (validation + lazy-load trigger live there).
  #locale = $state<Locale>(BASE_LOCALE);

  /** Fallback locale used when a key is missing in the active locale. */
  readonly fallbackLocale: Locale;

  constructor(locale: Locale = BASE_LOCALE, fallbackLocale: Locale = BASE_LOCALE) {
    this.#locale = locale;
    this.fallbackLocale = fallbackLocale;
  }

  get locale(): Locale {
    return this.#locale;
  }

  /**
   * Switch the active locale in place (reactive — no reload). Returns `false`
   * (and reports `unsupported-locale`) for an unsupported locale, without
   * switching. For a supported locale the switch is applied immediately and
   * `true` is returned ("switch initiated"): if a lazy loader is registered and
   * the data isn't present yet, the load is triggered (not awaited) so the
   * `$derived` reads re-resolve once the chunk lands. Use `registry.loadLocale`
   * directly when you need to await.
   *
   * The async failure is not silent: if that load rejects AND no data exists for
   * the locale (so reads can't even fall back to it), `load-failed-no-fallback`
   * is reported to the error sink — the loud signal that "the language you
   * switched to can't be rendered". (No-op today, where all bundles are eager.)
   */
  setLocale(locale: Locale): boolean {
    const registry = getRegistry();
    if (!isLocaleSupported(locale)) {
      registry.reportLoadError({ type: 'unsupported-locale', locale });
      return false;
    }
    if (registry.hasLoader(locale) && !registry.isLoaded(locale)) {
      // loadLocale never rejects (it reports `load-failed` internally); inspect
      // its boolean result to surface the harder "switched but unrenderable" case.
      registry.loadLocale(locale).then((ok) => {
        if (!ok && !registry.hasTranslations(locale)) {
          registry.reportLoadError({ type: 'load-failed-no-fallback', locale });
        }
      });
    }
    this.#locale = locale;
    return true;
  }
}

// Symbol key + explicit typed accessors rather than svelte's `createContext`:
// its generated getter calls `e.missing_context()` (throws) when no provider is
// mounted, which is incompatible with the read-tolerant contract below (a
// provider-less <Button> must still render its ARIA strings in baseLocale). A
// Symbol is collision-free and type-safe — the convention's intent ("no string
// keys") holds; only the throw-on-missing semantics are traded for tolerance.
const I18N_CONTEXT_KEY = Symbol('urbicon-ui-i18n');

/** Set the request-scoped locale state. Called by `<I18nProvider>`. */
export function provideI18nState(state: I18nState): I18nState {
  return setContext(I18N_CONTEXT_KEY, state);
}

/**
 * Read the request-scoped locale state, or `undefined` when no `<I18nProvider>`
 * is mounted above (read-tolerant). Must be called during component init.
 */
export function useI18nState(): I18nState | undefined {
  return hasContext(I18N_CONTEXT_KEY) ? getContext<I18nState>(I18N_CONTEXT_KEY) : undefined;
}

/**
 * Provide the request-scoped locale state from a component's own init, and return
 * it. This is the primitive behind `<I18nProvider>`; reach for it directly when
 * the **same** component both provides i18n and renders translated content —
 * e.g. a root `+layout.svelte` whose own chrome uses `t`. (A child
 * `<I18nProvider>` cannot serve the parent that mounts it, because context only
 * flows downward; calling `provideI18n` in the parent's script puts the state on
 * that component's own context map, which its own `useI18n()`/`use<Pkg>I18n()`
 * then reads.)
 *
 * Pass `locale` as a reactive getter (`() => data.locale`) to keep it controlled:
 * a prop/load change is synced into the state, while an in-place `setLocale`
 * switch (which doesn't change the getter's value) is never clobbered.
 *
 * Must be called during component initialisation.
 */
export function provideI18n(
  locale: Locale | (() => Locale),
  fallbackLocale: Locale = BASE_LOCALE
): I18nState {
  const getLocale = typeof locale === 'function' ? locale : () => locale;
  const state = new I18nState(untrack(getLocale), fallbackLocale);
  provideI18nState(state);

  if (typeof locale === 'function') {
    // Controlled sync: depend on the getter only (untrack the state read) so a
    // prop change flows in but setLocale() is not reverted.
    $effect(() => {
      const next = getLocale();
      if (next !== untrack(() => state.locale)) {
        state.setLocale(next);
      }
    });
  }

  // Ensure the initial active + fallback locales' lazy bundles are loaded (WP4) —
  // a no-op when everything is eager. Client-only (effects don't run during SSR),
  // so a lazy non-base initial locale renders the fallback on the server and the
  // first client paint, then re-resolves once the chunk lands. Subsequent switches
  // load via setLocale. Read untracked → runs once on mount, not on every switch.
  $effect(() => {
    const registry = getRegistry();
    void registry.loadLocale(untrack(() => state.locale));
    void registry.loadLocale(state.fallbackLocale);
  });

  return state;
}

/**
 * General i18n hook for locale control and locale-aware formatting/resolution.
 *
 * Read paths (`locale`, `t`, formatters) are tolerant: without a provider they
 * resolve against {@link BASE_LOCALE}. The write path (`setLocale`) is strict:
 * without a provider it throws, because there is no request-scoped state to
 * mutate — "you asked to switch the language but never mounted an
 * `<I18nProvider>`". Call during component initialisation.
 */
export interface I18nApi {
  /** Active locale (reactive). Falls back to {@link BASE_LOCALE} without a provider. */
  readonly locale: Locale;
  /** Locales with registered data or a loader (reactive). */
  readonly availableLocales: Locale[];
  /** Whether a lazy locale load is in flight (reactive). */
  readonly isLoading: boolean;
  /** Switch the active locale. Throws without a provider. */
  setLocale(locale: Locale): boolean;
  t(key: string, params?: TranslationParams, options?: TranslationOptions | string): string;
  plural(key: string, params: PluralParams, options?: TranslationOptions): string;
  exists(key: string, packageName?: string): boolean;
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
  formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string;
  formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit): string;
  formatTimeAgo(date: Date): string;
}

export function useI18n(): I18nApi {
  const state = useI18nState();
  const registry = getRegistry();
  const localeOf = () => state?.locale ?? BASE_LOCALE;
  const fallbackOf = () => state?.fallbackLocale ?? BASE_LOCALE;

  return {
    get locale() {
      return localeOf();
    },
    get availableLocales() {
      return registry.getAvailableLocales();
    },
    get isLoading() {
      return registry.isLoading;
    },
    setLocale(locale: Locale) {
      if (!state) {
        throw new Error(
          '[i18n] setLocale() requires an <I18nProvider>. Without a provider the locale ' +
            'is the constant base locale and cannot change. Wrap your app root in ' +
            '<I18nProvider locale={…}> to enable locale switching.'
        );
      }
      return state.setLocale(locale);
    },
    t: (key, params, options) => registry.translate(key, localeOf(), fallbackOf(), params, options),
    plural: (key, params, options) =>
      registry.pluralize(key, params, localeOf(), fallbackOf(), options),
    exists: (key, packageName) => registry.exists(key, localeOf(), packageName),
    formatNumber: (value, options) => registry.formatNumber(value, localeOf(), options),
    formatDate: (date, options) => registry.formatDate(date, localeOf(), options),
    formatRelativeTime: (value, unit) => registry.formatRelativeTime(value, unit, localeOf()),
    formatTimeAgo: (date) => registry.formatTimeAgo(date, localeOf(), fallbackOf())
  };
}

export interface I18nConfigureOptions {
  /**
   * Routes i18n errors — a lazy locale load that rejects (`load-failed`,
   * `load-failed-no-fallback`), or a `setLocale` with an unsupported code
   * (`unsupported-locale`) — to your handler instead of the default
   * `console.warn`. The hook for telemetry (Sentry, structured logging).
   */
  onError?: (error: I18nError) => void;
  /**
   * Invoked when `t`/`translate` resolves a key *nowhere* — not the active
   * locale, not the fallback, in no package or the global bundle — and falls back
   * to rendering the key string itself. Off by default (read-tolerant: a
   * provider-less render legitimately misses keys), so this only fires when you
   * opt in — the loud signal for "this string ships as its raw key". Pair with
   * `createMissingKeyCollector` to assert "no misses" across a test/E2E run.
   */
  onMissingKey?: (info: I18nMissingKey) => void;
}

/**
 * App-global i18n configuration. Call **once at startup** (module scope or root
 * setup), not per-request: the handler lives on the process-wide registry, so a
 * per-request assignment under concurrent SSR would race. Without it, errors fall
 * back to `console.warn`.
 *
 * ```ts
 * configureI18n({ onError: (e) => reportToSentry(e) });
 * ```
 */
export function configureI18n(options: I18nConfigureOptions): void {
  const registry = getRegistry();
  registry.onError = options.onError;
  registry.onMissingKey = options.onMissingKey;
}
