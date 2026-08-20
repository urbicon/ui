import { describe, expect, it } from 'vitest';
import { type PageDescriptorInput, resolvePageDescriptor } from './page-descriptor';

const base: PageDescriptorInput = {
  mode: 'client',
  serverTotal: 0,
  filteredCount: 0,
  loadedCount: 0,
  rawPage: 1,
  pageSize: 20,
  grouped: false,
  virtualized: false
};

describe('resolvePageDescriptor', () => {
  describe('mode facts', () => {
    it('splits the three modes into the two booleans every reader branches on', () => {
      expect(resolvePageDescriptor(base)).toMatchObject({
        serverProcessed: false,
        managed: false
      });
      expect(resolvePageDescriptor({ ...base, mode: 'server-manual' })).toMatchObject({
        serverProcessed: true,
        managed: false
      });
      expect(resolvePageDescriptor({ ...base, mode: 'server-managed' })).toMatchObject({
        serverProcessed: true,
        managed: true
      });
    });
  });

  describe('totals — the server total or the filtered count, never a mix', () => {
    it('client mode counts the filtered rows', () => {
      const d = resolvePageDescriptor({ ...base, filteredCount: 97, serverTotal: 12000 });
      expect(d.totalItems).toBe(97);
      expect(d.totalPages).toBe(5);
    });

    it('server mode counts what the server reports, whatever is in hand', () => {
      for (const mode of ['server-manual', 'server-managed'] as const) {
        const d = resolvePageDescriptor({
          ...base,
          mode,
          serverTotal: 400,
          filteredCount: 20,
          loadedCount: 20
        });
        expect(d.totalItems, mode).toBe(400);
        expect(d.totalPages, mode).toBe(20);
      }
    });

    it('client-side grouping suspends paging — one page, whatever the count', () => {
      const d = resolvePageDescriptor({ ...base, filteredCount: 100, grouped: true });
      expect(d.totalPages).toBe(1);
    });

    it('server-side grouping does NOT suspend paging — the groups are page-local (#159)', () => {
      const d = resolvePageDescriptor({
        ...base,
        mode: 'server-manual',
        serverTotal: 12000,
        grouped: true
      });
      expect(d.totalPages).toBe(600);
    });
  });

  describe('effectivePage — the raw intent clamped into range', () => {
    it('clamps an out-of-range page down, and a nonsense page up', () => {
      const input = { ...base, mode: 'server-manual' as const, serverTotal: 400 };
      expect(resolvePageDescriptor({ ...input, rawPage: 99 }).effectivePage).toBe(20);
      expect(resolvePageDescriptor({ ...input, rawPage: 0 }).effectivePage).toBe(1);
      expect(resolvePageDescriptor({ ...input, rawPage: 3 }).effectivePage).toBe(3);
    });
  });

  describe('fetchPage — what a server fetch should ask for', () => {
    it('follows the displayed page once a total is known', () => {
      const d = resolvePageDescriptor({
        ...base,
        mode: 'server-managed',
        serverTotal: 400,
        rawPage: 99
      });
      expect(d.fetchPage).toBe(20);
    });

    it('carries the raw intent before any total is known — the clamp would flatten every deep link', () => {
      const d = resolvePageDescriptor({
        ...base,
        mode: 'server-managed',
        serverTotal: 0,
        rawPage: 3
      });
      expect(d.effectivePage).toBe(1);
      expect(d.fetchPage).toBe(3);
    });

    it('never asks for less than page 1', () => {
      const d = resolvePageDescriptor({
        ...base,
        mode: 'server-managed',
        serverTotal: 0,
        rawPage: -2
      });
      expect(d.fetchPage).toBe(1);
    });
  });

  describe('rangeStart — the absolute index of the first rendered row', () => {
    it('starts where the page slice starts', () => {
      expect(resolvePageDescriptor({ ...base, filteredCount: 100, rawPage: 2 }).rangeStart).toBe(
        21
      );
      expect(
        resolvePageDescriptor({ ...base, mode: 'server-manual', serverTotal: 400, rawPage: 3 })
          .rangeStart
      ).toBe(41);
    });

    it('is 1 wherever paging is suspended (client grouping, client virtualization)', () => {
      expect(
        resolvePageDescriptor({ ...base, filteredCount: 100, grouped: true, rawPage: 2 }).rangeStart
      ).toBe(1);
      expect(
        resolvePageDescriptor({ ...base, filteredCount: 100, virtualized: true, rawPage: 2 })
          .rangeStart
      ).toBe(1);
    });
  });

  // Migrated from pager-visibility.test.ts (#159 and its review): the
  // condition once lived inline in Table.svelte, so reverting the fix left
  // all tests green. Each `false` is a claim that there is genuinely nothing
  // to page, and each of those claims has been wrong at least once.
  describe('showPager', () => {
    describe('client mode — the rows in hand are the whole result', () => {
      it('pages a plain result', () => {
        expect(resolvePageDescriptor({ ...base, filteredCount: 100 }).showPager).toBe(true);
      });

      it('hides on an empty result', () => {
        expect(resolvePageDescriptor({ ...base, filteredCount: 0 }).showPager).toBe(false);
      });

      it('hides while grouped, because the groups hold every row', () => {
        expect(
          resolvePageDescriptor({ ...base, filteredCount: 100, grouped: true }).showPager
        ).toBe(false);
      });
    });

    describe('server mode — the rows in hand are one page of a larger result', () => {
      it('pages a plain result', () => {
        expect(
          resolvePageDescriptor({
            ...base,
            mode: 'server-manual',
            serverTotal: 12000,
            filteredCount: 25
          }).showPager
        ).toBe(true);
      });

      it('KEEPS paging while grouped — the defect #159 reports', () => {
        // Client-mode reasoning applied here removed the pager, leaving one
        // page of a 12,000-row result presented as the whole thing.
        expect(
          resolvePageDescriptor({
            ...base,
            mode: 'server-manual',
            serverTotal: 12000,
            filteredCount: 25,
            grouped: true
          }).showPager
        ).toBe(true);
      });

      it('KEEPS paging on an empty page while the server holds rows', () => {
        // Reached by a filter narrowing the result while the reader sits on a
        // later page, or a `?page=N` link past the end. Asking about the rows
        // in hand strands the reader with no control at all.
        expect(
          resolvePageDescriptor({
            ...base,
            mode: 'server-managed',
            serverTotal: 12000,
            filteredCount: 0
          }).showPager
        ).toBe(true);
      });

      it('hides when the server really has nothing', () => {
        expect(
          resolvePageDescriptor({ ...base, mode: 'server-manual', serverTotal: 0 }).showPager
        ).toBe(false);
      });
    });

    it('hides the pager for a virtualized table only where it holds the whole list — client mode', () => {
      // Virtualization replaces paging with a scroll container in client
      // mode, where the container really renders every row.
      expect(
        resolvePageDescriptor({
          ...base,
          mode: 'client',
          filteredCount: 100,
          virtualized: true
        }).showPager
      ).toBe(false);
    });

    it('keeps the pager for a virtualized table in server mode — the page is the only access to the rest', () => {
      // The scroll container holds one loaded page; without the pager the
      // remaining rows were reachable through no control at all.
      for (const mode of ['server-manual', 'server-managed'] as const) {
        expect(
          resolvePageDescriptor({
            ...base,
            mode,
            serverTotal: 12000,
            virtualized: true
          }).showPager,
          mode
        ).toBe(true);
      }
    });

    it('still hides the pager for an empty virtualized server result', () => {
      expect(
        resolvePageDescriptor({
          ...base,
          mode: 'server-manual',
          serverTotal: 0,
          virtualized: true
        }).showPager
      ).toBe(false);
    });
  });

  describe('pageSize guard', () => {
    it('clamps a zero (or negative) page size instead of dividing by it', () => {
      // Representable via `viewDefaults={{ pageSize: 0 }}` — unguarded this
      // made totalPages Infinity and the effectivePage clamp a no-op.
      const d = resolvePageDescriptor({ ...base, filteredCount: 100, pageSize: 0, rawPage: 7 });
      expect(d.pageSize).toBe(1);
      expect(d.totalPages).toBe(100);
      expect(d.effectivePage).toBe(7);
      expect(Number.isFinite(d.totalPages)).toBe(true);
    });

    it('falls to 1 for NaN instead of poisoning every derived number', () => {
      const d = resolvePageDescriptor({ ...base, filteredCount: 100, pageSize: NaN, rawPage: 7 });
      expect(d.pageSize).toBe(1);
      expect(d.totalPages).toBe(100);
      expect(d.effectivePage).toBe(7);
      expect(d.fetchPage).toBeGreaterThanOrEqual(1);
    });

    it('falls to 1 for Infinity instead of asking a managed query for page 0', () => {
      const d = resolvePageDescriptor({
        ...base,
        mode: 'server-managed',
        serverTotal: 400,
        pageSize: Number.POSITIVE_INFINITY,
        rawPage: 7
      });
      expect(d.pageSize).toBe(1);
      expect(d.totalPages).toBe(400);
      expect(d.fetchPage).toBeGreaterThanOrEqual(1);
      expect(d.rangeStart).toBeGreaterThanOrEqual(1);
    });
  });

  it('fetchPage behaves the same on the manual arm', () => {
    expect(
      resolvePageDescriptor({ ...base, mode: 'server-manual', serverTotal: 400, rawPage: 99 })
        .fetchPage
    ).toBe(20);
    expect(
      resolvePageDescriptor({ ...base, mode: 'server-manual', serverTotal: 0, rawPage: 3 })
        .fetchPage
    ).toBe(3);
  });

  it('rangeStart stays page-absolute where the server pages, virtualized or grouped', () => {
    // Server mode always pages — virtualization and grouping only suspend
    // paging where the whole list is in hand (client mode).
    expect(
      resolvePageDescriptor({
        ...base,
        mode: 'server-manual',
        serverTotal: 400,
        virtualized: true,
        rawPage: 2
      }).rangeStart
    ).toBe(21);
    expect(
      resolvePageDescriptor({
        ...base,
        mode: 'server-managed',
        serverTotal: 400,
        grouped: true,
        virtualized: true,
        rawPage: 3
      }).rangeStart
    ).toBe(41);
  });

  it('passes the loaded count through for range honesty under live updates', () => {
    expect(
      resolvePageDescriptor({ ...base, mode: 'server-manual', serverTotal: 400, loadedCount: 23 })
        .loadedCount
    ).toBe(23);
  });
});
