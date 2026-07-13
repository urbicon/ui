import { goto } from '$app/navigation';
import { page } from '$app/state';
import {
  applyTableQueryToSearchParams,
  searchParamsToTableQuery,
  type TableQueryParams,
  type TableQueryUrlOptions
} from './table-query';

export type UrlArrayStrategy = 'repeat' | 'csv';

export type UrlParamOptions<T> = {
  parse: (sp: URLSearchParams) => T | null | undefined;
  serialize: (value: T) => URLSearchParams;
  initial: T;
  replaceState?: boolean;
};

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

export function useUrlParam<T>(key: string, options: UrlParamOptions<T>) {
  const { get, set } = createUrlParam<T>(key, options);
  const getBound = () => get(page.url.searchParams);
  return [getBound, set] as const;
}

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
 *   seed the table (`initialPage`, `initialGroupBy`, controlled `searchTerm`)
 *   and run the first fetch from it.
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
