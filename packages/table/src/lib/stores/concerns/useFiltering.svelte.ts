import type { Filter, FilterOperator, TableItem } from '$lib/types/tableTypes';
import { resolveColumnId, resolveColumnValue, resolveValueById } from '$lib/utils';
import type { TableState } from './types';

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
              return Number(value) > Number(filterValue);
            case 'lessThan':
              return Number(value) < Number(filterValue);
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
