import type { ProcessingMode } from '$lib/view/source';

/**
 * Everything the page resolution needs, read once from store state and view.
 * Plain values, not getters: the caller owns the reactivity (a `$derived`
 * around {@link resolvePageDescriptor}), this module owns only the decision.
 */
export interface PageDescriptorInput {
  mode: ProcessingMode;
  /** Rows matching the view on the SERVER — read only in the server modes. */
  serverTotal: number;
  /** Rows after the table's own filtering — read only in client mode, where it is the whole result. */
  filteredCount: number;
  /** Rows the table actually holds (`state.items.length`) — live updates can move it off the page size. */
  loadedCount: number;
  /** `view.page` — the reader's raw intent, which may sit out of range. */
  rawPage: number;
  pageSize: number;
  /** Is a grouping actually applied (`effectiveGroupBy`)? */
  grouped: boolean;
  virtualized: boolean;
}

/**
 * One resolved answer to "what page is this, out of how much" — for the pager,
 * the footer, the ARIA counts and the group wording alike.
 */
export interface PageDescriptor {
  mode: ProcessingMode;
  /** The backend sorts, filters, searches and pages — `mode !== 'client'`. */
  serverProcessed: boolean;
  /** The table drives the fetch lifecycle too — `mode === 'server-managed'`. */
  managed: boolean;
  /** How many rows match, wherever they live: the server total, or the filtered count. */
  totalItems: number;
  /** Page count over {@link totalItems} (min. 1; client-side grouping suspends paging → 1). */
  totalPages: number;
  /** The page actually rendered — {@link PageDescriptorInput.rawPage} clamped into range. */
  effectivePage: number;
  /**
   * The page a server fetch should ask for. Follows {@link effectivePage} —
   * the query asks for what is displayed, so an out-of-range deep link
   * recovers on the next fetch instead of stranding the reader on an empty
   * body — EXCEPT before any total is known (`totalItems === 0`), where the
   * clamp would collapse to 1 and flatten every legitimate `?page=3` link.
   * Until the first response, the raw intent is the honest request.
   */
  fetchPage: number;
  /** Rows actually held right now — what live updates have moved the page to. */
  loadedCount: number;
  /** 1-based absolute index of the first rendered row; 1 wherever paging is suspended. */
  rangeStart: number;
  /** Whether the pager renders. The rule: hide it only when there is genuinely nothing to page. */
  showPager: boolean;
}

/**
 * Resolve the page once, from the mode outward.
 *
 * Before this module every feature answered "is the server processing?" on a
 * layer of its own — pagination in its concern, pager visibility in a render
 * module (`pager-visibility.ts`, absorbed here), the ARIA counts not at all —
 * and each place a feature failed to ask produced a defect. A pure function
 * with its own test, following `group-count.ts`: a fourth reader cannot
 * reintroduce the drift without going out of its way.
 */
export function resolvePageDescriptor(input: PageDescriptorInput): PageDescriptor {
  const serverProcessed = input.mode !== 'client';
  const managed = input.mode === 'server-managed';

  const totalItems = serverProcessed ? input.serverTotal : input.filteredCount;

  // Grouping suspends paging in CLIENT mode only, where every row is already
  // here and a group can therefore be shown whole — which is the thing a
  // group means. Server mode cannot make that promise: the rest of a group
  // may sit on pages this client has never fetched, and collapsing to one
  // page removed the pager, so a reader saw one page's worth of rows
  // presented as the whole result with no control left to reach the rest
  // (#159). There, grouping buckets the page it has and paging stays.
  const groupingSuspendsPaging = input.grouped && !serverProcessed;

  const totalPages =
    groupingSuspendsPaging || totalItems === 0 ? 1 : Math.ceil(totalItems / input.pageSize);

  // `rawPage` is written by pagination, search, filtering and grouping — none
  // of which can know whether the page still exists after the page size or
  // the item count changed. Clamping here makes the stale-page state
  // unrepresentable instead of relying on every writer to remember a reset,
  // and covers an out-of-range page arriving from the view (its defaults, a
  // URL, storage), which never had a guard at all.
  const effectivePage = Math.min(Math.max(input.rawPage, 1), totalPages);

  const fetchPage = totalItems > 0 ? effectivePage : Math.max(1, input.rawPage);

  // Client-side grouping and client-side virtualization both render the whole
  // (remaining) list, so their first row is absolutely row 1. Everywhere else
  // the rendered rows are a page slice and the range starts where the slice does.
  const pagingSuspended = !serverProcessed && (input.grouped || input.virtualized);
  const rangeStart = pagingSuspended ? 1 : (effectivePage - 1) * input.pageSize + 1;

  return {
    mode: input.mode,
    serverProcessed,
    managed,
    totalItems,
    totalPages,
    effectivePage,
    fetchPage,
    loadedCount: input.loadedCount,
    rangeStart,
    showPager: resolveShowPager(input, serverProcessed)
  };
}

/**
 * Whether the table renders its pager. Absorbed from `pager-visibility.ts`,
 * whose reason to exist stands: every past version of this condition was an
 * unreadable one-liner in an `{#if}`, and #159 was one of its readings being
 * wrong with no test able to say so. Each clause below is a way that was once
 * decided wrongly.
 */
function resolveShowPager(input: PageDescriptorInput, serverProcessed: boolean): boolean {
  // Virtualization replaces paging with a scroll container. Kept as its own
  // clause: this is the one line the virtualized-server support changes
  // (hide only where the scroll container really holds the whole list —
  // client mode), everything around it stays.
  if (input.virtualized) return false;

  if (serverProcessed) {
    // Grouping does NOT hide it here: the page is a slice of a larger result,
    // so the groups are page-local and the rest is only reachable by paging
    // (#159).
    //
    // Neither does an empty page. The rows in hand are the wrong question in
    // server mode — a filter can narrow the result while the reader sits on
    // page 5, or a `?page=N` link can point past the end, and then the pager
    // is the only way back. The server's total is the right one.
    return input.serverTotal > 0;
  }

  // Client mode. Grouping suspends paging because the groups already hold
  // every row, and no rows means no result at all — here the rows in hand ARE
  // the whole result, so asking about them is sound.
  return input.filteredCount > 0 && !input.grouped;
}
