// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TablePage } from '$lib/types/tableTypes';
import { createTableView, type TableViewSnapshot } from '$lib/view/view.svelte';
import type { InternalTableContext } from '../stores/TableStore.svelte';
import TableHarness from './__fixtures__/TableHarness.svelte';
import type { TableContext } from './table/index';

/**
 * The managed server source against a mounted table: what the reader sees
 * before the first response, and how the table recovers from a deep link
 * pointing past the end. Both were architecture-probe findings measured
 * against exactly this rig — the assertions here are those measurements,
 * inverted into pins.
 */

const TOTAL = 400;
const PAGE_SIZE = 20;
const ALL_ROWS = Array.from({ length: TOTAL }, (_, i) => ({
  id: i + 1,
  name: `Row ${i + 1}`,
  amount: i
}));

function makePagedQuery() {
  const calls: TableViewSnapshot[] = [];
  const query = async (q: TableViewSnapshot): Promise<TablePage> => {
    calls.push(q);
    const start = (q.page - 1) * q.pageSize;
    return { items: ALL_ROWS.slice(start, start + q.pageSize), total: TOTAL };
  };
  return { calls, query };
}

/** Fake-timer-safe microtask drain (queueMicrotask/promises stay real). */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flushSync();
}

interface Mounted {
  target: HTMLElement;
  comp: Record<string, unknown>;
  ctx: InternalTableContext;
  rows: () => number;
}

let mounted: Mounted[] = [];

function mountTable(props: Record<string, unknown>): Mounted {
  const target = document.createElement('div');
  document.body.appendChild(target);
  let ctx: InternalTableContext | undefined;
  const comp = mount(TableHarness, {
    target,
    props: {
      items: undefined,
      onReady: (c: TableContext) => (ctx = c as InternalTableContext),
      ...props
    }
  }) as Record<string, unknown>;
  flushSync();
  if (!ctx) throw new Error('onReady never fired');
  const entry: Mounted = {
    target,
    comp,
    ctx,
    rows: () => target.querySelectorAll('tbody tr[data-row-index]').length
  };
  mounted.push(entry);
  return entry;
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  for (const entry of mounted) {
    unmount(entry.comp);
    entry.target.remove();
  }
  mounted = [];
  vi.useRealTimers();
  warn.mockRestore();
});

describe('managed source — the first frame is loading, not empty', () => {
  it('renders the loading state before the fetch has even started', async () => {
    let resolveFetch: ((page: TablePage) => void) | undefined;
    const calls: TableViewSnapshot[] = [];
    const query = (q: TableViewSnapshot): Promise<TablePage> => {
      calls.push(q);
      return new Promise((res) => {
        resolveFetch = res;
      });
    };
    const t = mountTable({ source: { processing: 'server', query } });

    // Before any timer fires the first fetch has not started — and the table
    // must already say "loading", because this is also the SSR frame.
    expect(calls).toHaveLength(0);
    expect(t.ctx.state.loading).toBe(true);
    expect(t.target.querySelector('[data-testid="loading-state"]')).not.toBeNull();
    expect(t.target.querySelector('[data-testid="empty-state"]')).toBeNull();

    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    expect(calls).toHaveLength(1);

    resolveFetch?.({ items: ALL_ROWS.slice(0, PAGE_SIZE), total: TOTAL });
    await flushMicrotasks();
    expect(t.ctx.state.loading).toBe(false);
    expect(t.rows()).toBe(PAGE_SIZE);
  });

  it('a genuinely empty result still reaches the empty state', async () => {
    const query = async (): Promise<TablePage> => ({ items: [], total: 0 });
    const t = mountTable({ source: { processing: 'server', query } });

    vi.advanceTimersByTime(0);
    await flushMicrotasks();

    expect(t.ctx.state.loading).toBe(false);
    expect(t.target.querySelector('[data-testid="empty-state"]')).not.toBeNull();
  });
});

describe('managed source — the fetch follows the effective page', () => {
  it('recovers from an out-of-range deep link with one corrective fetch', async () => {
    const { calls, query } = makePagedQuery();
    const view = createTableView();
    // The way a URL binding leaves a shared `?page=99` link at init.
    view.applyExternal({ page: 99, pageSize: PAGE_SIZE }, 'external');

    const t = mountTable({ view, source: { processing: 'server', query, debounceMs: 50 } });
    vi.advanceTimersByTime(0);
    await flushMicrotasks();

    // Before any total is known the raw intent is the honest request.
    expect(calls.map((c) => c.page)).toEqual([99]);

    // The response reveals 20 pages; the projected fetch page snaps to the
    // displayed (clamped) page and the debounced refetch recovers the reader.
    vi.advanceTimersByTime(60);
    await flushMicrotasks();
    expect(calls.map((c) => c.page)).toEqual([99, 20]);
    expect(t.rows()).toBe(PAGE_SIZE);
    expect(t.ctx.effectivePage).toBe(20);

    // The intent itself is never rewritten — a later page-size change may
    // make it valid again. And the recovery does not loop.
    expect(t.ctx.view.page).toBe(99);
    vi.advanceTimersByTime(1000);
    await flushMicrotasks();
    expect(calls).toHaveLength(2);
  });

  it('positive control: an in-range deep link fetches exactly once, as asked', async () => {
    const { calls, query } = makePagedQuery();
    const view = createTableView();
    view.applyExternal({ page: 3, pageSize: PAGE_SIZE }, 'external');

    const t = mountTable({ view, source: { processing: 'server', query, debounceMs: 50 } });
    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    vi.advanceTimersByTime(1000);
    await flushMicrotasks();

    expect(calls.map((c) => c.page)).toEqual([3]);
    expect(t.ctx.effectivePage).toBe(3);
    expect(t.rows()).toBe(PAGE_SIZE);
  });

  it('a rejecting query lands in the error state, not in loading forever', async () => {
    const query = async (): Promise<TablePage> => {
      throw new Error('backend down');
    };
    const t = mountTable({ source: { processing: 'server', query } });
    expect(t.target.querySelector('[data-testid="loading-state"]')).not.toBeNull();

    vi.advanceTimersByTime(0);
    await flushMicrotasks();

    expect(t.ctx.state.loading).toBe(false);
    expect(t.target.querySelector('[data-testid="loading-state"]')).toBeNull();
    expect(t.target.querySelector('[data-testid="error-state"]')).not.toBeNull();
  });

  it('a total that shrank mid-session corrects with one fetch, no loop', async () => {
    // The reader sits on page 5 (in range against the old total of 400); the
    // backend meanwhile holds 40 rows. The response reveals 2 pages, the
    // displayed page clamps to 2, and one corrective fetch recovers.
    const calls: TableViewSnapshot[] = [];
    const query = async (q: TableViewSnapshot): Promise<TablePage> => {
      calls.push(q);
      const start = (q.page - 1) * q.pageSize;
      return { items: ALL_ROWS.slice(0, 40).slice(start, start + q.pageSize), total: 40 };
    };
    const view = createTableView();
    view.applyExternal({ page: 5, pageSize: PAGE_SIZE }, 'external');

    const t = mountTable({ view, source: { processing: 'server', query, debounceMs: 50 } });
    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    expect(calls.map((c) => c.page)).toEqual([5]);

    vi.advanceTimersByTime(60);
    await flushMicrotasks();
    expect(calls.map((c) => c.page)).toEqual([5, 2]);
    expect(t.ctx.effectivePage).toBe(2);
    expect(t.rows()).toBe(PAGE_SIZE);

    vi.advanceTimersByTime(1000);
    await flushMicrotasks();
    expect(calls).toHaveLength(2);
  });

  it('a total of zero against an out-of-range intent fetches exactly once and shows empty', async () => {
    // Both zeros — "no total yet" and "a known total of zero" — keep the raw
    // intent as the fetch page, so the key never changes: no oscillation.
    const calls: TableViewSnapshot[] = [];
    const query = async (q: TableViewSnapshot): Promise<TablePage> => {
      calls.push(q);
      return { items: [], total: 0 };
    };
    const view = createTableView();
    view.applyExternal({ page: 99, pageSize: PAGE_SIZE }, 'external');

    const t = mountTable({ view, source: { processing: 'server', query, debounceMs: 50 } });
    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    vi.advanceTimersByTime(1000);
    await flushMicrotasks();

    expect(calls.map((c) => c.page)).toEqual([99]);
    expect(t.target.querySelector('[data-testid="empty-state"]')).not.toBeNull();
  });

  it('a page-size change resurrects the raw intent — the clamp never rewrote it', async () => {
    const { calls, query } = makePagedQuery();
    const view = createTableView();
    view.applyExternal({ page: 99, pageSize: PAGE_SIZE }, 'external');

    const t = mountTable({ view, source: { processing: 'server', query, debounceMs: 50 } });
    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    vi.advanceTimersByTime(60);
    await flushMicrotasks();
    expect(calls.map((c) => c.page)).toEqual([99, 20]);

    // 400 rows at 4 per page is 100 pages: page 99 is a real page again.
    view.pageSize = 4;
    flushSync();
    vi.advanceTimersByTime(60);
    await flushMicrotasks();

    expect(calls.at(-1)).toMatchObject({ page: 99, pageSize: 4 });
    expect(t.ctx.effectivePage).toBe(99);
    expect(t.rows()).toBe(4);
  });

  it('the pager stays wired through the descriptor: grouped server pages, grouped client does not', async () => {
    const groupedView = createTableView();
    groupedView.applyExternal({ groupBy: 'name', pageSize: PAGE_SIZE }, 'external');
    const server = mountTable({
      view: groupedView,
      source: { processing: 'server', items: ALL_ROWS.slice(0, PAGE_SIZE), total: TOTAL }
    });
    expect(server.target.querySelector('nav')).not.toBeNull();

    const clientView = createTableView();
    clientView.applyExternal({ groupBy: 'name', pageSize: PAGE_SIZE }, 'external');
    const client = mountTable({ view: clientView, items: ALL_ROWS.slice(0, 60) });
    expect(client.target.querySelector('nav')).toBeNull();
  });

  it('the virtualized grid also reports the server total as its row count', async () => {
    // The virtualized header table used to count its rendered window; both
    // branches read the descriptor now.
    const t = mountTable({
      source: { processing: 'server', items: ALL_ROWS.slice(0, PAGE_SIZE), total: TOTAL },
      virtualized: true,
      selectionMode: 'multi'
    });

    // The ARIA surface of the virtualized branch is the grid wrapper that
    // contains all three tables — not the header table.
    const grid = t.target.querySelector('[data-testid="virtual-grid"]');
    expect(grid?.getAttribute('aria-rowcount')).toBe(String(TOTAL));
  });

  it('the grid reports the server total as its row count', async () => {
    const { query } = makePagedQuery();
    const view = createTableView();
    view.applyExternal({ pageSize: PAGE_SIZE }, 'external');

    const t = mountTable({
      view,
      source: { processing: 'server', query, debounceMs: 50 },
      selectionMode: 'multi'
    });
    vi.advanceTimersByTime(0);
    await flushMicrotasks();

    // 20 rows in hand, 400 in the result: the ARIA count follows the pager's
    // truth, not the slice — both read the same page descriptor now.
    const table = t.target.querySelector('[data-testid="table-element"]');
    expect(t.rows()).toBe(PAGE_SIZE);
    expect(table?.getAttribute('aria-rowcount')).toBe(String(TOTAL));
  });
});

describe('absolute aria row indices — the row reports its list-wide position', () => {
  it('server mode: page 2 announces rows 21..40 beside aria-rowcount 400', async () => {
    const view = createTableView();
    view.applyExternal({ page: 2, pageSize: PAGE_SIZE }, 'external');
    const t = mountTable({
      view,
      source: {
        processing: 'server',
        items: ALL_ROWS.slice(PAGE_SIZE, PAGE_SIZE * 2),
        total: TOTAL
      }
    });

    const table = t.target.querySelector('[data-testid="table-element"]');
    expect(table?.getAttribute('aria-rowcount')).toBe(String(TOTAL));
    const first = t.target.querySelector('tbody tr[data-row-index="0"]');
    const last = t.target.querySelector(`tbody tr[data-row-index="${PAGE_SIZE - 1}"]`);
    expect(first?.getAttribute('aria-rowindex')).toBe('21');
    expect(last?.getAttribute('aria-rowindex')).toBe('40');
    // The keyboard index space stays page-local on purpose.
    expect(first?.getAttribute('data-row-index')).toBe('0');
  });

  it('client mode: page 2 keeps counting where page 1 stopped (positive control)', () => {
    const view = createTableView();
    view.applyExternal({ page: 2, pageSize: PAGE_SIZE }, 'external');
    const t = mountTable({ view, items: ALL_ROWS.slice(0, 100) });

    const table = t.target.querySelector('[data-testid="table-element"]');
    expect(table?.getAttribute('aria-rowcount')).toBe('100');
    expect(
      t.target.querySelector('tbody tr[data-row-index="0"]')?.getAttribute('aria-rowindex')
    ).toBe('21');
  });

  it('page 1 still starts at 1', () => {
    const t = mountTable({ items: ALL_ROWS.slice(0, 5) });
    expect(
      t.target.querySelector('tbody tr[data-row-index="0"]')?.getAttribute('aria-rowindex')
    ).toBe('1');
  });
});

describe('server mode search writes through — one debounce, not two', () => {
  function searchInput(t: Mounted): HTMLInputElement {
    const input = t.target.querySelector('input[type="search"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('search input not found');
    return input;
  }

  it('a keystroke reaches the view synchronously in server mode', async () => {
    const { query } = makePagedQuery();
    const t = mountTable({ source: { processing: 'server', query } });
    vi.advanceTimersByTime(0);
    await flushMicrotasks();

    const input = searchInput(t);
    input.value = 'abc';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();

    // No timer advance: the bar's debounce is out of the path; the one that
    // waits now is the source's own fetch debounce.
    expect(t.ctx.view.search).toBe('abc');
  });

  it('an explicitly set debounce is honoured in server mode too', async () => {
    const { query } = makePagedQuery();
    const t = mountTable({
      source: { processing: 'server', query },
      searchDebounceMs: 800
    });
    vi.advanceTimersByTime(0);
    await flushMicrotasks();

    const input = searchInput(t);
    input.value = 'abc';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();

    // Only the DEFAULT is mode-dependent; a consumer who asked for 800 ms
    // gets 800 ms regardless of who processes the rows.
    expect(t.ctx.view.search).toBe('');
    await vi.advanceTimersByTimeAsync(799);
    expect(t.ctx.view.search).toBe('');
    await vi.advanceTimersByTimeAsync(1);
    expect(t.ctx.view.search).toBe('abc');
  });

  it('client mode keeps the bar debounce (positive control)', async () => {
    const t = mountTable({ items: ALL_ROWS.slice(0, 50) });

    const input = searchInput(t);
    input.value = 'abc';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();

    expect(t.ctx.view.search).toBe('');
    await vi.advanceTimersByTimeAsync(300);
    expect(t.ctx.view.search).toBe('abc');
  });

  it('client mode honours an explicit value, once (positive control)', async () => {
    const t = mountTable({ items: ALL_ROWS.slice(0, 50), searchDebounceMs: 150 });

    const input = searchInput(t);
    input.value = 'abc';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();

    expect(t.ctx.view.search).toBe('');
    await vi.advanceTimersByTimeAsync(149);
    expect(t.ctx.view.search).toBe('');
    await vi.advanceTimersByTimeAsync(1);
    expect(t.ctx.view.search).toBe('abc');
  });

  /**
   * The mode-aware default (#225) kept the bar's debounce and the source's out
   * of each other's way only while nobody set one. An explicit
   * `searchDebounceMs={300}` — the old default, copied from a client example —
   * put them back in series on a server table: the bar wrote at 300, the fetch
   * went out at 600. These pin the fix (#255): an explicit value is the whole
   * budget per keystroke, and only the search write is exempted from the
   * source's own debounce.
   */
  describe('an explicit value is one budget, not two delays in series', () => {
    /**
     * The bar's timer is advanced SYNCHRONOUSLY on purpose, here and below.
     * An exempted fetch is a zero-delay timer, and fake timers give one of
     * those a `callAt` of *now + 1* when it is scheduled while a tick is in
     * progress (the loop guard against a 0-delay timer rescheduling itself
     * forever) — which is what the awaited advances do, since they drain the
     * microtask that runs Svelte's effects. The sync advance returns first and
     * the effect flushes outside the tick, so the fetch is queued for the
     * instant the write happened and the clock below reads the real edge.
     */
    it('a keystroke fetches at 300 with searchDebounceMs={300}, not at 600', async () => {
      const { calls, query } = makePagedQuery();
      // Both halves spelled out at the value each defaults to.
      const t = mountTable({
        source: { processing: 'server', query, debounceMs: 300 },
        searchDebounceMs: 300
      });
      vi.advanceTimersByTime(0);
      await flushMicrotasks();
      expect(calls).toHaveLength(1); // the immediate first fetch

      const keystroke = Date.now();
      const input = searchInput(t);
      input.value = 'abc';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();

      // 299 ms: the bar is still holding the write, so nothing has been asked for.
      await vi.advanceTimersByTimeAsync(299);
      await flushMicrotasks();
      expect(t.ctx.view.search).toBe('');
      expect(calls).toHaveLength(1);

      // 300 ms: the write lands, and the fetch is queued for that same instant
      // — not for 300 ms later. This is the whole issue: with the delays in
      // series the fetch below goes out at 600.
      vi.advanceTimersByTime(1);
      await flushMicrotasks();
      expect(t.ctx.view.search).toBe('abc');
      expect(calls).toHaveLength(1);

      vi.advanceTimersByTime(0);
      await flushMicrotasks();
      expect(Date.now() - keystroke).toBe(300);
      expect(calls).toHaveLength(2);
      expect(calls[1]).toMatchObject({ search: 'abc', page: 1 });

      // And 600 ms brings nothing after it.
      await vi.advanceTimersByTimeAsync(300);
      await flushMicrotasks();
      expect(calls).toHaveLength(2);
    });

    it('positive control: unset, the write is synchronous and the source debounce is the only wait', async () => {
      const { calls, query } = makePagedQuery();
      const t = mountTable({ source: { processing: 'server', query, debounceMs: 300 } });
      vi.advanceTimersByTime(0);
      await flushMicrotasks();
      expect(calls).toHaveLength(1);

      const keystroke = Date.now();
      const input = searchInput(t);
      input.value = 'abc';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
      // No bar timer in the path at all — today's server-mode default.
      expect(t.ctx.view.search).toBe('abc');

      await vi.advanceTimersByTimeAsync(299);
      await flushMicrotasks();
      expect(calls).toHaveLength(1);

      // Same 300 ms budget, reached the other way round: nothing was exempted,
      // the source's own debounce did all of the waiting.
      await vi.advanceTimersByTimeAsync(1);
      await flushMicrotasks();
      expect(Date.now() - keystroke).toBe(300);
      expect(calls).toHaveLength(2);
      expect(calls[1]).toMatchObject({ search: 'abc' });
    });

    it('the exemption is the search write alone — a page change still waits the source out', async () => {
      const { calls, query } = makePagedQuery();
      const t = mountTable({
        source: { processing: 'server', query, debounceMs: 300 },
        searchDebounceMs: 300
      });
      vi.advanceTimersByTime(0);
      await flushMicrotasks();

      const input = searchInput(t);
      input.value = 'abc';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await flushMicrotasks();
      vi.advanceTimersByTime(0);
      await flushMicrotasks();
      expect(calls).toHaveLength(2);

      // Nothing debounced this one, so the source's 300 ms apply in full — a
      // blanket "skip the source debounce whenever the bar debounces" would
      // have fired it on the spot.
      const click = Date.now();
      t.ctx.goToPage(2);
      flushSync();
      await vi.advanceTimersByTimeAsync(299);
      await flushMicrotasks();
      expect(calls).toHaveLength(2);

      await vi.advanceTimersByTimeAsync(1);
      await flushMicrotasks();
      expect(Date.now() - click).toBe(300);
      expect(calls).toHaveLength(3);
      expect(calls[2]).toMatchObject({ page: 2 });
    });

    it('a debounced write that changes nothing leaves no exemption behind', async () => {
      const { calls, query } = makePagedQuery();
      const t = mountTable({
        source: { processing: 'server', query, debounceMs: 300 },
        searchDebounceMs: 300
      });
      vi.advanceTimersByTime(0);
      await flushMicrotasks();

      const input = searchInput(t);
      const type = async (value: string) => {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        vi.advanceTimersByTime(300);
        await flushMicrotasks();
        vi.advanceTimersByTime(0);
        await flushMicrotasks();
      };

      await type('abc');
      expect(calls).toHaveLength(2);

      // The same term again: the bar's timer runs, the write is a no-op, no
      // view axis changes and no fetch follows — so nothing may stay marked.
      await type('abc');
      expect(calls).toHaveLength(2);

      // If something had, this unrelated change would inherit the exemption
      // and go out immediately instead of waiting the source out.
      const click = Date.now();
      t.ctx.goToPage(2);
      flushSync();
      await vi.advanceTimersByTimeAsync(299);
      await flushMicrotasks();
      expect(calls).toHaveLength(2);

      await vi.advanceTimersByTimeAsync(1);
      await flushMicrotasks();
      expect(Date.now() - click).toBe(300);
      expect(calls).toHaveLength(3);
    });
  });
});

describe('the pager stays in the DOM while loading', () => {
  // Svelte writes `inert` as a DOM property; jsdom does not mirror it into
  // an attribute, so `[inert]` selectors see nothing. Walk the property.
  function underInert(el: Element | null): boolean {
    for (let n: Element | null = el; n; n = n.parentElement) {
      if ((n as HTMLElement).inert) return true;
    }
    return false;
  }

  it('goes inert during a page fetch instead of unmounting', async () => {
    let resolveFetch: ((page: TablePage) => void) | undefined;
    const query = (q: TableViewSnapshot): Promise<TablePage> =>
      new Promise<TablePage>((res) => {
        resolveFetch = (page) => res(page);
        void q;
      });
    const t = mountTable({ source: { processing: 'server', query, debounceMs: 50 } });

    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    resolveFetch?.({ items: ALL_ROWS.slice(0, PAGE_SIZE), total: TOTAL });
    await flushMicrotasks();

    // First page settled: pager present and interactive.
    expect(t.ctx.state.loading).toBe(false);
    const nav = () => t.target.querySelector('nav');
    expect(nav()).not.toBeNull();
    expect(underInert(nav())).toBe(false);

    // A page change fetches; while the query is pending the nav must stay in
    // the DOM (removing it made the second "next" click land on nothing) but
    // be dead to input.
    t.ctx.goToPage(2);
    flushSync();
    vi.advanceTimersByTime(60);
    await flushMicrotasks();
    expect(t.ctx.state.loading).toBe(true);
    expect(nav()).not.toBeNull();
    expect(underInert(nav())).toBe(true);

    resolveFetch?.({ items: ALL_ROWS.slice(PAGE_SIZE, PAGE_SIZE * 2), total: TOTAL });
    await flushMicrotasks();
    expect(t.ctx.state.loading).toBe(false);
    expect(underInert(nav())).toBe(false);
  });

  it('an error still removes the pager', async () => {
    const query = async (): Promise<TablePage> => {
      throw new Error('boom');
    };
    const t = mountTable({ source: { processing: 'server', query } });
    vi.advanceTimersByTime(0);
    await flushMicrotasks();

    expect(t.ctx.state.error).not.toBeNull();
    expect(t.target.querySelector('nav')).toBeNull();
  });
});

describe('server mode — the header checkbox claims only the page', () => {
  function headerCheckbox(target: HTMLElement): HTMLInputElement {
    const input = target.querySelector<HTMLInputElement>('[data-testid="selection-header"] input');
    if (!input) throw new Error('header checkbox not found');
    return input;
  }

  it('selecting the page yields mixed, never a full check, and the label names the page', () => {
    const t = mountTable({
      source: { processing: 'server', items: ALL_ROWS.slice(0, PAGE_SIZE), total: TOTAL },
      selectionMode: 'multi'
    });
    const checkbox = headerCheckbox(t.target);
    expect(checkbox.getAttribute('aria-label')).toBe('Select the 20 rows on this page');

    checkbox.click();
    flushSync();

    // The measured defect, inverted: one click selected 20 of 400 while the
    // checkbox flipped to a full check and the label said "Deselect all
    // rows" — a consumer's bulk action then acted on 20 where the reader was
    // told "all".
    expect(t.ctx.state.selectedIds.size).toBe(PAGE_SIZE);
    expect(headerCheckbox(t.target).getAttribute('aria-checked')).toBe('mixed');
    expect(headerCheckbox(t.target).checked).toBe(false);
    expect(headerCheckbox(t.target).getAttribute('aria-label')).toBe(
      'Deselect the 20 rows on this page'
    );
  });

  it('client mode keeps the full check (positive control)', () => {
    const t = mountTable({
      items: ALL_ROWS.slice(0, 40),
      selectionMode: 'multi',
      viewDefaults: { pageSize: 40 }
    });
    const checkbox = headerCheckbox(t.target);
    checkbox.click();
    flushSync();

    expect(t.ctx.state.selectedIds.size).toBe(40);
    expect(headerCheckbox(t.target).checked).toBe(true);
    expect(headerCheckbox(t.target).getAttribute('aria-checked')).toBeNull();
    expect(headerCheckbox(t.target).getAttribute('aria-label')).toBe('Deselect all rows');
  });

  it('a one-page server result behaves like client mode — "all" is provable there', () => {
    const t = mountTable({
      source: { processing: 'server', items: ALL_ROWS.slice(0, PAGE_SIZE), total: PAGE_SIZE },
      selectionMode: 'multi'
    });
    headerCheckbox(t.target).click();
    flushSync();

    expect(headerCheckbox(t.target).checked).toBe(true);
    expect(headerCheckbox(t.target).getAttribute('aria-label')).toBe('Deselect all rows');
  });

  it('a partial selection reads mixed with the select label; deselecting one flips it back', () => {
    const t = mountTable({
      source: { processing: 'server', items: ALL_ROWS.slice(0, PAGE_SIZE), total: TOTAL },
      selectionMode: 'multi'
    });

    t.ctx.selectItem(1);
    flushSync();
    expect(headerCheckbox(t.target).getAttribute('aria-checked')).toBe('mixed');
    expect(headerCheckbox(t.target).getAttribute('aria-label')).toBe(
      'Select the 20 rows on this page'
    );

    t.ctx.selectAll();
    flushSync();
    expect(headerCheckbox(t.target).getAttribute('aria-label')).toBe(
      'Deselect the 20 rows on this page'
    );

    t.ctx.deselectItem(1);
    flushSync();
    expect(headerCheckbox(t.target).getAttribute('aria-checked')).toBe('mixed');
    expect(headerCheckbox(t.target).getAttribute('aria-label')).toBe(
      'Select the 20 rows on this page'
    );
  });

  it('a single-row server page uses the singular label', () => {
    const t = mountTable({
      source: { processing: 'server', items: ALL_ROWS.slice(0, 1), total: TOTAL },
      selectionMode: 'multi'
    });
    expect(headerCheckbox(t.target).getAttribute('aria-label')).toBe('Select the row on this page');
  });

  it('an empty server page disables the checkbox instead of offering "the 0 rows"', () => {
    const t = mountTable({
      source: { processing: 'server', items: [], total: TOTAL },
      selectionMode: 'multi'
    });
    // The head keeps rendering over the empty state (probed), so the
    // checkbox is present — and must be disabled rather than offering
    // "Select the 0 rows on this page".
    const input = headerCheckbox(t.target);
    expect(input.disabled).toBe(true);
    expect(input.getAttribute('aria-label')).toBe('Select all rows');
    expect(t.rows()).toBe(0);
  });
});

describe('server mode — applying live updates moves the total with the rows', () => {
  it('manual arm: inserts raise the total, the pager follows, the next result re-seeds', () => {
    const t = mountTable({
      source: { processing: 'server', items: ALL_ROWS.slice(0, PAGE_SIZE), total: TOTAL },
      enableLiveUpdates: true,
      viewDefaults: { pageSize: PAGE_SIZE }
    });
    expect(t.ctx.pageInfo.totalItems).toBe(TOTAL);
    expect(t.ctx.pageInfo.totalPages).toBe(20);

    t.ctx.pushInsert({ id: 1001, name: 'New A', amount: 1 });
    t.ctx.pushInsert({ id: 1002, name: 'New B', amount: 2 });
    t.ctx.pushInsert({ id: 1003, name: 'New C', amount: 3 });
    // Buffered: nothing moves until the user applies.
    expect(t.ctx.pageInfo.totalItems).toBe(TOTAL);

    t.ctx.applyAllUpdates();
    flushSync();

    expect(t.rows()).toBe(PAGE_SIZE + 3);
    expect(t.ctx.pageInfo.totalItems).toBe(TOTAL + 3);
    expect(t.ctx.pageInfo.totalPages).toBe(21);
  });

  it('manual arm: deletes lower the total only by rows that were actually removed', () => {
    const t = mountTable({
      source: { processing: 'server', items: ALL_ROWS.slice(0, PAGE_SIZE), total: TOTAL },
      enableLiveUpdates: true
    });

    t.ctx.pushDelete(1);
    t.ctx.pushDelete(9999); // orphan — not on the loaded page
    t.ctx.applyDeletes();
    flushSync();

    expect(t.rows()).toBe(PAGE_SIZE - 1);
    expect(t.ctx.pageInfo.totalItems).toBe(TOTAL - 1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('orphaned'), expect.anything());
  });

  it('managed arm: the applied delta shows until the next fetch restores the server truth', async () => {
    const { query } = makePagedQuery();
    const t = mountTable({ source: { processing: 'server', query }, enableLiveUpdates: true });
    await vi.advanceTimersByTimeAsync(400);
    await flushMicrotasks();
    expect(t.ctx.pageInfo.totalItems).toBe(TOTAL);

    t.ctx.pushInsert({ id: 1001, name: 'New A', amount: 1 });
    t.ctx.applyAllUpdates();
    flushSync();
    expect(t.ctx.pageInfo.totalItems).toBe(TOTAL + 1);
  });

  it('auto-apply on navigation adjusts the total the same way', async () => {
    const t = mountTable({
      source: { processing: 'server', items: ALL_ROWS.slice(0, PAGE_SIZE), total: TOTAL },
      enableLiveUpdates: true,
      autoApplyOnNavigation: true
    });

    t.ctx.pushInsert({ id: 1001, name: 'New A', amount: 1 });
    expect(t.ctx.pageInfo.totalItems).toBe(TOTAL);

    t.ctx.setPage(2);
    flushSync();
    expect(t.ctx.pageInfo.totalItems).toBe(TOTAL + 1);
  });

  it('a mixed applyAll moves the total by the net delta', () => {
    const t = mountTable({
      source: { processing: 'server', items: ALL_ROWS.slice(0, PAGE_SIZE), total: TOTAL },
      enableLiveUpdates: true,
      viewDefaults: { pageSize: PAGE_SIZE }
    });

    t.ctx.pushInsert({ id: 1001, name: 'New A', amount: 1 });
    t.ctx.pushDelete(1);
    t.ctx.applyAllUpdates();
    flushSync();

    expect(t.rows()).toBe(PAGE_SIZE); // one in, one out
    expect(t.ctx.pageInfo.totalItems).toBe(TOTAL);
  });

  it('an insert cancelled by a delete before the apply moves nothing', () => {
    const t = mountTable({
      source: { processing: 'server', items: ALL_ROWS.slice(0, PAGE_SIZE), total: TOTAL },
      enableLiveUpdates: true
    });

    t.ctx.pushInsert({ id: 1001, name: 'New A', amount: 1 });
    t.ctx.pushDelete(1001); // cancels the pending insert, deletes nothing
    t.ctx.applyAllUpdates();
    flushSync();

    expect(t.rows()).toBe(PAGE_SIZE);
    expect(t.ctx.pageInfo.totalItems).toBe(TOTAL);
  });

  it('pushing the same delete twice lowers the total exactly once', () => {
    const t = mountTable({
      source: { processing: 'server', items: ALL_ROWS.slice(0, PAGE_SIZE), total: TOTAL },
      enableLiveUpdates: true
    });

    t.ctx.pushDelete(1);
    t.ctx.pushDelete(1);
    t.ctx.applyDeletes();
    flushSync();

    expect(t.rows()).toBe(PAGE_SIZE - 1);
    expect(t.ctx.pageInfo.totalItems).toBe(TOTAL - 1);
  });

  it('more removals than a stale-low total leave zero, never a negative range', () => {
    const t = mountTable({
      source: { processing: 'server', items: ALL_ROWS.slice(0, 3), total: 2 },
      enableLiveUpdates: true
    });

    t.ctx.pushDelete(1);
    t.ctx.pushDelete(2);
    t.ctx.pushDelete(3);
    t.ctx.applyDeletes();
    flushSync();

    expect(t.rows()).toBe(0);
    expect(t.ctx.pageInfo.totalItems).toBe(0);
    expect(t.ctx.pageInfo.totalPages).toBe(1);
    expect(t.ctx.pageInfo.rangeStart).toBeGreaterThanOrEqual(1);
  });

  it('client mode never touches serverTotal (positive control)', () => {
    const t = mountTable({
      items: ALL_ROWS.slice(0, 40),
      enableLiveUpdates: true,
      viewDefaults: { pageSize: 10 }
    });
    expect(t.ctx.pageInfo.totalItems).toBe(40);

    t.ctx.pushInsert({ id: 1001, name: 'New A', amount: 1 });
    t.ctx.applyAllUpdates();
    flushSync();

    expect(t.ctx.pageInfo.totalItems).toBe(41);
    expect(t.ctx.state.serverTotal).toBe(0);
  });
});
