import type { TableView } from '$lib/view/view.svelte';

/**
 * Search concern: manages the search term (the page-1-reset side effect), and
 * records whether the delay for that write was already served upstream.
 */
export function useSearch(view: TableView) {
  // Deliberately NOT `$state`: this is a one-shot hand-off between the search
  // bar and the next run of the managed fetch's effect — written once, read
  // once, cleared. As a signal it would make that effect depend on its own
  // consumption (a write inside the effect that read it).
  let writeWasDebounced = false;

  /**
   * Write the term and reset to page 1 — and report whether the write landed.
   *
   * The boolean IS the landing condition, handed to the one caller that needs
   * it ({@link setSearchDebounced}) instead of copied there: a second
   * `view.search === term` beside this one is free to disagree with it, and
   * the disagreement would arm an exemption for a write that never happened.
   * Callers that ignore the return value (every other one) are unaffected —
   * the public `TableContext.setSearch` stays typed `void`.
   */
  function setSearch(term: string): boolean {
    // Page 1 belongs to a *new* search, not to re-applying the current one.
    // Without the guard, re-applying an unchanged term reset the page — so a
    // shared `?page=3&q=ada` rendered page 3 on the server and snapped back to
    // page 1 in the browser, which is the exact divergence putting the view in
    // the URL exists to remove (#152). The view object's own echo guard now
    // stops an identical write one layer earlier; this one keeps the reset
    // honest for callers that reach the setter directly.
    if (view.search === term) return false;
    view.search = term;
    view.page = 1;
    return true;
  }

  /**
   * The same write, marked: the caller owns the search delay and has already
   * served it, so the fetch this write triggers must not wait its own
   * `source.debounceMs` on top — otherwise the two add up and a keystroke
   * sits 600 ms behind a 300 + 300 pair (#255).
   *
   * "Served" includes a delay of zero: the search bar marks the write when
   * the consumer SET `searchDebounceMs` at all, so an explicit `0` means the
   * fetch goes out at once instead of waiting the source out.
   *
   * Marked only when the write lands. A term equal to the current one changes
   * no axis and triggers no fetch, so its mark would sit armed for whatever
   * unrelated view change came next — which would then skip a debounce it was
   * owed.
   */
  function setSearchDebounced(term: string): void {
    if (setSearch(term)) writeWasDebounced = true;
  }

  /**
   * One-shot read for the fetch layer: `true` means the view change it is
   * about to react to came from a search write whose delay was already
   * served. Reading clears the mark.
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
