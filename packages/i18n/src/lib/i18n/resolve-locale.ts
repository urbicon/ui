import { getRegistry } from './registry.svelte';
import { type Locale, SUPPORTED_LOCALES } from './types';

/**
 * Header-like source for {@link resolveLocale}. Pass a `Request` (its `cookie` and
 * `accept-language` headers are read) or a plain object with the raw header
 * strings — keeps the helper framework-agnostic.
 */
export interface LocaleSource {
  /** Raw `Cookie` request header, e.g. `theme=dark; urbicon-locale=de`. */
  cookie?: string | null;
  /** Raw `Accept-Language` request header, e.g. `de-DE,de;q=0.9,en;q=0.8`. */
  acceptLanguage?: string | null;
}

export interface ResolveLocaleOptions {
  /**
   * Locales the app actually ships data for. Resolution never returns a locale
   * outside this set. Defaults to the locales currently registered in the
   * registry (so it tracks "data optional"), falling back to all
   * {@link SUPPORTED_LOCALES} if nothing is registered yet.
   */
  supportedLocales?: readonly Locale[];
  /** Returned when neither cookie nor Accept-Language yields a supported locale. @default 'en' */
  defaultLocale?: Locale;
  /** Name of the cookie holding the persisted locale choice. @default 'urbicon-locale' */
  cookieName?: string;
}

function readHeaders(source: Request | LocaleSource): LocaleSource {
  if (typeof Request !== 'undefined' && source instanceof Request) {
    return {
      cookie: source.headers.get('cookie'),
      acceptLanguage: source.headers.get('accept-language')
    };
  }
  return source as LocaleSource;
}

function parseCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/**
 * Parse `Accept-Language` and return the first base language (`en` from `en-US`)
 * present in `supported`, honouring the `q` weighting order.
 */
function parseAcceptLanguage(
  header: string | null | undefined,
  supported: ReadonlySet<string>
): Locale | undefined {
  if (!header) return undefined;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      const weight = q ? Number.parseFloat(q.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), weight: Number.isNaN(weight) ? 0 : weight };
    })
    .filter((entry) => entry.tag && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  for (const { tag } of ranked) {
    const base = tag.split('-')[0];
    if (supported.has(base)) return base as Locale;
  }
  return undefined;
}

/**
 * Resolve the initial locale for a request, server-side: persisted cookie first,
 * then the browser's `Accept-Language`, then the default. Feed the result to
 * `<I18nProvider locale={…}>` so SSR and hydration agree (no client-only
 * `navigator.language` guess, no hydration mismatch).
 *
 * ```ts
 * // +layout.server.ts
 * export const load = ({ request }) => ({ locale: resolveLocale(request) });
 * ```
 *
 * Detection is the consumer's choice — this helper is optional. Persisting the
 * cookie on switch is the consumer's job too (e.g. in the provider's
 * `onLocaleChange`); this only reads it back.
 */
export function resolveLocale(
  source: Request | LocaleSource,
  options: ResolveLocaleOptions = {}
): Locale {
  const available = getRegistry().getAvailableLocales();
  const supportedList =
    options.supportedLocales ?? (available.length > 0 ? available : SUPPORTED_LOCALES);
  const supported = new Set<string>(supportedList);
  const fallback = options.defaultLocale ?? 'en';
  const cookieName = options.cookieName ?? 'urbicon-locale';

  const { cookie, acceptLanguage } = readHeaders(source);

  // 1. Persisted explicit choice.
  const fromCookie = parseCookie(cookie, cookieName);
  if (fromCookie && supported.has(fromCookie)) return fromCookie as Locale;

  // 2. Browser preference.
  const fromHeader = parseAcceptLanguage(acceptLanguage, supported);
  if (fromHeader) return fromHeader;

  // 3. Default.
  return fallback;
}
