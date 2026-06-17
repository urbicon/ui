import type { TableState } from './types';

/**
 * Search concern: manages search term and advanced search toggle.
 */
export function useSearch(state: TableState) {
  function setSearchTerm(term: string) {
    state.searchTerm = term;
    state.currentPage = 1;
  }

  function toggleAdvancedSearch() {
    state.showAdvancedSearch = !state.showAdvancedSearch;
  }

  return {
    setSearchTerm,
    toggleAdvancedSearch
  };
}
