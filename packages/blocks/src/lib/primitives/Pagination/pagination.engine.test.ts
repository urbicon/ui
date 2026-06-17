import { describe, expect, it } from 'vitest';
import { computeEllipsisState, computeVisiblePageNumbers } from './pagination.engine';

describe('computeVisiblePageNumbers', () => {
  it('returns empty array when there are no pages', () => {
    expect(computeVisiblePageNumbers({ currentPage: 1, totalPages: 0, visiblePages: 5 })).toEqual(
      []
    );
  });

  it('returns empty array when visiblePages is non-positive', () => {
    expect(computeVisiblePageNumbers({ currentPage: 1, totalPages: 10, visiblePages: 0 })).toEqual(
      []
    );
  });

  it('returns all pages when totalPages ≤ visiblePages', () => {
    expect(computeVisiblePageNumbers({ currentPage: 1, totalPages: 3, visiblePages: 5 })).toEqual([
      1, 2, 3
    ]);
  });

  it('snaps to start when currentPage is within half-window of page 1', () => {
    expect(computeVisiblePageNumbers({ currentPage: 1, totalPages: 20, visiblePages: 5 })).toEqual([
      1, 2, 3, 4, 5
    ]);
    expect(computeVisiblePageNumbers({ currentPage: 2, totalPages: 20, visiblePages: 5 })).toEqual([
      1, 2, 3, 4, 5
    ]);
  });

  it('centers window around currentPage in the middle', () => {
    expect(computeVisiblePageNumbers({ currentPage: 10, totalPages: 20, visiblePages: 5 })).toEqual(
      [8, 9, 10, 11, 12]
    );
  });

  it('snaps to end when currentPage is near totalPages', () => {
    expect(computeVisiblePageNumbers({ currentPage: 20, totalPages: 20, visiblePages: 5 })).toEqual(
      [16, 17, 18, 19, 20]
    );
    expect(computeVisiblePageNumbers({ currentPage: 19, totalPages: 20, visiblePages: 5 })).toEqual(
      [16, 17, 18, 19, 20]
    );
  });

  it('handles even visiblePages window correctly', () => {
    // halfVisible = 2 for visiblePages=4 → asymmetric centering favors the right
    expect(computeVisiblePageNumbers({ currentPage: 5, totalPages: 20, visiblePages: 4 })).toEqual([
      3, 4, 5, 6, 7
    ]);
  });

  it('handles single-page total', () => {
    expect(computeVisiblePageNumbers({ currentPage: 1, totalPages: 1, visiblePages: 5 })).toEqual([
      1
    ]);
  });
});

describe('computeEllipsisState', () => {
  it('returns false/false when showNumbers is off', () => {
    expect(
      computeEllipsisState({
        visiblePageNumbers: [3, 4, 5],
        totalPages: 10,
        showNumbers: false
      })
    ).toEqual({ showStart: false, showEnd: false });
  });

  it('returns false/false when no pages are visible', () => {
    expect(
      computeEllipsisState({ visiblePageNumbers: [], totalPages: 10, showNumbers: true })
    ).toEqual({ showStart: false, showEnd: false });
  });

  it('shows start ellipsis when window does not include page 1', () => {
    expect(
      computeEllipsisState({
        visiblePageNumbers: [5, 6, 7],
        totalPages: 20,
        showNumbers: true
      })
    ).toEqual({ showStart: true, showEnd: true });
  });

  it('shows neither when window covers full range', () => {
    expect(
      computeEllipsisState({
        visiblePageNumbers: [1, 2, 3, 4, 5],
        totalPages: 5,
        showNumbers: true
      })
    ).toEqual({ showStart: false, showEnd: false });
  });

  it('shows only end ellipsis when window starts at page 1', () => {
    expect(
      computeEllipsisState({
        visiblePageNumbers: [1, 2, 3],
        totalPages: 10,
        showNumbers: true
      })
    ).toEqual({ showStart: false, showEnd: true });
  });

  it('shows only start ellipsis when window ends at last page', () => {
    expect(
      computeEllipsisState({
        visiblePageNumbers: [8, 9, 10],
        totalPages: 10,
        showNumbers: true
      })
    ).toEqual({ showStart: true, showEnd: false });
  });
});
