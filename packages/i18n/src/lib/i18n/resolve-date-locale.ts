import { BASE_LOCALE } from './context.svelte';
import { isLocaleSupported } from './types';

/**
 * Resolve the BCP 47 tag a component formats with (`Intl.DateTimeFormat`,
 * `Intl.NumberFormat`, `Intl.RelativeTimeFormat`).
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
 * whatever `x` is behind the `Locale` type. Before formatting read that value,
 * a bogus one merely made translation lookups fall back. Now it reaches `Intl`,
 * where it fails in two ways, both measured:
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
 *
 * Lives here rather than in `blocks` (where it was written, 2026-07-31) because
 * `table` needs the same chain for its own cells and the two packages share no
 * code but this one — both peer-depend on this package, and both `BASE_LOCALE`
 * and `isLocaleSupported` already live next door. A second hand-aligned copy is
 * how the four drifted `toSlug` implementations happened (#43).
 */
export function resolveDateLocale(prop: string | undefined, contextLocale: string): string {
  if (prop !== undefined && prop !== 'auto') return prop;
  if (isLocaleSupported(contextLocale)) return contextLocale;

  // First `import.meta.env` in this package, so the `@sveltejs/package` build
  // advisory ("Avoid usage of `import.meta.env`") now fires here too. Same
  // deliberate trade as in `blocks`: optional-chained so a non-Vite consumer
  // gets `undefined` rather than a throw, and `esm-env` is not an option
  // because it would be a runtime dependency in the published dist. The
  // advisory is a plain string match, so `?.` does not quiet it. See the
  // zero-dependency note in AGENTS.md — do not "fix" it by adding a dep.
  if (import.meta.env?.DEV) {
    console.warn(
      `[i18n] <I18nProvider locale="${contextLocale}"> is not a supported locale, so date and ` +
        `number formatting falls back to "${BASE_LOCALE}". Supported: en, de, fr, es, it, nl. ` +
        `To format in a locale the library ships no translations for, pass it to the ` +
        `component directly (e.g. locale="ja-JP") instead of through the provider.`
    );
  }
  return BASE_LOCALE;
}
