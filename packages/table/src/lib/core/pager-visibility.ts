/**
 * Whether the table renders its pager.
 *
 * Extracted from the markup because every past version of this condition was an
 * unreadable one-liner in an `{#if}`, and #159 was one of its readings being
 * wrong with no test able to say so — reverting the fix in the template left the
 * whole suite green.
 *
 * The rule it encodes: **hide the pager only when there is genuinely nothing to
 * page.** Each clause below is a way that was once decided wrongly.
 */
export function shouldRenderPager(input: {
  /** `'client'` or `'server'`. */
  mode: string;
  /** Rows matching the current view on the SERVER — meaningless in client mode. */
  serverTotal: number;
  /** Rows the table holds after its own filtering — the whole result in client mode. */
  filteredCount: number;
  /** Is a grouping active? */
  grouped: boolean;
  /** Virtualized tables scroll instead of paging. */
  virtualized: boolean;
}): boolean {
  // Virtualization replaces paging with a scroll container, in both modes.
  if (input.virtualized) return false;

  if (input.mode === 'server') {
    // Grouping does NOT hide it here: the page is a slice of a larger result, so
    // the groups are page-local and the rest is only reachable by paging (#159).
    //
    // Neither does an empty page. The rows in hand are the wrong question in
    // server mode — a filter can narrow the result while the reader sits on
    // page 5, or a `?page=N` link can point past the end, and then the pager is
    // the only way back. The server's total is the right one.
    return input.serverTotal > 0;
  }

  // Client mode. Grouping suspends paging because the groups already hold every
  // row, and no rows means no result at all — here the rows in hand ARE the
  // whole result, so asking about them is sound.
  return input.filteredCount > 0 && !input.grouped;
}
