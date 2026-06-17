/**
 * Pure pagination computation — no Svelte runes, no DOM.
 *
 * Extracted from Pagination.svelte so the windowing/ellipsis logic
 * can be unit-tested without a renderer. The component continues to
 * own all reactivity; this module only ships pure functions.
 */

export interface VisiblePageNumbersOptions {
  /** 1-based current page index. */
  currentPage: number;
  /** Total number of pages (1+). */
  totalPages: number;
  /** Maximum window width (number of page buttons to show). */
  visiblePages: number;
}

/**
 * Compute the contiguous list of page numbers that should appear in the
 * Pagination window for the given context. Returns 1-based page indices.
 *
 * Behaviour:
 * - Window is centered around `currentPage` when there is room.
 * - Near the start, window snaps to `[1, visiblePages]`.
 * - Near the end, window snaps to `[totalPages - visiblePages + 1, totalPages]`.
 * - Empty totalPages or visiblePages ≤ 0 returns `[]`.
 */
export function computeVisiblePageNumbers({
  currentPage,
  totalPages,
  visiblePages
}: VisiblePageNumbersOptions): number[] {
  if (totalPages <= 0 || visiblePages <= 0) return [];

  const pages: number[] = [];
  const halfVisible = Math.floor(visiblePages / 2);

  let startPage = Math.max(1, currentPage - halfVisible);
  let endPage = Math.min(totalPages, currentPage + halfVisible);

  // Adjust if we're near the beginning
  if (currentPage <= halfVisible) {
    endPage = Math.min(totalPages, visiblePages);
  }

  if (currentPage + halfVisible >= totalPages) {
    startPage = Math.max(1, totalPages - visiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return pages;
}

/**
 * Returns whether ellipsis indicators should be shown on either side
 * of the visible-page window.
 */
export function computeEllipsisState(opts: {
  visiblePageNumbers: number[];
  totalPages: number;
  showNumbers: boolean;
}): { showStart: boolean; showEnd: boolean } {
  const { visiblePageNumbers: pages, totalPages, showNumbers } = opts;
  if (!showNumbers || pages.length === 0) {
    return { showStart: false, showEnd: false };
  }
  return {
    showStart: pages[0] > 1,
    showEnd: pages[pages.length - 1] < totalPages
  };
}
