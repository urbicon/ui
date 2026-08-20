// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { TablePage } from '$lib/types/tableTypes';
import { createTableView, type TableViewSnapshot } from '$lib/view/view.svelte';
import TableHarness from './__fixtures__/TableHarness.svelte';

/**
 * The mobile cards share the row decisions (#232, the third copy): identity
 * through resolveRowItemId, cards that stay put during a fetch, and the full
 * list where client-side virtualization suspends paging.
 */

const ROWS = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  dept: i % 2 ? 'A' : 'B',
  name: `Row ${i + 1}`,
  amount: i
}));
const COLUMNS = [
  { accessor: 'name', title: 'Name' },
  { accessor: 'amount', title: 'Amount' }
];

let target: HTMLElement | undefined;
let comp: Record<string, unknown> | undefined;

function mountTable(extraProps: Record<string, unknown>) {
  target = document.createElement('div');
  document.body.appendChild(target);
  // Typed wide like the identity test's helper: the harness pins its own Row
  // shape, and these deliberately loose fixtures are not it.
  const props: Record<string, unknown> = { columns: COLUMNS, ...extraProps };
  comp = mount(TableHarness, { target, props }) as Record<string, unknown>;
  flushSync();
  return target;
}

function cards(el: HTMLElement): number {
  // Scoped to the list container's direct children: a bare prefix match
  // would silently count any future child test id a card might grow.
  return el.querySelectorAll(
    '[data-testid="mobile-table"] [data-testid^="mobile-card-"]:not([data-testid*="-cell"])'
  ).length;
}

async function drain(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
}

afterEach(() => {
  if (comp) unmount(comp);
  target?.remove();
  comp = undefined;
  target = undefined;
});

describe('mobile cards share the row decisions', () => {
  it('the cards stay put during a page fetch — loading text only while empty', async () => {
    const resolvers: Array<(p: TablePage) => void> = [];
    const query = (_q: TableViewSnapshot): Promise<TablePage> =>
      new Promise((res) => {
        resolvers.push(res);
      });
    const view = createTableView({ defaults: { pageSize: 10 } });
    const el = mountTable({
      items: undefined,
      view,
      source: { processing: 'server', query, debounceMs: 0 }
    });

    // First load: nothing to show yet, the loading text is right.
    await drain();
    expect(el.querySelector('[data-testid="loading-state-mobile"]')).toBeTruthy();
    resolvers[0]?.({ items: ROWS.slice(0, 10), total: 30 });
    await drain();
    expect(cards(el)).toBe(10);

    // Page turn: the fetch is pending, but the cards must not unmount.
    view.applyExternal({ page: 2 }, 'external');
    await drain();
    expect(resolvers.length).toBe(2);
    expect(el.querySelector('[data-testid="loading-state-mobile"]')).toBeNull();
    expect(cards(el)).toBe(10);

    resolvers[1]?.({ items: ROWS.slice(10, 20), total: 30 });
    await drain();
    expect(el.querySelector('[data-testid="mobile-card-11"]')).toBeTruthy();
  });

  it('client-side virtualization keeps the cards paging, with a mobile-only pager', () => {
    const el = mountTable({
      items: ROWS,
      view: createTableView({ defaults: { pageSize: 10 } }),
      virtualized: true
    });
    // The desktop scroll container holds the whole list, but this layout is
    // always mounted and has no window renderer — a full card list would be
    // O(n) DOM on every viewport. The cards keep their page slice, and the
    // shared pager renders scoped to the mobile layout by CSS.
    expect(cards(el)).toBe(10);
    const nav = el.querySelector('nav');
    expect(nav).toBeTruthy();
    const wrapper = nav?.closest('div[class*="transition-opacity"]');
    expect(wrapper?.className).toMatch(/@min-\[\d+rem\]:hidden/);
  });

  it('positive control: without virtualization the pager is not mobile-scoped', () => {
    const el = mountTable({
      items: ROWS,
      view: createTableView({ defaults: { pageSize: 10 } })
    });
    expect(cards(el)).toBe(10);
    const nav = el.querySelector('nav');
    expect(nav).toBeTruthy();
    const wrapper = nav?.closest('div[class*="transition-opacity"]');
    expect(wrapper?.className).not.toMatch(/@min-\[\d+rem\]:hidden/);
  });

  it('id-less rows keep distinct card identities across groups', () => {
    const el = mountTable({
      items: [
        { dept: 'A', name: 'Ada' },
        { dept: 'B', name: 'Grace' }
      ],
      view: createTableView({ defaults: { groupBy: 'dept' } })
    });
    // A loop-local key resolved both first rows to the same identity before —
    // the shared rule keys them by the list-wide __index.
    expect(el.querySelectorAll('[data-testid="mobile-card-0"]').length).toBe(1);
    expect(el.querySelector('[data-testid="mobile-card-1"]')).toBeTruthy();
  });
});
