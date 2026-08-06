import type { TableState } from './types';

/**
 * Search concern: manages search term and advanced search toggle.
 */
export function useSearch(state: TableState) {
  function setSearchTerm(term: string) {
    // Page 1 belongs to a *new* search, not to re-applying the current one.
    // Without the guard, re-applying an unchanged term reset the page — so a
    // shared `?page=3&q=ada` rendered page 3 on the server and snapped back to
    // page 1 in the browser, which is the exact divergence putting the view in
    // the URL exists to remove (#152). The view object's own echo guard now
    // stops an identical write one layer earlier; this one keeps the reset
    // honest for callers that reach the setter directly.
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
