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
