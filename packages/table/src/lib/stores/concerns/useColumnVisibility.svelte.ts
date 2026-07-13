import { SvelteSet } from 'svelte/reactivity';
import type { Column } from '$lib/types/tableTypes';
import { resolveColumnId } from '$lib/utils';
import type { TableState } from './types';

/**
 * Column visibility concern: manages which columns are shown or hidden.
 */
export function useColumnVisibility(state: TableState) {
  let allColumns = $state<Column[]>([]);
  // Mutated in place — a plain `let` holding a SvelteSet is NOT reactive when the
  // instance is swapped, so $derived consumers (HeaderMenu "show column" list,
  // ColumnVisibilityMenu badge) would keep tracking the stale instance.
  const hiddenColumnKeys = new SvelteSet<string>();

  function setColumns(newColumns: Column[]) {
    allColumns = [...newColumns];
    state.columns = newColumns.filter((col) => !hiddenColumnKeys.has(resolveColumnId(col)));
  }

  function hideColumn(id: string) {
    hiddenColumnKeys.add(id);
    state.columns = allColumns.filter((col) => !hiddenColumnKeys.has(resolveColumnId(col)));
  }

  function showColumn(id: string) {
    hiddenColumnKeys.delete(id);
    state.columns = allColumns.filter((col) => !hiddenColumnKeys.has(resolveColumnId(col)));
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
    state.columns = [...allColumns];
  }

  /**
   * Replace the hidden-column set wholesale. Used by the host store to
   * apply a persisted snapshot before the consumer's `columns` prop
   * reaches `setColumns`. Filtering of `state.columns` happens lazily on
   * the next `setColumns` call.
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
