import type { Filter, FilterOperator, TableItem } from '$lib/types/tableTypes';
import { resolveColumnId, resolveColumnValue, resolveValueById } from '$lib/utils';
import type { TableState } from './types';

/**
 * ISO-8601 calendar date without a time of day (`2021-03-15`) — the shape an
 * `<input type="date">` emits, and the shape that makes `after`/`before`
 * compare on day granularity.
 */
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** ISO-8601 date + time, optionally with seconds, millis and a UTC offset. */
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/i;

const MS_PER_DAY = 86_400_000;

/**
 * Converts a cell or filter value into an epoch-millisecond instant, or `NaN`
 * when it is not a date at all.
 *
 * Accepted: `Date` instances (`getTime()`), numbers (already epoch millis) and
 * ISO-8601 strings. String parsing is deliberately gated on the two ISO shapes
 * above and normalised to the exact grammar `Date.parse` is *specified* for —
 * every other string is `NaN` rather than being handed to the engine's lenient
 * fallback parser, whose results are implementation-defined and must not decide
 * which rows a filter shows.
 *
 * Time-zone rule (per the ECMAScript date-time string format): a date-only
 * string is UTC midnight, a date-time string *without* an offset is local time.
 */
function toInstant(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;

  const text = value.trim();
  if (!ISO_DATE_ONLY.test(text) && !ISO_DATE_TIME.test(text)) return Number.NaN;
  return Date.parse(text.toUpperCase().replace(' ', 'T'));
}

/**
 * Date-aware `greaterThan`/`lessThan` ("after"/"before" for `dataType: 'date'`
 * columns), used only when the numeric comparison does not apply.
 *
 * When the *filter* value is a bare calendar date, both operators compare on
 * day granularity against UTC day boundaries — `after 2021-03-15` starts at
 * `2021-03-16T00:00Z`, `before 2021-03-15` ends at `2021-03-15T00:00Z` — so an
 * item at `2021-03-15T09:00Z` matches neither. A filter value *with* a time of
 * day compares instants strictly.
 *
 * Returns `false` when either side is not a date, so an empty or malformed
 * filter value never leaks a `NaN` comparison into a match.
 */
function matchesDateComparison(
  rawItemValue: unknown,
  filterValue: string,
  operator: 'greaterThan' | 'lessThan'
): boolean {
  const itemInstant = toInstant(rawItemValue);
  if (Number.isNaN(itemInstant)) return false;

  const text = filterValue.trim();
  const filterInstant = toInstant(text);
  if (Number.isNaN(filterInstant)) return false;

  if (ISO_DATE_ONLY.test(text)) {
    return operator === 'greaterThan'
      ? itemInstant >= filterInstant + MS_PER_DAY
      : itemInstant < filterInstant;
  }

  return operator === 'greaterThan' ? itemInstant > filterInstant : itemInstant < filterInstant;
}

/**
 * Filtering concern: manages active filters and computes filtered items.
 * Combines search-term matching and advanced filter matching.
 *
 * Values for both search and filter matching come from the column's
 * accessor (string property or function), not a raw `getNestedValue` —
 * which keeps object-typed properties and computed columns honest.
 */
export function useFiltering(state: TableState) {
  const filteredItems = $derived.by((): TableItem[] => {
    if (!state.items.length) return [];

    // In server mode, items are already filtered by the server
    if (state.mode === 'server') return state.items;

    return state.items.filter((item) => {
      const matchesSearchTerm =
        state.searchTerm === '' ||
        state.columns
          // Discriminate synthetic columns first — afterwards TS narrows to
          // DataColumnString | DataColumnFunction, which carries `searchable`.
          .filter((col) => col.accessor !== undefined && col.searchable !== false)
          .some((column) => {
            const raw = resolveColumnValue(column, item);
            // Object/array values stringify to "[object Object]" and produce
            // misleading matches. Treat them as no-match unless the column
            // explicitly opts in via a string-returning accessor/formatter.
            if (raw !== null && typeof raw === 'object' && !(raw instanceof Date)) {
              return false;
            }
            const value = raw === null || raw === undefined ? '' : String(raw);
            return value.toLowerCase().includes(state.searchTerm.toLowerCase());
          });

      const matchesFilters =
        state.activeFilters.length === 0 ||
        state.activeFilters.every((filter) => {
          const raw = resolveValueById(state.columns, item, filter.column);
          const value = String(raw ?? '').toLowerCase();
          const filterValue = filter.value.toLowerCase();

          switch (filter.operator) {
            case 'contains':
              return value.includes(filterValue);
            case 'equals':
              return value === filterValue;
            case 'startsWith':
              return value.startsWith(filterValue);
            case 'endsWith':
              return value.endsWith(filterValue);
            case 'greaterThan':
            case 'lessThan': {
              // Numbers keep the historical `Number()` comparison (prices,
              // counts, epoch timestamps) — unchanged for existing consumers.
              // Only when that does not apply (either side not a number) do we
              // retry as dates, which is what the "after"/"before" operators of
              // a `dataType: 'date'` column need.
              const itemNumber = Number(value);
              const filterNumber = Number(filterValue);
              if (!Number.isNaN(itemNumber) && !Number.isNaN(filterNumber)) {
                return filter.operator === 'greaterThan'
                  ? itemNumber > filterNumber
                  : itemNumber < filterNumber;
              }
              // Both sides go in raw, not through the lowercased string: the
              // date path needs the `Date`/number instance, not its `String()`
              // rendering.
              return matchesDateComparison(raw, filter.value, filter.operator);
            }
            default:
              if (import.meta.env?.DEV)
                console.warn(
                  `[Table] Unknown filter operator "${filter.operator}" — row excluded.`
                );
              return false;
          }
        });

      return matchesSearchTerm && matchesFilters;
    });
  });

  function addFilter(filter: Filter) {
    state.activeFilters = [...state.activeFilters, filter];
    state.currentPage = 1;
  }

  function removeFilter(index: number) {
    state.activeFilters = state.activeFilters.filter((_, i) => i !== index);
    state.currentPage = 1;
  }

  function removeFiltersByColumn(column: string, operator?: FilterOperator, value?: string) {
    state.activeFilters = state.activeFilters.filter((filter) => {
      if (filter.column !== column) return true;
      if (operator && filter.operator !== operator) return true;
      if (value && filter.value !== value) return true;
      return false;
    });
    state.currentPage = 1;
  }

  function clearAllFilters() {
    state.activeFilters = [];
    state.currentPage = 1;
  }

  function hasFilterForColumn(column: string, operator?: FilterOperator, value?: string): boolean {
    return state.activeFilters.some((filter) => {
      if (filter.column !== column) return false;
      if (operator && filter.operator !== operator) return false;
      if (value && filter.value !== value) return false;
      return true;
    });
  }

  return {
    get filteredItems() {
      return filteredItems;
    },
    addFilter,
    removeFilter,
    removeFiltersByColumn,
    clearAllFilters,
    hasFilterForColumn
  };
}

// Re-exported so concerns that compose useFiltering can keep their column-id
// resolution consistent without re-importing the util path.
export { resolveColumnId };
