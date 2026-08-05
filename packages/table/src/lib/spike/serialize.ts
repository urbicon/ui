/**
 * SPIKE §3.2 — (de)serialisation between the v8 view vocabulary and the
 * existing URL key scheme (`q`, `page`, `size`, `sort`, `dir`, `group`,
 * `filter`). The read side is format-stable with today's
 * `searchParamsToTableViewState`; the write side adds the one extension the
 * design's §3.2 footnote names: an empty `filter=` marker, so a cleared
 * filter set elides like every other axis (Prüfstein 8/23).
 */
import type { Filter } from '$lib/types/tableTypes';
import type { TableViewSnapshot, ViewAxis, ViewSort } from './view.svelte';

const FILTER_OPERATORS = [
  'contains',
  'equals',
  'startsWith',
  'endsWith',
  'greaterThan',
  'lessThan'
] as const;

function parseFilterParam(raw: string): Filter | null {
  const parts = raw.split(':');
  if (parts.length !== 3) return null;
  const [encodedColumn, operator, encodedValue] = parts;
  if (!(FILTER_OPERATORS as readonly string[]).includes(operator)) return null;
  try {
    const column = decodeURIComponent(encodedColumn);
    if (!column) return null;
    return {
      column,
      operator: operator as Filter['operator'],
      value: decodeURIComponent(encodedValue)
    };
  } catch {
    return null;
  }
}

/**
 * The axes a URL names, in the v8 vocabulary — presence only for params the
 * URL actually carries. Same per-key tolerance as the shipped parser,
 * including its fallback target: an unparsable value on a present key falls
 * back to the CONFIGURED default for that axis (review n3 — the first draft
 * hard-coded page 1 / size 10, which diverged from the shipped
 * `resolveDefaults` behaviour once `viewDefaults.pageSize` was set).
 */
export function searchParamsToViewPartial(
  sp: URLSearchParams,
  defaults?: Pick<TableViewSnapshot, 'page' | 'pageSize'>
): Partial<TableViewSnapshot> {
  const partial: Partial<TableViewSnapshot> = {};

  const rawSearch = sp.get('q');
  if (rawSearch !== null) partial.search = rawSearch;

  const rawSort = sp.get('sort');
  if (rawSort !== null) {
    partial.sort =
      rawSort === ''
        ? null // `sort: null` instead of the '' sentinel — "unsorted" is a value (§3.2)
        : { column: rawSort, direction: sp.get('dir') === 'desc' ? 'desc' : 'asc' };
  }

  const rawPage = sp.get('page');
  if (rawPage !== null && /^\d+$/.test(rawPage) && Number(rawPage) >= 1) {
    partial.page = Number(rawPage);
  } else if (rawPage !== null) {
    partial.page = defaults?.page ?? 1; // key present → axis claimed, value falls back
  }

  const rawSize = sp.get('size');
  if (rawSize !== null && /^\d+$/.test(rawSize) && Number(rawSize) >= 1) {
    partial.pageSize = Number(rawSize);
  } else if (rawSize !== null) {
    partial.pageSize = defaults?.pageSize ?? 10;
  }

  // `filter=` (empty marker) and `filter=a:contains:b` both claim the axis;
  // the empty marker claims it as *empty* — the §3.2 format extension. The
  // shipped read side already tolerates the marker (measured in
  // spike.composition.svelte.test.ts against the real sveltekit-utils parser).
  const rawFilters = sp.getAll('filter');
  if (rawFilters.length > 0) {
    partial.filters = rawFilters.map(parseFilterParam).filter((f): f is Filter => f !== null);
  }

  const rawGroup = sp.get('group');
  if (rawGroup !== null) partial.groupBy = rawGroup === '' ? null : rawGroup;

  return partial;
}

/**
 * Serialize a snapshot, eliding every axis that equals the defaults — the
 * elision baseline *is* the view's defaults, structurally (Prüfstein 7).
 * `axes` restricts the output to a binding's own axes: an unbound axis never
 * reaches the URL, no matter what the view holds.
 */
export function viewToSearchParams(
  snapshot: TableViewSnapshot,
  defaults: TableViewSnapshot,
  axes: readonly ViewAxis[] = ['search', 'sort', 'page', 'pageSize', 'filters', 'groupBy']
): URLSearchParams {
  const sp = new URLSearchParams();
  const bound = (axis: ViewAxis) => axes.includes(axis);

  if (bound('search') && snapshot.search !== defaults.search) sp.set('q', snapshot.search);
  if (bound('page') && snapshot.page !== defaults.page) sp.set('page', String(snapshot.page));
  if (bound('pageSize') && snapshot.pageSize !== defaults.pageSize)
    sp.set('size', String(snapshot.pageSize));

  // `bound('sort')` must gate BOTH branches — the first draft gated only the
  // null-mismatch one (an operator-precedence slip Biome's re-format made
  // visible), so an unbound sort still leaked into the URL. Pinned by the
  // axis-subset test in spike.composition.
  const sortDiffers =
    bound('sort') &&
    ((snapshot.sort === null) !== (defaults.sort === null) ||
      (snapshot.sort !== null &&
        defaults.sort !== null &&
        (snapshot.sort.column !== defaults.sort.column ||
          snapshot.sort.direction !== defaults.sort.direction)));
  if (sortDiffers) {
    if (snapshot.sort === null) {
      sp.set('sort', ''); // explicitly unsorted — only reachable when defaults sort
    } else {
      sp.set('sort', snapshot.sort.column);
      if (snapshot.sort.direction === 'desc') sp.set('dir', 'desc');
    }
  }

  if (bound('groupBy') && snapshot.groupBy !== defaults.groupBy)
    sp.set('group', snapshot.groupBy ?? '');

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
      // The §3.2 format extension: an empty marker, analogous to `sort=`.
      sp.set('filter', '');
    } else {
      for (const filter of snapshot.filters) {
        sp.append(
          'filter',
          `${encodeURIComponent(filter.column)}:${filter.operator}:${encodeURIComponent(filter.value)}`
        );
      }
    }
  }

  return sp;
}

/** The axes a search string names — for init-claim bookkeeping. */
export function axesNamedBy(sp: URLSearchParams): ViewAxis[] {
  const axes: ViewAxis[] = [];
  if (sp.get('q') !== null) axes.push('search');
  if (sp.get('sort') !== null) axes.push('sort');
  if (sp.get('page') !== null) axes.push('page');
  if (sp.get('size') !== null) axes.push('pageSize');
  if (sp.getAll('filter').length > 0) axes.push('filters');
  if (sp.get('group') !== null) axes.push('groupBy');
  return axes;
}

/** Convenience for tests. */
export function sortOf(column: string, direction: 'asc' | 'desc' = 'asc'): ViewSort {
  return { column, direction };
}
