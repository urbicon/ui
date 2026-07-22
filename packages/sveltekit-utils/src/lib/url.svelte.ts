import { goto } from '$app/navigation';
import { page } from '$app/state';
import {
  applyTableQueryToSearchParams,
  searchParamsToTableQuery,
  type TableQueryParams,
  type TableQueryUrlOptions
} from './table-query';

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
 * full navigation). Starts from the current URL, applies `next`, and keeps
 * every unrelated param.
 *
 * Merge semantics per key in `next`: the key is first cleared, then re-applied
 * — a `URLSearchParams` re-appends all of its entries (repeated keys survive),
 * a record `set`s a scalar, `append`s each array element, and **removes** the
 * key entirely for a `null`/`undefined` value.
 *
 * @param next - Params to apply, as `URLSearchParams` or a plain record. A
 *   record value of `null`/`undefined` deletes that key.
 * @param opts - `replaceState` (default `true`) — replace vs. push history.
 * @example
 * ```typescript
 * updateUrlSearchParams({ page: '1', tag: ['a', 'b'], filter: null });
 * // ?page=1&tag=a&tag=b   (any prior `filter` param is dropped)
 * ```
 */
// Local imperative use of URLSearchParams — not reactive state — so the
// SvelteURLSearchParams wrapper is unnecessary here. Likewise for `goto`:
// we pass constructed relative paths, not resolved route ids; callers of
// this helper are free to call `resolve()` at their composition point.
export function updateUrlSearchParams(
  next: URLSearchParams | Record<string, string | string[]>,
  opts?: { replaceState?: boolean }
) {
  const base = new URLSearchParams(page.url.searchParams);

  if (next instanceof URLSearchParams) {
    for (const [k] of next) base.delete(k);
    for (const [k, v] of next) base.append(k, v);
  } else {
    for (const [key, val] of Object.entries(next)) {
      base.delete(key);
      if (Array.isArray(val)) {
        for (const v of val) base.append(key, v);
      } else if (val != null) {
        base.set(key, String(val));
      }
    }
  }

  const q = base.toString();
  const path = page.url.pathname;
  goto(q ? `${path}?${q}` : path, {
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
 * re-append) and preserves the rest, then navigates with `goto`
 * (`replaceState`, `noScroll`, `keepFocus`).
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
    const current = new URLSearchParams(page.url.searchParams);
    const nextSp = options.serialize(next);
    for (const [k] of nextSp) current.delete(k);
    for (const [k, v] of nextSp) current.append(k, v);
    const q = current.toString();
    goto(q ? `?${q}` : page.url.pathname, {
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
  const getBound = () => get(page.url.searchParams);
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

/** Options for {@link createTableQueryUrlSync}. */
export interface TableQueryUrlSyncOptions extends TableQueryUrlOptions {
  /**
   * Replace the current history entry instead of pushing a new one. The
   * default (`true`) keeps every sort/filter/page interaction from polluting
   * the back button.
   * @default true
   */
  replaceState?: boolean;
}

/**
 * Opt-in URL sync for a table in server mode: mirrors the `TableQuery` the
 * table emits onto `?q=…&sort=…&page=…` query params, so the view state
 * survives reloads and can be shared as a link.
 *
 * Two directions, both explicit:
 * - **URL → query**: `initialQuery` is parsed once at creation (SSR-safe) —
 *   seed the table (`initialPage`, `initialGroupBy`, `initialSort`,
 *   `initialFilters`, controlled `searchTerm`) and run the first fetch from
 *   it. The seeds land before the table's first query emission, so URL sort/
 *   filter params survive it; note that a value restored via the table's
 *   `persistenceConfig` wins over an `initial*` seed for its axis.
 * - **query → URL**: pass `syncQuery` the query from `onQueryChange`, or call
 *   it inside `queryFn` (when `queryFn` is set, `onQueryChange` does not
 *   fire). It rewrites only its own — optionally prefixed — params via
 *   `goto` (`replaceState`, `noScroll`, `keepFocus`); unrelated params are
 *   preserved. Values equal to `options.defaults` are elided, so a table in
 *   its default state leaves the URL clean.
 *
 * Set `options.defaults` to the table's initial props (`itemsPerPage`,
 * `initialPage`, `initialGroupBy`) so the elision baseline matches the state
 * the table actually starts in.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { Table } from '@urbicon-ui/table';
 *   import { createTableQueryUrlSync } from '@urbicon-ui/sveltekit-utils/url.svelte';
 *
 *   const sync = createTableQueryUrlSync({ defaults: { itemsPerPage: 25 } });
 * </script>
 *
 * <Table
 *   mode="server"
 *   columns={columns}
 *   itemsPerPage={25}
 *   initialPage={sync.initialQuery.page}
 *   queryFn={async (query, { signal }) => {
 *     sync.syncQuery(query);
 *     const res = await fetch(`/api/users?${new URLSearchParams(...)}`, { signal });
 *     const data = await res.json();
 *     return { items: data.results, totalItems: data.total };
 *   }}
 * />
 * ```
 *
 * @param options - Elision defaults, key prefix, history behaviour.
 * @returns `initialQuery` (the URL parsed at creation time) + `syncQuery`
 *   (write a query back to the URL).
 */
export function createTableQueryUrlSync(options: TableQueryUrlSyncOptions = {}) {
  const initialQuery: TableQueryParams = searchParamsToTableQuery(page.url.searchParams, options);

  function syncQuery(query: TableQueryParams): void {
    const next = applyTableQueryToSearchParams(page.url.searchParams, query, options);
    const qs = next.toString();
    goto(`${page.url.pathname}${qs ? `?${qs}` : ''}${page.url.hash}`, {
      replaceState: options.replaceState ?? true,
      noScroll: true,
      keepFocus: true
    });
  }

  return { initialQuery, syncQuery } as const;
}
