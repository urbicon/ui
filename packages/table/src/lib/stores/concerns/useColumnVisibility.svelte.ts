import { SvelteSet } from 'svelte/reactivity';
import type { Column } from '$lib/types/tableTypes';
import { resolveColumnId } from '$lib/utils';

/**
 * Column visibility concern: manages which columns are shown or hidden.
 *
 * `sourceColumns` is the consumer's `columns` prop, read through a getter. It
 * used to arrive via `setColumns` from an `$effect` in `TableProvider`, which
 * meant the server render had no columns at all (#10) and every visibility
 * change had to re-assign `state.columns` by hand — four near-identical filter
 * expressions, one per mutator.
 *
 * Now the visible set is a derivation of two inputs (the full list and the
 * hidden ids), so the mutators only touch the hidden ids and the filtered view
 * follows. `setColumns` remains for imperative callers: assigning to a derived
 * overrides it until the prop behind it changes.
 *
 * The concern no longer takes `state` at all: it stopped writing into the shared
 * bucket, so it has nothing to reach for. `createTableState` binds `state.columns`
 * to `visibleColumns`.
 */
export function useColumnVisibility(sourceColumns?: () => Column[]) {
  let allColumns = $derived(sourceColumns?.() ?? []);
  // Mutated in place — a plain `let` holding a SvelteSet is NOT reactive when the
  // instance is swapped, so $derived consumers (HeaderMenu "show column" list,
  // ColumnVisibilityMenu badge) would keep tracking the stale instance.
  const hiddenColumnKeys = new SvelteSet<string>();

  /** The subset `state.columns` exposes: everything not hidden. */
  const visibleColumns = $derived(
    allColumns.filter((col) => !hiddenColumnKeys.has(resolveColumnId(col)))
  );

  /**
   * Replace the full column list imperatively. Overrides the `columns` prop
   * until that prop changes again.
   */
  function setColumns(newColumns: Column[]) {
    allColumns = [...newColumns];
  }

  function hideColumn(id: string) {
    hiddenColumnKeys.add(id);
  }

  function showColumn(id: string) {
    hiddenColumnKeys.delete(id);
  }

  function toggleColumnVisibility(id: string) {
    if (hiddenColumnKeys.has(id)) {
      showColumn(id);
    } else {
      hideColumn(id);
    }
  }

  function showAllColumns() {
    hiddenColumnKeys.clear();
  }

  /**
   * Replace the hidden-column set wholesale. Used by the host store to apply a
   * persisted snapshot at construction — before the `columns` prop is read, and
   * now without any ordering constraint, since the visible set is derived from
   * both inputs rather than computed at write time.
   */
  function setHiddenIds(ids: Iterable<string>) {
    hiddenColumnKeys.clear();
    for (const id of ids) {
      hiddenColumnKeys.add(id);
    }
  }

  return {
    get allColumns() {
      return allColumns;
    },
    get visibleColumns() {
      return visibleColumns;
    },
    get hiddenColumnKeys() {
      return hiddenColumnKeys;
    },
    setColumns,
    setHiddenIds,
    hideColumn,
    showColumn,
    toggleColumnVisibility,
    showAllColumns
  };
}
