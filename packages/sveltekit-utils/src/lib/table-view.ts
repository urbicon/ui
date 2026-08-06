/**
 * URL (de)serialization for the v8 table view vocabulary (`TableView` from
 * `@urbicon-ui/table`: search, sort, page, pageSize, filters, groupBy).
 *
 * The types in this module are a **structural mirror** of the table package's
 * view types — deliberately not imported, so this package carries no
 * dependency on `@urbicon-ui/table`. A type-parity test over there guards the
 * shapes against drift; `bindViewToUrl` accepts any object shaped like
 * {@link TableViewLike}, which the real `TableView` is.
 *
 * The key scheme is the shipped one (`q`, `page`, `size`, `sort`, `dir`,
 * `group`, `filter`) — deep links written for v7 keep parsing. The write
 * side adds one compatible extension: an empty `filter=` marker, analogous
 * to `sort=`, so a cleared filter set elides like every other axis (the
 * shipped read side already tolerated it).
 */
import {
  TABLE_QUERY_FILTER_OPERATORS,
  type TableQueryFilter,
  type TableQueryParams
} from './table-query';

/** One of the six view axes. Mirrors `ViewAxis` from `@urbicon-ui/table`. */
export type TableViewAxis = 'search' | 'sort' | 'page' | 'pageSize' | 'filters' | 'groupBy';

/** All six view axes, in vocabulary order. */
export const TABLE_VIEW_AXES: readonly TableViewAxis[] = [
  'search',
  'sort',
  'page',
  'pageSize',
  'filters',
  'groupBy'
];

/** Sort state of a view. Mirrors `ViewSort` from `@urbicon-ui/table`. */
export interface TableViewSort {
  /** Column ID to sort by. */
  column: string;
  /** Sort direction. */
  direction: 'asc' | 'desc';
}

/**
 * A fully resolved view state — never `undefined` anywhere. Mirrors
 * `TableViewSnapshot` from `@urbicon-ui/table`.
 */
export interface TableViewSnapshot {
  search: string;
  sort: TableViewSort | null;
  page: number;
  pageSize: number;
  filters: TableQueryFilter[];
  groupBy: string | null;
}

/**
 * The surface {@link bindViewToUrl} needs from a view object — a structural
 * mirror of the table package's `TableView` class. Field reads are reactive,
 * field writes count as the reader's own change; `applyExternal` is the
 * binding write surface, `claimAxes`/`releaseAxes` the fail-loud composition
 * registry, and `originOf` the per-axis (revision, origin) bookkeeping the
 * bindings decide by.
 */
export interface TableViewLike {
  readonly defaults: TableViewSnapshot;
  search: string;
  sort: TableViewSort | null;
  page: number;
  pageSize: number;
  filters: TableQueryFilter[];
  groupBy: string | null;
  applyExternal(partial: Partial<TableViewSnapshot>, origin: 'external' | 'system'): void;
  claimAxes(kind: 'url' | 'storage', axes: readonly TableViewAxis[]): void;
  releaseAxes(kind: 'url' | 'storage', axes: readonly TableViewAxis[]): void;
  markInitApplied(axes: readonly TableViewAxis[]): void;
  wasInitApplied(axis: TableViewAxis): boolean;
  originOf(axis: TableViewAxis): {
    revision: number;
    origin: 'user' | 'external' | 'system' | 'init';
  };
  snapshot(): TableViewSnapshot;
}

/** URL keys per axis, unprefixed — the §3.2 key scheme, grouped by owning axis. */
const AXIS_KEYS: Record<TableViewAxis, readonly string[]> = {
  search: ['q'],
  sort: ['sort', 'dir'],
  page: ['page'],
  pageSize: ['size'],
  filters: ['filter'],
  groupBy: ['group']
};

/** The URL keys a set of axes owns, with the configured prefix applied. */
export function viewAxisKeys(axes: readonly TableViewAxis[], prefix = ''): string[] {
  return axes.flatMap((axis) => AXIS_KEYS[axis].map((key) => `${prefix}${key}`));
}

function isFilterOperator(value: string): value is TableQueryFilter['operator'] {
  return (TABLE_QUERY_FILTER_OPERATORS as readonly string[]).includes(value);
}

/** Same per-entry tolerance as the table-query parser: malformed → null → skipped. */
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
    return null;
  }
}

/** The axes a URL names — presence only for params it actually carries. */
export function viewAxesNamedBy(sp: URLSearchParams, prefix = ''): TableViewAxis[] {
  const axes: TableViewAxis[] = [];
  if (sp.get(`${prefix}q`) !== null) axes.push('search');
  if (sp.get(`${prefix}sort`) !== null) axes.push('sort');
  if (sp.get(`${prefix}page`) !== null) axes.push('page');
  if (sp.get(`${prefix}size`) !== null) axes.push('pageSize');
  if (sp.getAll(`${prefix}filter`).length > 0) axes.push('filters');
  if (sp.get(`${prefix}group`) !== null) axes.push('groupBy');
  return axes;
}

/**
 * Parse search params into a **partial** view snapshot — a key per axis the
 * URL actually carries, and nothing else. Read tolerant per key: an
 * unparsable value on a *present* key falls back to the configured default
 * for that axis (the key was present, so the axis stays claimed), and
 * malformed filter entries are skipped individually.
 */
export function searchParamsToViewPartial(
  sp: URLSearchParams,
  defaults: Pick<TableViewSnapshot, 'page' | 'pageSize'>,
  prefix = ''
): Partial<TableViewSnapshot> {
  const partial: Partial<TableViewSnapshot> = {};

  const rawSearch = sp.get(`${prefix}q`);
  if (rawSearch !== null) partial.search = rawSearch;

  const rawSort = sp.get(`${prefix}sort`);
  if (rawSort !== null) {
    partial.sort =
      rawSort === ''
        ? null // `sort: null` — "unsorted" is a value, not a sentinel
        : { column: rawSort, direction: sp.get(`${prefix}dir`) === 'desc' ? 'desc' : 'asc' };
  }

  const rawPage = sp.get(`${prefix}page`);
  if (rawPage !== null && /^\d+$/.test(rawPage) && Number(rawPage) >= 1) {
    partial.page = Number(rawPage);
  } else if (rawPage !== null) {
    partial.page = defaults.page;
  }

  const rawSize = sp.get(`${prefix}size`);
  if (rawSize !== null && /^\d+$/.test(rawSize) && Number(rawSize) >= 1) {
    partial.pageSize = Number(rawSize);
  } else if (rawSize !== null) {
    partial.pageSize = defaults.pageSize;
  }

  // `filter=` (empty marker) and `filter=a:contains:b` both claim the axis;
  // the empty marker claims it as *empty* — the compatible format extension.
  const rawFilters = sp.getAll(`${prefix}filter`);
  if (rawFilters.length > 0) {
    partial.filters = rawFilters
      .map(parseFilterParam)
      .filter((f): f is TableQueryFilter => f !== null);
  }

  const rawGroup = sp.get(`${prefix}group`);
  if (rawGroup !== null) partial.groupBy = rawGroup === '' ? null : rawGroup;

  return partial;
}

/**
 * Resolve a full view snapshot from search params: every axis the URL names
 * comes from the URL, every other one from `defaults` — the same resolution
 * the URL binding performs at init, for code that has no view (a server
 * `load`).
 */
export function searchParamsToViewSnapshot(
  sp: URLSearchParams,
  defaults: Partial<TableViewSnapshot> = {},
  prefix = ''
): TableViewSnapshot {
  const resolved = resolveViewDefaults(defaults);
  return { ...resolved, ...searchParamsToViewPartial(sp, resolved, prefix) };
}

/** Fill an unset axis with the table's own default — never `undefined` anywhere. */
function resolveViewDefaults(defaults: Partial<TableViewSnapshot>): TableViewSnapshot {
  return {
    search: defaults.search ?? '',
    sort: defaults.sort ?? null,
    page: defaults.page ?? 1,
    pageSize: defaults.pageSize ?? 10,
    filters: defaults.filters ?? [],
    groupBy: defaults.groupBy || null
  };
}

/**
 * Project a view snapshot into the wire shape a backend speaks — the same
 * mapping the table applies before calling a managed `source.query`, so a
 * server `load` and the table's own fetches send identical field names.
 */
export function viewSnapshotToTableQuery(snapshot: TableViewSnapshot): TableQueryParams {
  return {
    page: snapshot.page,
    itemsPerPage: snapshot.pageSize,
    sortColumn: snapshot.sort?.column ?? '',
    sortDirection: snapshot.sort?.direction ?? 'asc',
    searchTerm: snapshot.search,
    activeFilters: [...snapshot.filters],
    groupByKey: snapshot.groupBy
  };
}

/**
 * The load-path counterpart of the URL binding: parse search params against
 * the **view's own defaults** and hand back the query a fetch needs.
 *
 * The point is the defaults argument. `searchParamsToTableQuery` takes its
 * baseline in the wire vocabulary (`itemsPerPage`, `sortColumn`/`sortDirection`,
 * `groupByKey`) and has no field for filters at all, so a `load` had to keep a
 * second, differently-spelled copy of what `createTableView({ defaults })`
 * already says — and could not express a default filter set no matter how it
 * was written (#157 finding 2). This one takes the very object the view takes:
 * one spelling, all six axes, so the server cannot resolve an absent param
 * differently from the client.
 *
 * @example
 * ```ts
 * // shared with the component that calls createTableView({ defaults })
 * export const invoiceView = { pageSize: 25, sort: { column: 'date', direction: 'desc' } };
 *
 * export const load = async ({ url }) => ({
 *   initialResult: await fetchInvoices(searchParamsToViewQuery(url.searchParams, invoiceView))
 * });
 * ```
 */
export function searchParamsToViewQuery(
  sp: URLSearchParams,
  defaults: Partial<TableViewSnapshot> = {},
  prefix = ''
): TableQueryParams {
  return viewSnapshotToTableQuery(searchParamsToViewSnapshot(sp, defaults, prefix));
}

/**
 * Serialize a snapshot, eliding every axis that equals the defaults — the
 * elision baseline *is* the view's defaults, structurally. `axes` restricts
 * the output to a binding's own axes: an unbound axis never reaches the URL,
 * no matter what the view holds.
 */
export function viewSnapshotToSearchParams(
  snapshot: TableViewSnapshot,
  defaults: TableViewSnapshot,
  axes: readonly TableViewAxis[] = TABLE_VIEW_AXES,
  prefix = ''
): URLSearchParams {
  const sp = new URLSearchParams();
  const bound = (axis: TableViewAxis) => axes.includes(axis);

  if (bound('search') && snapshot.search !== defaults.search) sp.set(`${prefix}q`, snapshot.search);
  if (bound('page') && snapshot.page !== defaults.page)
    sp.set(`${prefix}page`, String(snapshot.page));
  if (bound('pageSize') && snapshot.pageSize !== defaults.pageSize)
    sp.set(`${prefix}size`, String(snapshot.pageSize));

  // `bound('sort')` gates BOTH branches — gating only the null-mismatch one
  // let an unbound sort leak into the URL (an operator-precedence slip the
  // spike caught; pinned by the axis-subset test).
  const sortDiffers =
    bound('sort') &&
    ((snapshot.sort === null) !== (defaults.sort === null) ||
      (snapshot.sort !== null &&
        defaults.sort !== null &&
        (snapshot.sort.column !== defaults.sort.column ||
          snapshot.sort.direction !== defaults.sort.direction)));
  if (sortDiffers) {
    if (snapshot.sort === null) {
      sp.set(`${prefix}sort`, ''); // explicitly unsorted — only reachable when defaults sort
    } else {
      sp.set(`${prefix}sort`, snapshot.sort.column);
      if (snapshot.sort.direction === 'desc') sp.set(`${prefix}dir`, 'desc');
    }
  }

  if (bound('groupBy') && snapshot.groupBy !== defaults.groupBy)
    sp.set(`${prefix}group`, snapshot.groupBy ?? '');

  const filtersDiffer =
    bound('filters') &&
    (snapshot.filters.length !== defaults.filters.length ||
      snapshot.filters.some(
        (f, i) =>
          f.column !== defaults.filters[i].column ||
          f.operator !== defaults.filters[i].operator ||
          f.value !== defaults.filters[i].value
      ));
  if (filtersDiffer) {
    if (snapshot.filters.length === 0) {
      // The format extension: an empty marker, analogous to `sort=`, so a
      // cleared filter set elides like every other axis.
      sp.set(`${prefix}filter`, '');
    } else {
      for (const filter of snapshot.filters) {
        sp.append(
          `${prefix}filter`,
          `${encodeURIComponent(filter.column)}:${filter.operator}:${encodeURIComponent(filter.value)}`
        );
      }
    }
  }

  return sp;
}
