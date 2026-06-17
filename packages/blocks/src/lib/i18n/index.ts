import { createPackageI18n } from '@urbicon-ui/i18n';
import deTranslations from '../translations/de';
import enTranslations from '../translations/en';

// Create package translations for blocks
const blocksTranslations = {
  en: enTranslations,
  de: deTranslations
};

// Create the package i18n integration (registers eagerly at module init).
export const blocksI18n = createPackageI18n('blocks', blocksTranslations);

/**
 * Context-scoped translation hook for the blocks package. Call during component
 * initialisation, then use the returned `t` (conventionally aliased `bt`):
 *
 * ```svelte
 * const bt = useBlocksI18n();
 * <button aria-label={bt('dialog.close')}>…</button>
 * ```
 *
 * Resolves against the nearest `<I18nProvider>`'s locale (or the base locale
 * when none is mounted) and re-renders reactively on locale change.
 */
export const useBlocksI18n = blocksI18n.useTranslate;

// Introspection helpers (locale list / key existence).
export const { exists: hasBlocksTranslation, getLocales: getBlocksLocales } = blocksI18n;

// Export translation keys type
export type BlocksTranslationKey = keyof typeof enTranslations;

// Re-export for external use
export { blocksTranslations };
