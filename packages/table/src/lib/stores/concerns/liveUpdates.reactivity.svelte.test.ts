import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Column } from '$lib/types/tableTypes';
import type { TableState } from './types';
import { useColumnVisibility } from './useColumnVisibility.svelte.js';
import { useLiveUpdates } from './useLiveUpdates.svelte.js';

/**
 * Reactivity invariants for concern-local SvelteSet state.
 *
 * Regression guard: `deletes`, `recentlyUpdatedIds` (useLiveUpdates) and
 * `hiddenColumnKeys` (useColumnVisibility) were plain `let` bindings whose
 * SvelteSet instances were swapped on write. The reassignment of a plain `let`
 * is not a signal write, so $derived consumers (banner counts, row highlight,
 * hidden-column menus) kept tracking the stale instance and never re-ran.
 * The sets are now mutated in place; these tests observe them through
 * $effect.root + flushSync (no DOM, no component context).
 */

function makeLiveState() {
  return {
    items: [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
      { id: 3, name: 'Charlie', age: 35 }
    ],
    selectionMode: 'none' as const,
    selectedIds: new Set<string | number>()
  } as unknown as TableState;
}

describe('useLiveUpdates reactivity', () => {
  it('a delete-only push updates hasPending and counts immediately', () => {
    const cleanup = $effect.root(() => {
      const live = useLiveUpdates(makeLiveState());

      let pending = false;
      let deletes = -1;
      let total = -1;
      $effect(() => {
        pending = live.hasPending;
        deletes = live.counts.deletes;
        total = live.counts.total;
      });

      flushSync();
      expect(pending).toBe(false);
      expect(deletes).toBe(0);

      live.pushDelete(2);
      flushSync();
      expect(pending).toBe(true); // banner appears without a later insert/update
      expect(deletes).toBe(1);
      expect(total).toBe(1);
    });
    cleanup();
  });

  it('isPendingDelete and dismissAll are observable for delete-only buffers', () => {
    const cleanup = $effect.root(() => {
      const live = useLiveUpdates(makeLiveState());

      let rowPendingDelete = false;
      let pending = false;
      $effect(() => {
        rowPendingDelete = live.isPendingDelete(2);
        pending = live.hasPending;
      });

      live.pushDelete(2);
      flushSync();
      expect(rowPendingDelete).toBe(true);
      expect(pending).toBe(true);

      live.dismissAll();
      flushSync();
      expect(rowPendingDelete).toBe(false);
      expect(pending).toBe(false);
    });
    cleanup();
  });

  it('applyDeletes clears the pending buffer observably', () => {
    const cleanup = $effect.root(() => {
      const state = makeLiveState();
      const live = useLiveUpdates(state);

      let pending = false;
      $effect(() => {
        pending = live.hasPending;
      });

      live.pushDelete(2);
      flushSync();
      expect(pending).toBe(true);

      live.applyDeletes();
      flushSync();
      expect(pending).toBe(false);
      expect(state.items.find((i) => i.id === 2)).toBeUndefined();
    });
    cleanup();
  });

  describe('recently-updated highlight', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('applyUpdates marks rows as recently updated and clears after timeout', () => {
      const cleanup = $effect.root(() => {
        const live = useLiveUpdates(makeLiveState());

        let highlighted = false;
        $effect(() => {
          highlighted = live.isRecentlyUpdated(1);
        });

        flushSync();
        expect(highlighted).toBe(false);

        live.pushUpdate(1, { name: 'Alice Updated' });
        live.applyUpdates();
        flushSync();
        expect(highlighted).toBe(true); // highlight fires reactively after apply

        vi.advanceTimersByTime(3000);
        flushSync();
        expect(highlighted).toBe(false); // auto-cleared, observably
      });
      cleanup();
    });

    it('a second apply within the window extends the highlight set', () => {
      const cleanup = $effect.root(() => {
        const live = useLiveUpdates(makeLiveState());

        let first = false;
        let second = false;
        $effect(() => {
          first = live.isRecentlyUpdated(1);
          second = live.isRecentlyUpdated(2);
        });

        live.pushUpdate(1, { age: 31 });
        live.applyUpdates();
        flushSync();

        vi.advanceTimersByTime(1500);
        live.pushUpdate(2, { age: 26 });
        live.applyUpdates();
        flushSync();
        expect(first).toBe(true);
        expect(second).toBe(true);

        // Timer was restarted by the second apply
        vi.advanceTimersByTime(3000);
        flushSync();
        expect(first).toBe(false);
        expect(second).toBe(false);
      });
      cleanup();
    });
  });

  it('a push alone never mutates items — apply is deferred', () => {
    const cleanup = $effect.root(() => {
      const state = makeLiveState();
      const live = useLiveUpdates(state);

      live.pushInsert({ id: 4, name: 'Diana' });
      live.pushUpdate(1, { name: 'Alice Updated' });
      live.pushDelete(2);
      flushSync();

      expect(state.items).toHaveLength(3);
      expect(state.items[0].name).toBe('Alice');
      expect(live.hasPending).toBe(true);

      live.applyAll();
      flushSync();
      expect(live.hasPending).toBe(false);
      expect(state.items.map((i) => i.id).sort()).toEqual([1, 3, 4]);
    });
    cleanup();
  });
});

describe('useColumnVisibility reactivity', () => {
  const columns = [
    { accessor: 'name', title: 'Name' },
    { accessor: 'age', title: 'Age' },
    { accessor: 'email', title: 'Email' }
  ] as Column[];

  it('hide/show/showAll update $derived consumers of hiddenColumnKeys', () => {
    const cleanup = $effect.root(() => {
      const state = { columns: [] as Column[] } as unknown as TableState;
      const visibility = useColumnVisibility(state);
      visibility.setColumns(columns);

      let hiddenCount = -1;
      let ageHidden = false;
      $effect(() => {
        hiddenCount = visibility.hiddenColumnKeys.size;
        ageHidden = visibility.hiddenColumnKeys.has('age');
      });

      flushSync();
      expect(hiddenCount).toBe(0);

      visibility.hideColumn('age');
      flushSync();
      expect(hiddenCount).toBe(1);
      expect(ageHidden).toBe(true);

      visibility.hideColumn('email');
      flushSync();
      expect(hiddenCount).toBe(2);

      visibility.showColumn('age');
      flushSync();
      expect(hiddenCount).toBe(1);
      expect(ageHidden).toBe(false);

      visibility.showAllColumns();
      flushSync();
      expect(hiddenCount).toBe(0);
    });
    cleanup();
  });

  it('setHiddenIds replaces the set observably', () => {
    const cleanup = $effect.root(() => {
      const state = { columns: [] as Column[] } as unknown as TableState;
      const visibility = useColumnVisibility(state);
      visibility.setColumns(columns);

      let hidden: string[] = [];
      $effect(() => {
        hidden = [...visibility.hiddenColumnKeys].sort();
      });

      visibility.setHiddenIds(['age', 'email']);
      flushSync();
      expect(hidden).toEqual(['age', 'email']);

      visibility.setHiddenIds(['name']);
      flushSync();
      expect(hidden).toEqual(['name']);
    });
    cleanup();
  });
});
