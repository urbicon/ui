import { createPackageI18n, type Locale, useI18n } from '@urbicon-ui/i18n';
import { de } from './de.js';
import { en } from './en.js';
import type { AuthLocale } from './keys.js';

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
 * const t = $derived(tProp ?? authLocale());
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

export type AuthTranslationKey = keyof typeof en;
export type { AuthLocale } from './keys.js';
export { authTranslations };
