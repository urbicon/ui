import type { TableState } from './types';

/**
 * Search concern: manages search term and advanced search toggle.
 */
export function useSearch(state: TableState) {
  function setSearchTerm(term: string) {
    // Page 1 belongs to a *new* search, not to re-applying the current one.
    // Without the guard, `TableProvider`'s mount effect for the controlled
    // `searchTerm` prop reset the page on hydration even when the term had not
    // moved — so a shared `?page=3&q=ada` rendered page 3 on the server and
    // snapped back to page 1 in the browser, which is the exact divergence the
    // controlled `query` prop exists to remove (#152).
    if (state.searchTerm === term) return;
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
