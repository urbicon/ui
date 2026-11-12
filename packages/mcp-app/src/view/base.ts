/** As much of `document` as {@link readBaseMeta} needs — a test builds it. */
export interface MetaSource {
  querySelector(selector: string): { getAttribute(name: string): string | null } | null;
}

const TRAILING_SLASH = /\/+$/;

/**
 * The app's base URL from `<meta name="<metaName>" content="…">` — without a
 * trailing slash, or `null`.
 *
 * The server writes it into the HTML at `resources/read` (`createViewCatalog`
 * → `base`), because the build does not know the environment. `null` means
 * the placeholder was not replaced (a view loaded around `resources/read`), or
 * the value is not an http(s) URL — the view then leaves out whatever links
 * to the app, instead of a link into nowhere.
 */
export function readBaseMeta(doc: MetaSource, metaName: string): string | null {
  const value = doc.querySelector(`meta[name="${metaName}"]`)?.getAttribute('content') ?? '';
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return url.href.replace(TRAILING_SLASH, '');
}
