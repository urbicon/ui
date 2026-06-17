import { createPackageI18n } from '@urbicon-ui/i18n';
import deTranslations from '../translations/de';
import enTranslations from '../translations/en';

// Create package translations for table
const tableTranslations = {
  en: enTranslations,
  de: deTranslations
};

// Create the package i18n integration (registers eagerly at module init).
export const tableI18n = createPackageI18n('table', tableTranslations);

/**
 * Context-scoped translation hook for the table package. Call during component
 * initialisation, then use the returned `t` (conventionally aliased `tt`).
 * Resolves against the nearest `<I18nProvider>`'s locale (or the base locale
 * when none is mounted) and re-renders reactively on locale change.
 */
export const useTableI18n = tableI18n.useTranslate;

// Introspection helpers (locale list / key existence).
export const { exists: hasTableTranslation, getLocales: getTableLocales } = tableI18n;

// Export translation keys type
export type TableTranslationKey = keyof typeof enTranslations;

// Re-export for external use
export { tableTranslations };
