import { createPackageI18n } from '@urbicon-ui/i18n';
import deTranslations from '../translations/de';
import enTranslations from '../translations/en';

// Create package translations for docs
const docsTranslations = {
  en: enTranslations,
  de: deTranslations
};

// Create the package i18n integration (registers lazily on first useTranslate()/t()).
export const docsI18n = createPackageI18n('docs', docsTranslations);

/**
 * Context-scoped translation hook for the docs package. Call during component
 * initialisation, then use the returned `t` (conventionally aliased `dt`).
 * Resolves against the nearest `<I18nProvider>`'s locale (or the base locale
 * when none is mounted) and re-renders reactively on locale change.
 */
export const useDocsI18n = docsI18n.useTranslate;

// Introspection helpers (locale list / key existence).
export const { exists: hasDocsTranslation, getLocales: getDocsLocales } = docsI18n;

// Export translation keys type
export type DocsTranslationKey = keyof typeof enTranslations;

// Re-export for external use
export { docsTranslations };
