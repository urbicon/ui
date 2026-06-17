import type { TableItem } from '$lib/types/tableTypes';
import type { TableState } from './types';

function resolveRowId(item: TableItem): string | number | undefined {
  const id = item.id ?? item.__index;
  return typeof id === 'string' || typeof id === 'number' ? id : undefined;
}

/**
 * Selection concern: manages row selection state.
 * Supports single-select and multi-select modes.
 * @param state - Shared table state.
 * @param getFilteredItems - Getter for filtered items (used for selectAll scope).
 */
export function useSelection(state: TableState, getFilteredItems: () => TableItem[]) {
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

  function selectItem(id: string | number) {
    if (state.selectionMode === 'none') return;

    if (state.selectionMode === 'single') {
      state.selectedIds.clear();
      state.selectedIds.add(id);
    } else {
      state.selectedIds.add(id);
    }
  }

  function deselectItem(id: string | number) {
    state.selectedIds.delete(id);
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
    for (const item of getFilteredItems()) {
      const id = resolveRowId(item);
      if (id !== undefined) state.selectedIds.add(id);
    }
  }

  function deselectAll() {
    state.selectedIds.clear();
  }

  function toggleAll() {
    if (allSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  }

  function isSelected(id: string | number): boolean {
    return state.selectedIds.has(id);
  }

  function setSelectedIds(ids: Array<string | number>) {
    state.selectedIds.clear();
    for (const id of ids) state.selectedIds.add(id);
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
    setSelectedIds
  };
}
