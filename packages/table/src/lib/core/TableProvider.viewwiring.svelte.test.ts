// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTableView } from '$lib/view/view.svelte';
import type { InternalTableContext } from '../stores/TableStore.svelte';
import TableHarness from './__fixtures__/TableHarness.svelte';
import type { TableContext } from './table/index';

/**
 * The provider's view wiring, mounted — the §12.11 answers of the v8 review
 * pinned against the real component tree (`Table.render.svelte.test.ts` is
 * the model; this file covers the wiring the render suite does not):
 *
 * - virtualization × grouping, both halves: a grouping the view *arrives*
 *   with is discarded at construction, one arriving later through a binding's
 *   `applyExternal` is discarded at runtime — both as `system` writes, so
 *   the URL binding may clean the param while the storage binding keeps the
 *   discard out of storage,
 * - the store's read gate and setter gate agreeing on the same overridable
 *   `virtualized` slot (the adversarial review's gate-divergence finding),
 * - live updates buffering until the next navigation (`autoApplyOnNavigation`
 *   over the view's snapshot, not the pending buffer).
 */

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? (map.get(key) ?? null) : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, String(value))
  };
}

const ROWS = [
  { id: 1, name: 'Ada', amount: 100 },
  { id: 2, name: 'Grace', amount: 200 },
  { id: 3, name: 'Radia', amount: 300 }
];

let target: HTMLElement | undefined;
let comp: Record<string, unknown> | undefined;

function mountTable(props: Record<string, unknown> = {}) {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(TableHarness, { target, props: { items: ROWS, ...props } }) as Record<
    string,
    unknown
  >;
  flushSync();
  return target;
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true });
  // The discard warns in DEV (vitest runs DEV) — spied so the suite's output
  // stays clean and the warning itself is assertable.
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  if (comp) unmount(comp);
  target?.remove();
  comp = undefined;
  target = undefined;
  warn.mockRestore();
});

describe('virtualization × grouping — the system discard', () => {
  it('discards a grouping the view arrives with at construction, as a system decision', () => {
    // `defaults.groupBy` stands in for every arrival path that precedes the
    // provider (constructor defaults, a URL binding's synchronous init).
    const view = createTableView({ defaults: { groupBy: 'name' } });
    mountTable({ view, virtualized: true });

    expect(view.groupBy).toBeNull();
    // `system`, not `external` or `user`: the URL binding mirrors the
    // discard (cleans the param), the storage binding un-dirties the axis —
    // a persisted grouping lives again on the next un-virtualized load.
    expect(view.originOf('groupBy').origin).toBe('system');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('virtualized'));
  });

  it('discards a grouping arriving at runtime through applyExternal while virtualized', () => {
    const view = createTableView();
    mountTable({ view, virtualized: true });
    expect(view.groupBy).toBeNull();

    // A later URL navigation applies `?group=name` — no setter involved.
    view.applyExternal({ groupBy: 'name' }, 'external');
    flushSync();

    expect(view.groupBy).toBeNull();
    expect(view.originOf('groupBy').origin).toBe('system');
  });

  it('the read gate follows the same overridable virtualized slot as the setter gate', () => {
    // The read gate used to consult the raw `virtualized` prop while the
    // grouping setter gate read the store's overridable slot — a runtime
    // write to `state.virtualized` made the two disagree about what
    // "virtualized" currently means.
    const view = createTableView({ defaults: { groupBy: 'name' } });
    let ctx: TableContext | undefined;
    mountTable({ view, onReady: (c: TableContext) => (ctx = c) }); // NOT virtualized
    expect(ctx?.state.effectiveGroupBy).toBe('name'); // the grouping stands

    if (!ctx) throw new Error('onReady never fired');
    ctx.state.virtualized = true; // runtime override through the slot, not the prop
    flushSync();

    expect(ctx.state.effectiveGroupBy).toBeNull(); // hidden by the same slot the setter gate reads
  });
});

describe('live updates — buffered until the next navigation', () => {
  it('a pushed insert waits in the buffer and applies on setPage', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      name: `Person ${i}`,
      amount: i
    }));
    // Wide: `setPage` (the unclamped raw write) is in-tree surface.
    let ctx: InternalTableContext | undefined;
    mountTable({
      items: many,
      enableLiveUpdates: true,
      onReady: (c: TableContext) => (ctx = c as InternalTableContext)
    });
    if (!ctx) throw new Error('onReady never fired');

    ctx.pushInsert({ id: 99, name: 'Zusatz', amount: 999 });
    flushSync();
    expect(ctx.hasPendingUpdates).toBe(true); // buffered…
    expect(ctx.state.items.some((item) => item.id === 99)).toBe(false); // …not applied

    ctx.setPage(2); // the reader navigates — the view is already changing
    flushSync();

    expect(ctx.hasPendingUpdates).toBe(false);
    expect(ctx.state.items.some((item) => item.id === 99)).toBe(true);
  });
});
