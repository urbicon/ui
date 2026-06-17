import { SvelteMap } from 'svelte/reactivity';
import type { Column } from '$lib/types/tableTypes';
import { resolveColumnId } from '$lib/utils';
import type { TableState } from './types';

/**
 * Column order concern: manages column reordering.
 * Maintains an ordered list of column ids and provides reorder operations.
 * @param state - Shared table state (reads `columns` for initial order).
 */
export function useColumnOrder(state: TableState) {
  let columnOrder = $state<string[]>([]);

  /** Columns sorted by the current order. Falls back to original order for unknown ids. */
  const orderedColumns = $derived.by((): Column[] => {
    if (columnOrder.length === 0) return state.columns;

    const columnMap = new SvelteMap(state.columns.map((col) => [resolveColumnId(col), col]));
    const ordered: Column[] = [];

    // Add columns in the specified order
    for (const id of columnOrder) {
      const col = columnMap.get(id);
      if (col) {
        ordered.push(col);
        columnMap.delete(id);
      }
    }

    // Append any remaining columns not in the order (newly added columns)
    for (const col of columnMap.values()) {
      ordered.push(col);
    }

    return ordered;
  });

  /** Initialize order from current columns (called when columns change). */
  function initOrder(columns: Column[]) {
    columnOrder = columns.map((col) => resolveColumnId(col));
  }

  /** Move a column from one index to another. */
  function reorderColumn(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    if (columnOrder.length === 0) {
      columnOrder = state.columns.map((col) => resolveColumnId(col));
    }

    const next = [...columnOrder];
    if (fromIndex < 0 || fromIndex >= next.length || toIndex < 0 || toIndex > next.length) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    columnOrder = next;
  }

  /** Reset column order to the original (as defined by `columns` prop). */
  function resetColumnOrder() {
    columnOrder = [];
  }

  /**
   * Replace the order wholesale with a persisted snapshot. Unknown ids
   * are kept as-is — the derived `orderedColumns` will gracefully drop
   * any id that no longer matches a known column, and newly added
   * columns (not in the snapshot) are appended at the end.
   */
  function applyOrder(order: string[]) {
    columnOrder = [...order];
  }

  /** Get the current order index for a column id. Returns -1 if not found. */
  function getColumnIndex(id: string): number {
    if (columnOrder.length === 0) {
      return state.columns.findIndex((col) => resolveColumnId(col) === id);
    }
    return columnOrder.indexOf(id);
  }

  return {
    get orderedColumns() {
      return orderedColumns;
    },
    get columnOrder() {
      return columnOrder;
    },
    initOrder,
    reorderColumn,
    resetColumnOrder,
    applyOrder,
    getColumnIndex
  };
}
