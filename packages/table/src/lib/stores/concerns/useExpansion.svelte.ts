import { SvelteSet } from 'svelte/reactivity';
import type { TableState } from './types';

/**
 * Expansion concern: manages row expand/collapse state.
 * Supports both single-expand and multi-expand modes.
 */
export function useExpansion(state: TableState) {
  function toggleExpand(itemId: string | number) {
    if (state.multiExpand) {
      const next = new SvelteSet(state.expandedItemIds);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      state.expandedItemIds = next;
    } else {
      state.expandedItemId = state.expandedItemId === itemId ? null : itemId;
    }
  }

  function isItemExpanded(itemId: string | number): boolean {
    if (state.multiExpand) {
      return state.expandedItemIds.has(itemId);
    }
    return state.expandedItemId === itemId;
  }

  return {
    toggleExpand,
    isItemExpanded
  };
}
