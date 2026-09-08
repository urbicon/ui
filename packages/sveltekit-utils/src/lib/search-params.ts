/**
 * What {@link withSearchParams} applies to a URL: a plain record, or a
 * `URLSearchParams` whose repeated keys survive the merge.
 */
export type SearchParamsPatch =
  | URLSearchParams
  | Record<string, string | string[] | null | undefined>;

/**
 * The address `url` has after `patch` — the pure core that
 * `updateUrlSearchParams` and `createUrlParam`'s setter navigate to. Returns
 * `pathname?query`, or the pathname alone once no param is left, so the result
 * serves as a link's `href`, a redirect's location, or the argument of `goto`.
 * Reads nothing from the page, mutates neither argument, navigates nowhere.
 *
 * Merge semantics per key in `patch`: the key is first cleared, then
 * re-applied — a record value `set`s a scalar, `append`s each array element,
 * and **removes** the key entirely for `null`/`undefined`; a `URLSearchParams`
 * re-appends all of its entries, so repeated keys survive. An empty string is a
 * value and keeps its key (`?a=`); an empty array appends nothing and therefore
 * removes it. A param the patch does not name keeps its value and its position;
 * a patched key moves behind them. The hash is not carried.
 *
 * A `url.pathname` that itself begins with `//` comes back origin-qualified
 * (`https://host//films?page=2`): left relative, `//films` is a
 * protocol-relative URL naming `films` as the host.
 *
 * @param url - The URL to start from — `page.url` in a component, `url` in a
 *   `load`. SvelteKit makes `url.searchParams` throw while prerendering
 *   (`@sveltejs/kit/src/utils/url.js` `disable_search`: the emitted HTML must
 *   not depend on a query string), and this reads it.
 * @param patch - Params to apply. A record value of `null`/`undefined` deletes
 *   that key.
 * @returns Pathname plus the merged query: `/films?sort=year`.
 * @example
 * ```typescript
 * withSearchParams(new URL('https://x.test/films?sort=title&page=3'), {
 *   sort: 'year',
 *   page: null
 * });
 * // '/films?sort=year'
 * ```
 */
export function withSearchParams(url: URL, patch: SearchParamsPatch): string {
  const next = new URLSearchParams(url.searchParams);
  if (patch instanceof URLSearchParams) {
    for (const [key] of patch) next.delete(key);
    for (const [key, value] of patch) next.append(key, value);
  } else {
    for (const [key, value] of Object.entries(patch)) {
      next.delete(key);
      if (Array.isArray(value)) {
        for (const v of value) next.append(key, v);
      } else if (value != null) {
        next.set(key, value);
      }
    }
  }
  const query = next.toString();
  const address = query ? `${url.pathname}?${query}` : url.pathname;
  // A leading `//` makes the address protocol-relative: as an `href` or a
  // `goto` target `//films` names `films` as the host, not a path on this one.
  // The origin is what disambiguates it; every other pathname stays relative.
  return url.pathname.startsWith('//') ? `${url.origin}${address}` : address;
}
