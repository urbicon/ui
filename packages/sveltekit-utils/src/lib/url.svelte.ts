import { building } from '$app/environment';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { type SearchParamsPatch, withSearchParams } from './search-params';

// The pure core of the two writers below, re-exported so this import path
// carries it next to them. Its own module — and its own `./search-params`
// subpath — because it must stay free of `$app`: importing this one pulls
// SvelteKit's client runtime, which a `load` or a form action must not.
export { type SearchParamsPatch, withSearchParams } from './search-params';

// The v8 view-object binding lives in its own module; re-exported here so the
// documented import path (`@urbicon-ui/sveltekit-utils/url.svelte`) carries it.
// The mirror types (TableViewLike, TableViewSnapshot, …) are exported from the
// package root via `table-view` — not re-exported here, which would make the
// root's star exports ambiguous and silently drop them. The v7
// `createTableQueryUrlSync` factory is gone with the table's `query` prop —
// the URL home of a table view is `bindViewToUrl`; the load-path serializers
// (`searchParamsToViewSnapshot` & friends) live in `table-view`.
export { bindViewToUrl, type UrlViewBindingOptions } from './view-binding.svelte';

/**
 * How {@link useUrlArrayParam} maps an array onto the URL:
 * - `repeat` — one entry per key: `?tag=a&tag=b`
 * - `csv` — a single delimited value: `?tag=a,b`
 */
export type UrlArrayStrategy = 'repeat' | 'csv';

/** Codec + seed for {@link useUrlParam} / {@link createUrlParam}. */
export type UrlParamOptions<T> = {
  /**
   * Read the value out of the current search params. Return `null`/`undefined`
   * to signal "absent" — the getter then yields {@link initial}.
   */
  parse: (sp: URLSearchParams) => T | null | undefined;
  /**
   * Encode the value into `URLSearchParams`. The keys it produces are the ones
   * the setter manages: on write they are cleared from the current URL and
   * replaced by this output, leaving every other param untouched. Emit no
   * entry for a key to remove it from the URL.
   */
  serialize: (value: T) => URLSearchParams;
  /** Value the getter returns when {@link parse} yields `null`/`undefined`. */
  initial: T;
  /**
   * Replace the current history entry instead of pushing a new one, so rapid
   * filter/pagination edits don't flood the back button.
   * @default true
   */
  replaceState?: boolean;
};

/**
 * Low-level escape hatch to update several params at once via `goto` (without a
 * full navigation). Navigates to the address {@link withSearchParams} builds
 * from the current URL and `next`, so every unrelated param is kept; the merge
 * semantics per key are documented there.
 *
 * @param next - Params to apply, as `URLSearchParams` or a plain record. A
 *   record value of `null`/`undefined` deletes that key.
 * @param opts - `replaceState` (default `true`) — replace vs. push history.
 * @example
 * ```typescript
 * // on /films?filter=old
 * updateUrlSearchParams({ page: '1', tag: ['a', 'b'], filter: null });
 * // navigates to /films?page=1&tag=a&tag=b   (the prior `filter` param is dropped)
 * ```
 */
// This writer and `createUrlParam`'s setter hand `goto` the pathname-qualified
// address, never a bare `?query`: `goto` resolves a relative target against
// `document.baseURI` (`@sveltejs/kit/src/runtime/client/utils.js` `resolve_url`,
// which falls back to the first `<base>` tag), so with a `<base href>` in the
// document `?page=2` keeps the base's path, not the page's. No harness can
// separate the two spellings by outcome — both resolve against `page.url` there
// — so `url.test.ts` pins the string `goto` was handed instead.
// The address is not a route id either, so no `resolve()` here; callers are
// free to call it at their composition point.
export function updateUrlSearchParams(next: SearchParamsPatch, opts?: { replaceState?: boolean }) {
  goto(withSearchParams(page.url, next), {
    replaceState: opts?.replaceState ?? true,
    noScroll: true,
    keepFocus: true
  });
}

/**
 * Non-reactive core of {@link useUrlParam}: builds the `get(sp)` / `set(value)`
 * pair without touching the `page` rune, so `get` can be evaluated against any
 * `URLSearchParams`. Prefer {@link useUrlParam} in components — this is the
 * escape hatch when you need to read against a snapshot other than the live
 * page URL (tests, a server `load`).
 *
 * `set` rewrites only the keys that `options.serialize` produces (clear +
 * re-append) and preserves the rest, then navigates with `goto` to the address
 * {@link withSearchParams} builds (`replaceState`, `noScroll`, `keepFocus`).
 *
 * @param _key - Ignored — `options.parse`/`options.serialize` already close
 *   over the key (see {@link useUrlArrayParam}); kept only for signature parity
 *   with {@link useUrlParam}.
 * @param options - Parse/serialize codec, initial value, history behaviour.
 * @returns `{ get, set }` — `get(sp)` reads a value from the given params
 *   (falling back to `initial`), `set(value)` writes it to the URL.
 */
// `key` is unused here — `options.parse`/`options.serialize` already close over
// it (see useUrlArrayParam) — but kept for signature parity with useUrlParam.
export function createUrlParam<T>(_key: string, options: UrlParamOptions<T>) {
  const get = (sp: URLSearchParams) => options.parse(sp) ?? options.initial;
  function setValue(next: T) {
    goto(withSearchParams(page.url, options.serialize(next)), {
      replaceState: options.replaceState ?? true,
      noScroll: true,
      keepFocus: true
    });
  }
  return { get, set: setValue } as const;
}

/**
 * Bind a typed value to a URL search param, reactively. The returned getter
 * reads through the `page` rune, so it re-evaluates whenever the URL changes;
 * the setter writes the value back via `goto` (no full navigation).
 *
 * SSR-safe: the getter only reads `page.url` (populated on the server), so the
 * initial render reflects the incoming URL. The setter calls the client-only
 * `goto` and is meant to run from event handlers/effects — never during SSR.
 *
 * Prerender-safe: SvelteKit forbids reading `url.searchParams` while
 * prerendering (the emitted HTML must not depend on a query string that will
 * not exist at request time). During `building` the getter therefore yields
 * {@link UrlParamOptions.initial} — "absent" is the truth for that render;
 * after hydration the client re-reads the real URL reactively.
 *
 * A **getter**, not a store, is returned on purpose: call it lazily inside
 * `$derived`/`$effect` and the read is tracked there.
 *
 * @typeParam T - The decoded value type.
 * @param key - Param key (forwarded to `createUrlParam` for signature parity;
 *   the actual key handling lives in `options.parse`/`options.serialize`).
 * @param options - Parse/serialize codec, initial value, history behaviour.
 * @returns `[get, set]` — `get()` reads the live value, `set(value)` writes it.
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useUrlParam } from '@urbicon-ui/sveltekit-utils/url.svelte';
 *
 *   const [page, setPage] = useUrlParam<number>('page', {
 *     parse: (sp) => Number(sp.get('page') ?? '1'),
 *     serialize: (v) => new URLSearchParams({ page: String(v) }),
 *     initial: 1
 *   });
 * </script>
 *
 * <button onclick={() => setPage(page() + 1)}>Next — {page()}</button>
 * ```
 */
export function useUrlParam<T>(key: string, options: UrlParamOptions<T>) {
  const { get, set } = createUrlParam<T>(key, options);
  const getBound = building ? () => options.initial : () => get(page.url.searchParams);
  return [getBound, set] as const;
}

/**
 * {@link useUrlParam} specialised for a `string[]`, with the encoding handled
 * for you. Reactive read + `goto`-based write, same as {@link useUrlParam}.
 *
 * The `csv` strategy drops empty segments on read (`?tag=` → `[]`) and writes
 * no param for an empty array, so an empty selection leaves the URL clean.
 *
 * @param key - The param key.
 * @param opts - `initial` seed, `strategy` (default `'repeat'`), and
 *   `delimiter` for `csv` (default `','`). See {@link UrlArrayStrategy}.
 * @returns `[get, set]` — `get()` reads the current `string[]`, `set(values)`
 *   writes it.
 * @example
 * ```typescript
 * const [tags, setTags] = useUrlArrayParam('tag', { initial: [] });            // ?tag=a&tag=b
 * const [cats, setCats] = useUrlArrayParam('cat', { initial: [], strategy: 'csv' }); // ?cat=a,b
 * ```
 */
export function useUrlArrayParam(
  key: string,
  opts: {
    initial: string[];
    strategy?: UrlArrayStrategy;
    delimiter?: string;
  }
) {
  const strategy = opts.strategy ?? 'repeat';
  const delimiter = opts.delimiter ?? ',';

  const parse = (sp: URLSearchParams): string[] => {
    if (strategy === 'repeat') return sp.getAll(key);
    const raw = sp.get(key);
    return raw ? raw.split(delimiter).filter(Boolean) : [];
  };

  const serialize = (values: string[]): URLSearchParams => {
    const sp = new URLSearchParams();
    if (strategy === 'repeat') {
      for (const v of values) sp.append(key, v);
    } else {
      if (values.length) sp.set(key, values.join(delimiter));
    }
    return sp;
  };

  return useUrlParam<string[]>(key, { parse, serialize, initial: opts.initial });
}
