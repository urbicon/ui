import { createPackageI18n, type Locale, useI18n } from '@urbicon-ui/i18n';
import { de } from './de.js';
import { en } from './en.js';
import type { AuthLocale, DeepPartial, PartialAuthLocale } from './keys.js';

// No `: Record<string, AuthLocale>` annotation: that widening discarded the
// literal key structure createPackageI18n needs to infer typed keys. en/de are
// `satisfies AuthLocale` (literal structure preserved + parity enforced).
const authTranslations = { en, de };

export const authI18n = createPackageI18n('auth', authTranslations);

export const { t: authT, exists: hasAuthTranslation, getLocales: getAuthLocales } = authI18n;

// Alias for convenience
export const at = authT;

/**
 * Context-scoped hook for the full AuthLocale object at the active locale. Call
 * during component initialisation, then read it inside a `$derived` so it stays
 * reactive and resolves against the nearest `<I18nProvider>`:
 *
 * ```svelte
 * const authLocale = useAuthLocale();
 * const t = $derived(mergeAuthLocale(authLocale(), tProp));
 * ```
 *
 * Replaces the former free `getAuthLocale()`, which read the global locale
 * singleton and so could not be request-scoped (SSR-unsafe).
 */
export function useAuthLocale(): () => AuthLocale {
  const i18n = useI18n();
  return () => {
    // authTranslations carries narrow literal types; read it through a partial,
    // string-indexable view for the runtime lookup. i18n.locale may be any Locale
    // (fr/es/… have no auth bundle), so the index is `AuthLocale | undefined` and
    // falls back to en.
    const byLocale: Partial<Record<Locale, AuthLocale>> = authTranslations;
    return byLocale[i18n.locale] ?? en;
  };
}

/**
 * Resolve the full `AuthLocale` bundle for a locale **without** any Svelte
 * context — the SSR-/server-safe counterpart to {@link useAuthLocale}. Used by
 * the server-side email builders to localize the default transactional mails
 * from `config.email.locale`. Falls back to the English bundle for an unknown
 * locale or when `locale` is omitted, so callers never have to guard.
 */
export function resolveAuthLocale(locale?: Locale): AuthLocale {
  if (!locale) return en;
  const byLocale: Partial<Record<Locale, AuthLocale>> = authTranslations;
  return byLocale[locale] ?? en;
}

/**
 * Deep-merge consumer locale `overrides` over a complete `base` bundle — THE
 * single place a `PartialAuthLocale` becomes a full `AuthLocale` (review R19).
 * Every component resolves its `t` prop through this, so overriding one string
 * (`{ auth: { login: { title: 'Welcome back' } } }`) keeps every other key from
 * the active built-in bundle instead of blanking whole subtrees. Objects merge
 * recursively, string leaves replace, `undefined` entries are skipped. Returns
 * `base` itself when there is nothing to merge.
 */
export function mergeAuthLocale(base: AuthLocale, overrides?: PartialAuthLocale): AuthLocale {
  if (!overrides) return base;
  return deepMerge(base, overrides) as AuthLocale;
}

function deepMerge<T extends object>(base: T, overrides: DeepPartial<T>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
    if (value === undefined) continue;
    const baseValue = (base as Record<string, unknown>)[key];
    out[key] =
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      baseValue !== null &&
      typeof baseValue === 'object'
        ? deepMerge(baseValue as object, value as DeepPartial<object>)
        : value;
  }
  return out as T;
}

export type AuthTranslationKey = keyof typeof en;
export type { AuthLocale, DeepPartial, PartialAuthLocale } from './keys.js';
export { authTranslations };
