// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createTableView } from '$lib/view/view.svelte';
import TableHarness from './__fixtures__/TableHarness.svelte';

/**
 * Row identity in grouped tables, for items without an `id` (#231).
 *
 * `GroupedRow` used to resolve an id-less row's identity as the group-local
 * loop index, while `TableRow` resolves `item.id ?? item.__index` (list-wide,
 * stamped by `normalizeItems`). Under that rule the first id-less row of
 * every group shared the identity `0`: selecting one selected them all,
 * expanding one expanded them all. Both renderers now share
 * `resolveRowItemId`; these assertions pin the grouped half.
 */

// No `id` on purpose — identity must come from the list-wide `__index`.
const ITEMS = [
  { dept: 'A', name: 'Ada' },
  { dept: 'B', name: 'Grace' }
];
const COLUMNS = [
  { accessor: 'name', title: 'Name' },
  { accessor: 'dept', title: 'Dept' }
];

let target: HTMLElement | undefined;
let comp: Record<string, unknown> | undefined;

function mountGrouped(extraProps: Record<string, unknown> = {}) {
  target = document.createElement('div');
  document.body.appendChild(target);
  // Typed wide like `Table.render.svelte.test.ts`'s helper: the harness pins
  // its own Row shape, and these deliberately id-less items are not it.
  const props: Record<string, unknown> = {
    items: ITEMS,
    columns: COLUMNS,
    view: createTableView({ defaults: { groupBy: 'dept' } }),
    ...extraProps
  };
  comp = mount(TableHarness, { target, props }) as Record<string, unknown>;
  flushSync();
  return target;
}

afterEach(() => {
  if (comp) unmount(comp);
  target?.remove();
  comp = undefined;
  target = undefined;
});

describe('grouped rows without an id (#231)', () => {
  it('rows keep distinct identities across groups', () => {
    const el = mountGrouped({ selectionMode: 'multi' });

    // Before the fix both data rows resolved to `0` and rendered the same
    // test id — a duplicate node here is the collision itself.
    expect(el.querySelectorAll('[data-testid="grouped-item-0"]').length).toBe(1);
    expect(el.querySelector('[data-testid="grouped-item-1"]')).toBeTruthy();
  });

  it('selecting the first row of group A leaves group B unselected', () => {
    const el = mountGrouped({ selectionMode: 'multi' });

    const firstRow = el.querySelector('tr[data-row-index="0"]');
    const checkbox = firstRow?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
    checkbox?.click();
    flushSync();

    const selected = el.querySelectorAll('tbody tr[aria-selected="true"]');
    expect(selected.length).toBe(1);
    expect(selected[0]?.textContent).toContain('Ada');
  });

  it('expanding the first row of group A leaves group B collapsed', () => {
    const detail = createRawSnippet(() => ({ render: () => '<div>detail</div>' }));
    const el = mountGrouped({ expandable: true, expandedRowContent: detail });

    el.querySelector<HTMLButtonElement>('[data-testid="expand-button-0"]')?.click();
    flushSync();

    expect(el.querySelectorAll('[data-testid^="expanded-row-"]').length).toBe(1);
  });
});
