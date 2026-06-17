import { SvelteSet } from 'svelte/reactivity';
import type { Column } from '$lib/types/tableTypes';
import { resolveColumnId } from '$lib/utils';
import type { TableState } from './types';

/**
 * Column visibility concern: manages which columns are shown or hidden.
 */
export function useColumnVisibility(state: TableState) {
  let allColumns = $state<Column[]>([]);
  let hiddenColumnKeys = new SvelteSet<string>();

  function setColumns(newColumns: Column[]) {
    allColumns = [...newColumns];
    state.columns = newColumns.filter((col) => !hiddenColumnKeys.has(resolveColumnId(col)));
  }

  function hideColumn(id: string) {
    hiddenColumnKeys = new SvelteSet([...hiddenColumnKeys, id]);
    state.columns = allColumns.filter((col) => !hiddenColumnKeys.has(resolveColumnId(col)));
  }

  function showColumn(id: string) {
    const next = new SvelteSet(hiddenColumnKeys);
    next.delete(id);
    hiddenColumnKeys = next;
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
    hiddenColumnKeys = new SvelteSet();
    state.columns = [...allColumns];
  }

  /**
   * Replace the hidden-column set wholesale. Used by the host store to
   * apply a persisted snapshot before the consumer's `columns` prop
   * reaches `setColumns`. Filtering of `state.columns` happens lazily on
   * the next `setColumns` call.
   */
  function setHiddenIds(ids: Iterable<string>) {
    hiddenColumnKeys = new SvelteSet(ids);
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
