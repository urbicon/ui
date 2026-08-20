import type { TableItem } from '$lib/types/tableTypes';
import type { TableState } from './types';

function resolveRowId(item: TableItem): string | number | undefined {
  const id = item.id ?? item.__index;
  return typeof id === 'string' || typeof id === 'number' ? id : undefined;
}

/**
 * The provenance of a selection write. `user` is the reader acting on the
 * table (persisted, when persistence is on); `external` is a value arriving
 * from outside the interaction — a construction seed, storage hydration, a
 * controlled prop echo — and must never write back to storage (it would
 * resurrect on a later switch to uncontrolled, the class of bug the
 * `*Controlled` flags were invented to patch one axis at a time).
 */
type WriteOrigin = 'user' | 'external';

export interface UseSelectionOptions {
  /** Called after a `user`-origin write actually changed the selection. */
  onPersist?: () => void;
}

/**
 * Selection concern: manages row selection state.
 * Supports single-select and multi-select modes.
 *
 * Every write goes through one commit gate: whether a write persists is
 * decided by its origin, not by call-site discipline in wrappers. This is
 * the selection's version of the view axes' origin rule — deliberately NOT
 * the full `ViewOrigin` machinery (claims, echo guard, bindings), because
 * selection is a preference (#152: storage, never the URL), not a view axis.
 * `selectionControlled` keeps its narrower job: ownership — "the prop is the
 * truth" — which gates both hydration and `syncSelection` itself.
 *
 * @param state - Shared table state.
 * @param getFilteredItems - Getter for filtered items (used for selectAll scope).
 * @param options - `onPersist` wiring (the store passes the prefs sync).
 */
export function useSelection(
  state: TableState,
  getFilteredItems: () => TableItem[],
  options?: UseSelectionOptions
) {
  /** Derived list of currently selected items (resolved from selectedIds). */
  const selectedItems = $derived.by((): TableItem[] => {
    if (state.selectionMode === 'none' || state.selectedIds.size === 0) return [];
    return state.items.filter((item) => {
      const id = resolveRowId(item);
      return id !== undefined && state.selectedIds.has(id);
    });
  });

  /** Whether all visible (filtered) items are selected. */
  const allSelected = $derived.by((): boolean => {
    const items = getFilteredItems();
    if (items.length === 0 || state.selectedIds.size === 0) return false;
    return items.every((item) => {
      const id = resolveRowId(item);
      return id !== undefined && state.selectedIds.has(id);
    });
  });

  /** Whether some but not all visible items are selected (indeterminate state). */
  const someSelected = $derived.by((): boolean => {
    if (allSelected) return false;
    const items = getFilteredItems();
    return items.some((item) => {
      const id = resolveRowId(item);
      return id !== undefined && state.selectedIds.has(id);
    });
  });

  /**
   * The one write path. Invariants live here, once, for all callers:
   *
   * - Idempotence: an unchanged selection is not re-committed. A controlled
   *   parent echoing the current selection back (the selectedIds +
   *   onSelectionChange round trip) must not re-mutate the set — clear()+add()
   *   of identical ids still bumps the per-key sources, which re-invalidates
   *   `selectedItems`, re-fires onSelectionChange and ping-pongs the
   *   controlled loop per flush. The guard compares as sets, so a duplicated
   *   incoming array (['a','a'] against current {'a','b'}) can't
   *   false-positive on matching cardinality.
   * - The existing `SvelteSet` instance is mutated, never replaced — a
   *   replaced instance detaches every derived that tracked the old one.
   *   Ids that stay selected are not touched at all (no delete+add bump).
   * - `origin === 'user'` notifies `onPersist`; `external` never does.
   *   Idempotence gates the MUTATION, not the notification: a value-identical
   *   user write is still an act of ownership, and storage must learn a value
   *   it does not hold yet — the seeded (external) selection reaches storage
   *   the moment the user confirms it with a real action, even one that
   *   changes nothing (pinned in seed.persistence). The controlled echo also
   *   arrives as `user` and also notifies; it still never reaches storage,
   *   because `syncSelection` itself skips while `selectionControlled`.
   *   {@link deselectMany} is the one caller that filters BEFORE the gate:
   *   a live-update prune is not a confirming user act (see there).
   */
  function commit(next: ReadonlySet<string | number>, origin: WriteOrigin): void {
    let identical = next.size === state.selectedIds.size;
    if (identical) {
      for (const id of next) {
        if (!state.selectedIds.has(id)) {
          identical = false;
          break;
        }
      }
    }

    if (!identical) {
      if (import.meta.env?.DEV && state.selectionMode === 'single' && next.size > 1) {
        console.warn(
          `[Table] Selection commit of ${next.size} ids while selectionMode is "single" — ` +
            `only one row can be selected; check the caller.`
        );
      }

      for (const id of [...state.selectedIds]) {
        if (!next.has(id)) state.selectedIds.delete(id);
      }
      for (const id of next) {
        if (!state.selectedIds.has(id)) state.selectedIds.add(id);
      }
    }

    if (origin === 'user') options?.onPersist?.();
  }

  function selectItem(id: string | number) {
    if (state.selectionMode === 'none') return;

    if (state.selectionMode === 'single') {
      commit(new Set([id]), 'user');
    } else {
      const next = new Set(state.selectedIds);
      next.add(id);
      commit(next, 'user');
    }
  }

  function deselectItem(id: string | number) {
    const next = new Set(state.selectedIds);
    next.delete(id);
    commit(next, 'user');
  }

  function toggleItem(id: string | number) {
    if (state.selectedIds.has(id)) {
      deselectItem(id);
    } else {
      selectItem(id);
    }
  }

  function selectAll() {
    if (state.selectionMode !== 'multi') return;
    const next = new Set(state.selectedIds);
    for (const item of getFilteredItems()) {
      const id = resolveRowId(item);
      if (id !== undefined) next.add(id);
    }
    commit(next, 'user');
  }

  function deselectAll() {
    commit(new Set(), 'user');
  }

  function toggleAll() {
    if (allSelected) {
      // The filtered rows, not the whole set — `selectAll` only ever adds those,
      // so its undo may only remove those. `deselectAll()` here made the header
      // checkbox asymmetric under a filter: it selected the twelve rows in view
      // and then cleared all forty, including the twenty-eight the reader had
      // picked before narrowing and could no longer see.
      const next = new Set(state.selectedIds);
      for (const item of getFilteredItems()) {
        const id = resolveRowId(item);
        if (id !== undefined) next.delete(id);
      }
      commit(next, 'user');
    } else {
      selectAll();
    }
  }

  function isSelected(id: string | number): boolean {
    return state.selectedIds.has(id);
  }

  function setSelectedIds(ids: Array<string | number>, origin: WriteOrigin = 'user') {
    commit(new Set(ids), origin);
  }

  /**
   * Remove many ids at once (live-update delete pruning). Not public API.
   *
   * Returns early — before the gate — when nothing intersects: a live-update
   * delete that touched no selected row is not a user acting on the
   * selection, so it must not notify either. (The "value-identical user
   * write still notifies" rule in {@link commit} is for the user-facing
   * methods, where the write IS the confirming act; a prune with an empty
   * intersection would otherwise hand a merely-seeded, never-confirmed
   * selection to storage through an unrelated applyDeletes.)
   */
  function deselectMany(ids: Iterable<string | number>, origin: WriteOrigin = 'user') {
    const next = new Set(state.selectedIds);
    let intersected = false;
    for (const id of ids) {
      if (next.delete(id)) intersected = true;
    }
    if (!intersected) return;
    commit(next, origin);
  }

  return {
    get selectedItems() {
      return selectedItems;
    },
    get allSelected() {
      return allSelected;
    },
    get someSelected() {
      return someSelected;
    },
    selectItem,
    deselectItem,
    toggleItem,
    selectAll,
    deselectAll,
    toggleAll,
    isSelected,
    setSelectedIds,
    deselectMany
  };
}
