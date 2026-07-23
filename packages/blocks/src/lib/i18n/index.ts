import type { Locale, Translations } from '@urbicon-ui/i18n';
import { createPackageI18n } from '@urbicon-ui/i18n';
import enTranslations from '../translations/en';

/**
 * blocks package i18n.
 *
 * **Only the English base bundle is eager.** German (`de`) is registered as a
 * lazy dynamic-import loader, so an English-only app never statically bundles the
 * `de` catalog (~4 KB min) — Vite/Rollup splits it into its own chunk that loads
 * only when the `de` locale is activated. `en` is the base/fallback locale.
 *
 * The eager base is `{ en }` (not `blocksTranslations`, which is retained below as
 * an `{ en }` back-compat export). Registration is lazy on first
 * `useBlocksI18n()`/`t()` — see `createPackageI18n`.
 *
 * ## Before the `de` chunk loads: resolution falls back to `en`
 *
 * A package-scoped lookup for a `de` key that isn't loaded yet resolves through
 * the package fallback locale, i.e. it returns the **English** string (verified:
 * `@urbicon-ui/i18n` `registry.translate` package path + `lazy-load.test.ts`). It
 * never renders the raw key. The provider (`<I18nProvider>`) triggers the `de`
 * load in a **client-only** `$effect` on mount, so a `de` app renders English on
 * the server and the first client paint, then re-resolves to German once the
 * chunk lands — a brief text flash and a possible hydration text mismatch.
 * Two consequences of that window worth knowing:
 *
 * - The "falls back to English" guarantee assumes the provider's `fallbackLocale`
 *   stays at its default (`en`). Pointing `fallbackLocale` at a lazy locale that
 *   has not loaded yet leaves both lookup paths empty — such a key then renders
 *   raw and fires `onMissingKey`. Eager-register any locale you use as fallback.
 * - `LocaleSwitcher` disables its trigger while a locale chunk load is in flight
 *   (`registry.isLoading`), so without the eager register a `de` app briefly
 *   shows the switcher disabled on first mount.
 *
 * The SSR recipe below removes both, along with the flash itself.
 *
 * ## SSR recipe for German (and other non-base) apps
 *
 * German SvelteKit SSR apps should register the `de` bundle eagerly **once at
 * app start** so the very first server render is already German (no flash, no
 * hydration mismatch). The registry is module-global and holds only static,
 * request-identical translation data, so a single startup registration is
 * SSR-safe — it carries no per-request state:
 *
 * ```ts
 * // src/hooks.server.ts (or any module evaluated once at server start)
 * import { registerBlocksLocale } from '@urbicon-ui/blocks';
 * import de from '@urbicon-ui/blocks/i18n/de';
 *
 * registerBlocksLocale('de', de);
 * ```
 *
 * This keeps the `de` catalog out of English-only client bundles (the whole point
 * of the split) while making it eagerly present wherever it is actually rendered.
 */
export const blocksI18n = createPackageI18n(
  'blocks',
  { en: enTranslations },
  {
    loaders: {
      de: () => import('../translations/de').then((m) => m.default)
    }
  }
);

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
 * when none is mounted) and re-renders reactively on locale change. For a lazy
 * locale (`de`) that isn't loaded yet, resolution falls back to the base locale
 * (`en`); see the module docblock and `registerBlocksLocale` for the SSR path.
 */
export const useBlocksI18n = blocksI18n.useTranslate;

/**
 * Eagerly register the blocks bundle for a lazy locale (currently `de`) so it is
 * present for SSR / the first render, instead of loading client-side on mount.
 * Call once at app/server start, paired with the public locale subpath import:
 *
 * ```ts
 * import { registerBlocksLocale } from '@urbicon-ui/blocks';
 * import de from '@urbicon-ui/blocks/i18n/de';
 * registerBlocksLocale('de', de);
 * ```
 *
 * Additive (does not drop the eager `en` base) and strict (throws on an
 * unsupported locale or a non-object bundle).
 */
export const registerBlocksLocale = (locale: Locale, bundle: Translations): void =>
  blocksI18n.registerLocale(locale, bundle);

// Introspection helpers (locale list / key existence).
export const { exists: hasBlocksTranslation, getLocales: getBlocksLocales } = blocksI18n;

// Export translation keys type
export type BlocksTranslationKey = keyof typeof enTranslations;

/**
 * The eager base bundle only (`{ en }`). `de` is lazy and no longer part of this
 * object; import it explicitly via `@urbicon-ui/blocks/i18n/de` (e.g. for a parity
 * test or the SSR eager-register recipe above).
 */
const blocksTranslations = {
  en: enTranslations
};

// Re-export for external use
export { blocksTranslations };
