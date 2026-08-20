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

    const table = t.target.querySelector('[data-testid="table-element"]');
    expect(table?.getAttribute('aria-rowcount')).toBe(String(TOTAL));
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
