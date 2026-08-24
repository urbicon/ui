import type { TableView } from '$lib/view/view.svelte';

/**
 * Search concern: manages the search term (the page-1-reset side effect), and
 * records whether the write that lands had already been debounced upstream.
 */
export function useSearch(view: TableView) {
  // Deliberately NOT `$state`: this is a one-shot hand-off between the search
  // bar's own timer and the next run of the managed fetch's effect — written
  // once, read once, cleared. As a signal it would make that effect depend on
  // its own consumption (a write inside the effect that read it).
  let writeWasDebounced = false;

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

  /**
   * Same write, marked: the caller has already waited out the typing (the
   * search bar's `searchDebounceMs` timer), so the fetch this write triggers
   * must not wait its own `source.debounceMs` on top — otherwise the two
   * delays add up and a keystroke sits 600 ms behind a 300 + 300 pair (#255).
   *
   * Marked only when the write actually lands. A term equal to the current one
   * changes no axis, triggers no fetch, and would leave the mark armed for
   * whatever unrelated view change came next — which would then skip a
   * debounce it was owed.
   */
  function setSearchDebounced(term: string) {
    if (view.search === term) return;
    writeWasDebounced = true;
    setSearch(term);
  }

  /**
   * One-shot read for the fetch layer: `true` means the view change it is
   * about to react to came from an already-debounced search write. Reading
   * clears the mark.
   */
  function takeDebouncedSearchWrite(): boolean {
    const wasDebounced = writeWasDebounced;
    writeWasDebounced = false;
    return wasDebounced;
  }

  return {
    setSearch,
    setSearchDebounced,
    takeDebouncedSearchWrite
  };
}
