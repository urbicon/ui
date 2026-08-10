import { describe, expect, it } from 'vitest';
import { shouldRenderPager } from './pager-visibility';

/**
 * #159 and its review. The condition lived inline in `Table.svelte`, so
 * reverting the fix left all 655 tests green — the symptom the issue actually
 * reports (no pager, no way to the rest of the data) was pinned by nothing.
 *
 * The matrix below is the whole rule. Each `false` is a claim that there is
 * genuinely nothing to page, and each of those claims has been wrong at least
 * once.
 */
describe('shouldRenderPager', () => {
  const base = {
    mode: 'client',
    serverTotal: 0,
    filteredCount: 0,
    grouped: false,
    virtualized: false
  };

  describe('client mode — the rows in hand are the whole result', () => {
    it('pages a plain result', () => {
      expect(shouldRenderPager({ ...base, filteredCount: 100 })).toBe(true);
    });

    it('hides on an empty result', () => {
      expect(shouldRenderPager({ ...base, filteredCount: 0 })).toBe(false);
    });

    it('hides while grouped, because the groups hold every row', () => {
      expect(shouldRenderPager({ ...base, filteredCount: 100, grouped: true })).toBe(false);
    });
  });

  describe('server mode — the rows in hand are one page of a larger result', () => {
    it('pages a plain result', () => {
      expect(
        shouldRenderPager({ ...base, mode: 'server', serverTotal: 12000, filteredCount: 25 })
      ).toBe(true);
    });

    it('KEEPS paging while grouped — the defect #159 reports', () => {
      // Client-mode reasoning applied here removed the pager, leaving one page
      // of a 12,000-row result presented as the whole thing.
      expect(
        shouldRenderPager({
          ...base,
          mode: 'server',
          serverTotal: 12000,
          filteredCount: 25,
          grouped: true
        })
      ).toBe(true);
    });

    it('KEEPS paging on an empty page while the server holds rows', () => {
      // Reached by a filter narrowing the result while the reader sits on a
      // later page, or a `?page=N` link past the end. Asking about the rows in
      // hand strands the reader with no control at all.
      expect(
        shouldRenderPager({ ...base, mode: 'server', serverTotal: 12000, filteredCount: 0 })
      ).toBe(true);
    });

    it('hides when the server really has nothing', () => {
      expect(shouldRenderPager({ ...base, mode: 'server', serverTotal: 0, filteredCount: 0 })).toBe(
        false
      );
    });
  });

  it('never pages a virtualized table, in either mode', () => {
    // Virtualization replaces paging with a scroll container. (That it scrolls
    // only the fetched page in server mode is a separate gap, not this one.)
    for (const mode of ['client', 'server']) {
      expect(
        shouldRenderPager({
          ...base,
          mode,
          serverTotal: 12000,
          filteredCount: 100,
          virtualized: true
        }),
        mode
      ).toBe(false);
    }
  });
});
