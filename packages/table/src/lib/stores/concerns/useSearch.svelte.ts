import type { TableView } from '$lib/view/view.svelte';

/**
 * Search concern: manages the search term (the page-1-reset side effect).
 */
export function useSearch(view: TableView) {
  function setSearch(term: string) {
    // Page 1 belongs to a *new* search, not to re-applying the current one.
    // Without the guard, re-applying an unchanged term reset the page — so a
    // shared `?page=3&q=ada` rendered page 3 on the server and snapped back to
    // page 1 in the browser, which is the exact divergence putting the view in
    // the URL exists to remove (#152). The view object's own echo guard now
    // stops an identical write one layer earlier; this one keeps the reset
    // honest for callers that reach the setter directly.
    if (view.search === term) return;
    view.search = term;
    view.page = 1;
  }

  return {
    setSearch
  };
}
