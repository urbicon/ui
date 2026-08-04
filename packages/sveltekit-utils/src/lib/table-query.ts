/**
 * URL (de)serialization for the query state a data table emits in server mode
 * (`TableQuery` from `@urbicon-ui/table`: page, page size, sort, search term,
 * column filters, grouping).
 *
 * The types in this module are a **structural mirror** of `TableQuery` — they
 * are deliberately not imported from `@urbicon-ui/table`, so this package
 * carries no dependency on the table package. Any object shaped like
 * `TableQuery` is accepted; a type-parity test in `@urbicon-ui/table` guards
 * the two shapes against drift.
 *
 * Serialization contract:
 * - **Deterministic** — fixed key order (`q`, `page`, `size`, `sort`, `dir`,
 *   `group`, `filter`), stable filter order.
 * - **Default elision** — values equal to the resolved defaults are not
 *   written; a table in its default state produces an empty query string.
 * - **Read tolerant** — unparsable params fall back to the defaults, and
 *   malformed filter entries are skipped.
 * - **Write strict** — a structurally invalid query (non-positive page,
 *   unknown filter operator, …) throws instead of writing corrupt state.
 */

/** Sort direction of a table query. Mirrors `@urbicon-ui/table`. */
export type TableQuerySortDirection = 'asc' | 'desc';

/**
 * Filter operators supported by the table. Mirrors `FilterOperator` from
 * `@urbicon-ui/table`. Used as the runtime whitelist when parsing `filter`
 * params from the URL.
 */
export const TABLE_QUERY_FILTER_OPERATORS = [
  'contains',
  'equals',
  'startsWith',
  'endsWith',
  'greaterThan',
  'lessThan'
] as const;

/** Filter operator of a table query filter. Mirrors `@urbicon-ui/table`. */
export type TableQueryFilterOperator = (typeof TABLE_QUERY_FILTER_OPERATORS)[number];

/** Single column filter of a table query. Mirrors `Filter` from `@urbicon-ui/table`. */
export interface TableQueryFilter {
  /** Column ID the filter applies to. */
  column: string;
  /** Filter operator. */
  operator: TableQueryFilterOperator;
  /** Filter value (always a string, numeric operators convert internally). */
  value: string;
}

/**
 * Query state of a table in server mode. Structural mirror of `TableQuery`
 * from `@urbicon-ui/table` — the object passed to `queryFn` / `onQueryChange`
 * is directly assignable.
 */
export interface TableQueryParams {
  /** Current page (1-based). */
  page: number;
  /** Number of items per page. */
  itemsPerPage: number;
  /** Column ID to sort by, or empty string if no sort is active. */
  sortColumn: string;
  /** Sort direction. */
  sortDirection: TableQuerySortDirection;
  /** Full-text search term. */
  searchTerm: string;
  /** Active column filters. */
  activeFilters: TableQueryFilter[];
  /** Column ID for grouping, or null if ungrouped. */
  groupByKey: string | null;
}

/**
 * The partial half of {@link TableQueryParams} — structural mirror of
 * `TableViewState` from `@urbicon-ui/table`, the type its `query` prop takes.
 *
 * Every field optional, and that is the whole contract: **presence means
 * controlled**. A consumer may hand over the sort and leave paging to the
 * table, so "absent" has to stay distinguishable from "set to its default
 * value" — which is exactly what {@link TableQueryParams} cannot express.
 */
export interface TableQueryViewState {
  /** Current page (1-based). */
  page?: number;
  /** Number of items per page. */
  itemsPerPage?: number;
  /** Column ID to sort by, or empty string for no sort. */
  sortColumn?: string;
  /** Sort direction. */
  sortDirection?: TableQuerySortDirection;
  /** Full-text search term. */
  searchTerm?: string;
  /** Active column filters. */
  activeFilters?: TableQueryFilter[];
  /** Column ID for grouping, or null for ungrouped. */
  groupByKey?: string | null;
}

/**
 * Baseline used for default elision: query values equal to these defaults are
 * omitted from the URL, and missing params parse back to them.
 *
 * Set the defaults to the table's **initial, uncontrolled state** — i.e. the
 * values you pass as props (`itemsPerPage`, `initialPage`, `initialGroupBy`).
 * Unset fields fall back to the table's own defaults (page 1, 10 items per
 * page, no sort, empty search, ungrouped).
 */
export interface TableQueryDefaults {
  /** Default page. @default 1 */
  page?: number;
  /** Default page size. @default 10 */
  itemsPerPage?: number;
  /** Default sort column ('' = unsorted). @default '' */
  sortColumn?: string;
  /** Default sort direction. @default 'asc' */
  sortDirection?: TableQuerySortDirection;
  /** Default search term. @default '' */
  searchTerm?: string;
  /** Default group key (null = ungrouped). @default null */
  groupByKey?: string | null;
}

/** Options shared by the table-query (de)serializers. */
export interface TableQueryUrlOptions {
  /** Elision baseline — see {@link TableQueryDefaults}. */
  defaults?: TableQueryDefaults;
  /**
   * Prefix for every param key (`prefix: 't_'` → `?t_q=…&t_page=…`). Use it
   * to namespace multiple synced tables on the same page.
   * @default ''
   */
  prefix?: string;
}

/** Resolved param key names for one prefix. */
function paramKeys(prefix: string) {
  return {
    q: `${prefix}q`,
    page: `${prefix}page`,
    size: `${prefix}size`,
    sort: `${prefix}sort`,
    dir: `${prefix}dir`,
    group: `${prefix}group`,
    filter: `${prefix}filter`
  } as const;
}

function resolveDefaults(defaults?: TableQueryDefaults): Required<TableQueryDefaults> {
  return {
    page: defaults?.page ?? 1,
    itemsPerPage: defaults?.itemsPerPage ?? 10,
    sortColumn: defaults?.sortColumn ?? '',
    sortDirection: defaults?.sortDirection ?? 'asc',
    searchTerm: defaults?.searchTerm ?? '',
    groupByKey: defaults?.groupByKey ?? null
  };
}

function isFilterOperator(value: string): value is TableQueryFilterOperator {
  return (TABLE_QUERY_FILTER_OPERATORS as readonly string[]).includes(value);
}

/** Write-side validation: never serialize structurally invalid state. */
function assertValidQuery(query: TableQueryParams): void {
  if (!Number.isSafeInteger(query.page) || query.page < 1) {
    throw new TypeError(`[table-query] page must be a positive integer, got ${query.page}`);
  }
  if (!Number.isSafeInteger(query.itemsPerPage) || query.itemsPerPage < 1) {
    throw new TypeError(
      `[table-query] itemsPerPage must be a positive integer, got ${query.itemsPerPage}`
    );
  }
  if (query.sortDirection !== 'asc' && query.sortDirection !== 'desc') {
    throw new TypeError(
      `[table-query] sortDirection must be 'asc' or 'desc', got ${String(query.sortDirection)}`
    );
  }
  if (query.groupByKey === '') {
    throw new TypeError("[table-query] groupByKey must be a non-empty string or null, got ''");
  }
  for (const filter of query.activeFilters) {
    if (!filter.column) {
      throw new TypeError('[table-query] filter.column must be a non-empty string');
    }
    if (!isFilterOperator(filter.operator)) {
      throw new TypeError(
        `[table-query] unknown filter operator '${String(filter.operator)}' on column '${filter.column}'`
      );
    }
  }
}

/** Read-side tolerant integer parsing: anything non-numeric → null. */
function parsePositiveInt(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

/**
 * Parse one `filter` param value (`<column>:<operator>:<value>`, column and
 * value URI-component-encoded). Returns null for malformed entries — the
 * caller skips them (read tolerant).
 */
function parseFilterParam(raw: string): TableQueryFilter | null {
  const parts = raw.split(':');
  if (parts.length !== 3) return null;
  const [encodedColumn, operator, encodedValue] = parts;
  if (!isFilterOperator(operator)) return null;
  try {
    const column = decodeURIComponent(encodedColumn);
    if (!column) return null;
    return { column, operator, value: decodeURIComponent(encodedValue) };
  } catch {
    // Malformed percent-encoding (URIError) — skip the entry.
    return null;
  }
}

/**
 * Serialize a table query into `URLSearchParams`, eliding every value that
 * equals the resolved defaults (see {@link TableQueryDefaults}).
 *
 * Key scheme (each key optionally prefixed via `options.prefix`):
 * - `q` — search term
 * - `page` — 1-based page
 * - `size` — items per page
 * - `sort` — sort column; an **empty** `sort=` marks "explicitly unsorted"
 *   and is only written when the defaults specify a sort column
 * - `dir` — `desc` (ascending is implied when absent)
 * - `group` — group key; an empty `group=` marks "explicitly ungrouped"
 * - `filter` — repeated, `<column>:<operator>:<value>` with column and value
 *   URI-component-encoded so the `:` separators stay unambiguous
 *
 * When `sortColumn` is empty the sort direction is meaningless and is
 * normalized away (it parses back as `'asc'`).
 *
 * Also handy for building the backend request inside `queryFn` — the same
 * scheme works as an API query string.
 *
 * @param query - Query emitted by the table (`TableQuery` is assignable).
 * @param options - Elision defaults + key prefix.
 * @returns Fresh `URLSearchParams` containing only non-default values.
 * @throws TypeError when the query is structurally invalid (write strict).
 */
export function tableQueryToSearchParams(
  query: TableQueryParams,
  options: TableQueryUrlOptions = {}
): URLSearchParams {
  assertValidQuery(query);
  const d = resolveDefaults(options.defaults);
  const k = paramKeys(options.prefix ?? '');
  const sp = new URLSearchParams();

  if (query.searchTerm !== d.searchTerm) sp.set(k.q, query.searchTerm);
  if (query.page !== d.page) sp.set(k.page, String(query.page));
  if (query.itemsPerPage !== d.itemsPerPage) sp.set(k.size, String(query.itemsPerPage));

  if (query.sortColumn === '') {
    // Unsorted: only mark explicitly when the defaults would re-introduce a sort.
    if (d.sortColumn !== '') sp.set(k.sort, '');
  } else if (query.sortColumn !== d.sortColumn || query.sortDirection !== d.sortDirection) {
    sp.set(k.sort, query.sortColumn);
    if (query.sortDirection === 'desc') sp.set(k.dir, 'desc');
  }

  if (query.groupByKey !== d.groupByKey) sp.set(k.group, query.groupByKey ?? '');

  for (const filter of query.activeFilters) {
    sp.append(
      k.filter,
      `${encodeURIComponent(filter.column)}:${filter.operator}:${encodeURIComponent(filter.value)}`
    );
  }

  return sp;
}

/**
 * Parse `URLSearchParams` back into a full table query, filling every missing
 * param from the resolved defaults (see {@link TableQueryDefaults}).
 *
 * Read tolerant: non-numeric `page`/`size` fall back to the defaults, an
 * unknown `dir` becomes `'asc'`, and malformed `filter` entries (wrong shape,
 * unknown operator, broken percent-encoding) are skipped individually.
 *
 * Works anywhere a `URLSearchParams` exists — including `url.searchParams`
 * in a server `load`, to run the initial server-mode fetch during SSR.
 *
 * @param params - Search params to read (not mutated).
 * @param options - Fallback defaults + key prefix.
 * @returns Complete query object (assignable to `TableQuery`).
 */
export function searchParamsToTableQuery(
  params: URLSearchParams,
  options: TableQueryUrlOptions = {}
): TableQueryParams {
  const d = resolveDefaults(options.defaults);
  const k = paramKeys(options.prefix ?? '');

  let sortColumn = d.sortColumn;
  let sortDirection = d.sortDirection;
  const rawSort = params.get(k.sort);
  if (rawSort !== null) {
    sortColumn = rawSort;
    sortDirection = rawSort !== '' && params.get(k.dir) === 'desc' ? 'desc' : 'asc';
  }

  const rawGroup = params.get(k.group);

  const activeFilters: TableQueryFilter[] = [];
  for (const raw of params.getAll(k.filter)) {
    const filter = parseFilterParam(raw);
    if (filter) activeFilters.push(filter);
  }

  return {
    page: parsePositiveInt(params.get(k.page)) ?? d.page,
    itemsPerPage: parsePositiveInt(params.get(k.size)) ?? d.itemsPerPage,
    sortColumn,
    sortDirection,
    searchTerm: params.get(k.q) ?? d.searchTerm,
    activeFilters,
    groupByKey: rawGroup !== null ? (rawGroup === '' ? null : rawGroup) : d.groupByKey
  };
}

/**
 * Parse `URLSearchParams` into the **partial** view state a table's `query`
 * prop takes — a key per axis the URL actually carries, and nothing else.
 *
 * This is the deliberate opposite of {@link searchParamsToTableQuery}, and the
 * distinction is load-bearing rather than cosmetic. The table reads `query` by
 * **field presence**: a present field means "this axis is controlled — outrank
 * persistence and the `initial*` seed"; an absent one means "the URL has no
 * opinion, carry on". A complete object therefore claims every axis, so
 * handing `searchParamsToTableQuery`'s output to `query` silently switches off
 * `persistenceConfig`, `initialSort`, `initialFilters` and `initialGroupBy` —
 * even on a URL with no params at all, where its every field is a default it
 * invented. That is not a hypothetical: it was the shipped wiring, and this
 * function exists because of it.
 *
 * `sortColumn` and `sortDirection` are emitted as a pair or not at all, so the
 * half-controlled sort (a direction with no column) cannot be produced here.
 *
 * Same tolerance as the full parser: an unparsable `page`/`size` falls back to
 * the resolved default *for that key* — the key was present, so the axis stays
 * controlled — and malformed filters are skipped individually.
 *
 * @param params - Search params to read (not mutated).
 * @param options - Fallback defaults + key prefix.
 * @returns Only the axes present in `params`.
 */
export function searchParamsToTableViewState(
  params: URLSearchParams,
  options: TableQueryUrlOptions = {}
): TableQueryViewState {
  const d = resolveDefaults(options.defaults);
  const k = paramKeys(options.prefix ?? '');
  const view: TableQueryViewState = {};

  const rawPage = params.get(k.page);
  if (rawPage !== null) view.page = parsePositiveInt(rawPage) ?? d.page;

  const rawSize = params.get(k.size);
  if (rawSize !== null) view.itemsPerPage = parsePositiveInt(rawSize) ?? d.itemsPerPage;

  const rawSort = params.get(k.sort);
  if (rawSort !== null) {
    view.sortColumn = rawSort;
    view.sortDirection = rawSort !== '' && params.get(k.dir) === 'desc' ? 'desc' : 'asc';
  }

  const rawSearch = params.get(k.q);
  if (rawSearch !== null) view.searchTerm = rawSearch;

  const rawFilters = params.getAll(k.filter);
  if (rawFilters.length > 0) {
    const activeFilters: TableQueryFilter[] = [];
    for (const raw of rawFilters) {
      const filter = parseFilterParam(raw);
      if (filter) activeFilters.push(filter);
    }
    view.activeFilters = activeFilters;
  }

  const rawGroup = params.get(k.group);
  if (rawGroup !== null) view.groupByKey = rawGroup === '' ? null : rawGroup;

  return view;
}

/**
 * Merge a table query into existing search params: all managed keys (`q`,
 * `page`, `size`, `sort`, `dir`, `group`, `filter` — with the configured
 * prefix) are replaced by the serialized query, every other param is
 * preserved untouched. Managed keys whose value returned to the default are
 * removed (default elision).
 *
 * @param existing - Current search params (not mutated — a copy is returned).
 * @param query - Query emitted by the table.
 * @param options - Elision defaults + key prefix.
 * @returns New `URLSearchParams` with the query applied.
 * @throws TypeError when the query is structurally invalid (write strict).
 */
export function applyTableQueryToSearchParams(
  existing: URLSearchParams,
  query: TableQueryParams,
  options: TableQueryUrlOptions = {}
): URLSearchParams {
  const serialized = tableQueryToSearchParams(query, options);
  const next = new URLSearchParams(existing);
  for (const key of Object.values(paramKeys(options.prefix ?? ''))) {
    next.delete(key);
  }
  for (const [key, value] of serialized) {
    next.append(key, value);
  }
  return next;
}
