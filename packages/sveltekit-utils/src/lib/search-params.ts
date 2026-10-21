/**
 * The read half of `URLSearchParams`. SvelteKit types `page.url.searchParams`
 * without the mutators, so a reader that asked for `URLSearchParams` would
 * refuse it; a real `URLSearchParams` is one of these too.
 */
export type ReadableSearchParams = Omit<URLSearchParams, 'append' | 'delete' | 'set' | 'sort'>;

/** What {@link withSearchParams} reads off a URL: a `URL`, or SvelteKit's read-only `page.url`. */
export type ReadableUrl = Pick<URL, 'origin' | 'pathname'> & {
  readonly searchParams: ReadableSearchParams;
};

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
 * Merge semantics per key in `patch`: every prior entry of the key is replaced
 * — a record value by its scalar, by each array element in turn, or by nothing
 * for `null`/`undefined`, which **removes** the key; a `URLSearchParams` by all
 * of its entries for that key, so repeated keys survive. An empty string is a
 * value and keeps its key (`?a=`); an empty array has no values and therefore
 * removes it. A patched key keeps the position of its first occurrence; a key
 * the URL does not have yet goes to the end, in the patch's iteration order —
 * which for a record puts integer-like keys (`'2'`) first. A param the patch
 * does not name keeps its value and its position. The query is written in
 * `URLSearchParams` encoding (`%20` comes back as `+`), so changing a key's
 * value and changing it back restores the query only when it was already in
 * that encoding and the key occurred once. The hash is not carried.
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
export function withSearchParams(url: ReadableUrl, patch: SearchParamsPatch): string {
  const replacements = new Map<string, string[]>();
  if (patch instanceof URLSearchParams) {
    for (const [key, value] of patch) {
      const values = replacements.get(key);
      if (values) values.push(value);
      else replacements.set(key, [value]);
    }
  } else {
    for (const [key, value] of Object.entries(patch)) {
      replacements.set(key, value == null ? [] : Array.isArray(value) ? value : [value]);
    }
  }
  const next = new URLSearchParams();
  const placed = new Set<string>();
  for (const [key, value] of url.searchParams) {
    const values = replacements.get(key);
    if (!values) next.append(key, value);
    else if (!placed.has(key)) {
      placed.add(key);
      for (const v of values) next.append(key, v);
    }
  }
  for (const [key, values] of replacements) {
    if (!placed.has(key)) for (const v of values) next.append(key, v);
  }
  const query = next.toString();
  const address = query ? `${url.pathname}?${query}` : url.pathname;
  // A leading `//` makes the address protocol-relative: as an `href` or a
  // `goto` target `//films` names `films` as the host, not a path on this one.
  // The origin is what disambiguates it; every other pathname stays relative.
  return url.pathname.startsWith('//') ? `${url.origin}${address}` : address;
}
