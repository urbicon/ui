import { BASE_LOCALE, isLocaleSupported } from '@urbicon-ui/i18n';

/**
 * Resolve the BCP 47 tag a date component formats with.
 *
 * The chain is `explicit prop → i18n provider → base locale`, and the two rungs
 * are treated differently on purpose.
 *
 * **The prop is trusted.** A consumer writing `locale="ja-JP"` means it, and any
 * valid BCP 47 tag is fair game — the library has no business restricting it to
 * the six locales it ships translations for. An invalid one throws from `Intl`,
 * loudly, at the call site that caused it. That is the house rule: explicit
 * input fails loudly rather than being silently repaired.
 *
 * **The context value is verified**, because a bad one is a very different
 * failure. `I18nState`'s constructor does not validate its argument (only
 * `setLocale` does — `context.svelte.ts`), so `<I18nProvider locale={x}>` puts
 * whatever `x` is behind the `Locale` type. Before date formatting read that
 * value, a bogus one merely made translation lookups fall back. Now it reaches
 * `Intl`, where it fails in two ways, both measured:
 *
 *   - `'de_DE'` (underscore) and `''` throw `RangeError` — a render-time throw,
 *     i.e. an SSR 500, from a component that never saw the offending value;
 *   - `'xx'`, `'zz-ZZ'`, `'english'` do NOT throw. `Intl` resolves them to the
 *     *runtime* default — `en-US` under Bun, whatever `LANG` says under Node.
 *     That is exactly the server/client divergence the `'auto'` default exists
 *     to prevent, reintroduced through the back door.
 *
 * So an unsupported context value falls back to the base locale, which is what
 * the rest of the i18n system does with it anyway, and says so in DEV. The
 * component stays renderable and the diagnosis points at the provider.
 */
export function resolveDateLocale(prop: string | undefined, contextLocale: string): string {
  if (prop !== undefined && prop !== 'auto') return prop;
  if (isLocaleSupported(contextLocale)) return contextLocale;

  if (import.meta.env?.DEV) {
    console.warn(
      `[blocks] <I18nProvider locale="${contextLocale}"> is not a supported locale, so date ` +
        `formatting falls back to "${BASE_LOCALE}". Supported: en, de, fr, es, it, nl. ` +
        `To format in a locale the library ships no translations for, pass it to the date ` +
        `component directly (e.g. locale="ja-JP") instead of through the provider.`
    );
  }
  return BASE_LOCALE;
}
