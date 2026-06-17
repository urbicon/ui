import { createPackageI18n, type DeepKeys } from '@urbicon-ui/i18n';
import deTranslations from '../translations/de';
import enTranslations from '../translations/en';

const appTranslations = {
  en: enTranslations,
  de: deTranslations
};

// Registers the docs-app translations with the shared i18n registry at module
// init (eager — en/de ship inline; no lazy loaders needed for two locales).
export const appI18n = createPackageI18n('app', appTranslations);

export type AppTranslationKey = DeepKeys<typeof enTranslations>;

/**
 * App-local translate signature: typed keys, but params always optional. The
 * library's `TypedTranslationFunction` makes params *required* for keys carrying
 * `{{…}}`, which fights the docs app's `t(key as AppTranslationKey)` casts (a
 * key union widens to "some key has params" → params required). The chrome
 * strings are paramless, so a loose signature is the right ergonomics here.
 */
export type AppT = (
  key: AppTranslationKey,
  params?: Record<string, string | number | boolean>
) => string;

/**
 * Context-scoped translation hook for the docs app. Call during component init,
 * then use the returned `t` (conventionally aliased `ta`):
 *
 * ```svelte
 * const ta = useAppI18n();
 * <h1>{ta('chrome.appTitle')}</h1>
 * ```
 *
 * Resolves against the `provideI18n` set up in the root layout.
 */
export function useAppI18n(): AppT {
  return appI18n.useTranslate() as unknown as AppT;
}
