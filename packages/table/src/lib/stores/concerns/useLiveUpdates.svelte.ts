import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { TableItem } from '$lib/types/tableTypes';
import { normalizeItems } from '$lib/utils';
import type { TableState } from './types';

function pickRowId(item: TableItem): string | number | undefined {
  const id = item.id ?? item.__index;
  return typeof id === 'string' || typeof id === 'number' ? id : undefined;
}

/**
 * Summary of pending live changes.
 */
export interface LiveUpdateCounts {
  inserts: number;
  updates: number;
  deletes: number;
  total: number;
}

/**
 * A pending update: the item ID and the changed fields.
 */
export interface PendingUpdate {
  id: string | number;
  changes: Partial<TableItem>;
}

/**
 * Live updates concern: manages a pending buffer of inserts, updates, and deletes
 * that are NOT immediately applied to the visible table.
 *
 * Instead, the UI shows a notification (e.g. "3 new, 2 updated") and the user
 * decides when to merge them. This avoids disorienting UX issues like rows
 * jumping, disappearing, or conflicting with active selection/editing.
 *
 * @param state - Shared table state (items are modified on apply).
 */
export function useLiveUpdates(state: TableState) {
  let inserts = $state<TableItem[]>([]);
  let updates = $state<PendingUpdate[]>([]);
  // Mutated in place — a plain `let` holding a SvelteSet is NOT reactive when the
  // instance is swapped (the reassignment isn't a signal write), so `counts` /
  // `hasPending` would go stale on delete-only pushes.
  const deletes = new SvelteSet<string | number>();

  /** IDs of rows that were recently updated (for visual highlight). Auto-cleared after timeout. */
  const recentlyUpdatedIds = new SvelteSet<string | number>();
  let highlightTimer: ReturnType<typeof setTimeout> | null = null;

  const counts = $derived<LiveUpdateCounts>({
    inserts: inserts.length,
    updates: updates.length,
    deletes: deletes.size,
    total: inserts.length + updates.length + deletes.size
  });

  const hasPending = $derived(counts.total > 0);

  // ── Push methods (called by the developer from WebSocket/SSE/Polling) ──

  function pushInsert(item: TableItem) {
    // Deduplicate: if an item with the same ID is already pending, replace it
    const id = pickRowId(item);
    if (id !== undefined) {
      inserts = inserts.filter((i) => pickRowId(i) !== id);
    }
    inserts = [...inserts, item];
  }

  function pushUpdate(id: string | number, changes: Partial<TableItem>) {
    // Merge with existing pending update for the same ID
    const existing = updates.findIndex((u) => u.id === id);
    if (existing >= 0) {
      updates[existing] = { id, changes: { ...updates[existing].changes, ...changes } };
      updates = [...updates]; // trigger reactivity
    } else {
      updates = [...updates, { id, changes }];
    }
  }

  function pushDelete(id: string | number) {
    // If the item was pending insert, remove it from inserts instead —
    // it was never in items, so there is nothing to delete.
    const pendingInsertIdx = inserts.findIndex((i) => pickRowId(i) === id);
    if (pendingInsertIdx >= 0) {
      inserts = inserts.filter((_, idx) => idx !== pendingInsertIdx);
      return;
    }
    deletes.add(id);
  }

  // ── Apply methods (merge pending changes into state.items) ──

  function applyAll() {
    applyDeletes();
    applyUpdates();
    applyInserts();
  }

  function applyInserts() {
    if (inserts.length === 0) return;
    state.items = normalizeItems([...state.items, ...inserts]);
    inserts = [];
  }

  function applyUpdates() {
    if (updates.length === 0) return;

    const updateMap = new SvelteMap(updates.map((u) => [u.id, u.changes]));
    const updatedIds = new SvelteSet(updateMap.keys());

    state.items = state.items.map((item) => {
      const id = pickRowId(item);
      if (id !== undefined && updateMap.has(id)) {
        updatedIds.delete(id);
        return { ...item, ...updateMap.get(id) };
      }
      return item;
    });

    if (import.meta.env?.DEV && updatedIds.size > 0) {
      console.warn(`[Table] Live update: ${updatedIds.size} orphaned ID(s) not found in items:`, [
        ...updatedIds
      ]);
    }

    // Mark as recently updated for visual highlight
    startHighlight(updateMap.keys());
    updates = [];
  }

  function applyDeletes() {
    if (deletes.size === 0) return;
    const deletedIds = new SvelteSet(deletes);
    state.items = state.items.filter((item) => {
      const id = pickRowId(item);
      if (id !== undefined && deletedIds.has(id)) {
        deletedIds.delete(id);
        return false;
      }
      return true;
    });

    if (import.meta.env?.DEV && deletedIds.size > 0) {
      console.warn(`[Table] Live delete: ${deletedIds.size} orphaned ID(s) not found in items:`, [
        ...deletedIds
      ]);
    }

    // Also remove from selection if selected
    if (state.selectionMode !== 'none' && state.selectedIds.size > 0) {
      const nextSelected = new SvelteSet(state.selectedIds);
      for (const id of deletes) {
        nextSelected.delete(id);
      }
      state.selectedIds = nextSelected;
    }

    deletes.clear();
  }

  function dismissAll() {
    inserts = [];
    updates = [];
    deletes.clear();
  }

  // ── Highlight management ──

  function startHighlight(ids: Iterable<string | number>) {
    for (const id of ids) {
      recentlyUpdatedIds.add(id);
    }

    if (highlightTimer) clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => {
      recentlyUpdatedIds.clear();
      highlightTimer = null;
    }, 3000);
  }

  function isRecentlyUpdated(id: string | number): boolean {
    return recentlyUpdatedIds.has(id);
  }

  /** Check if an item is pending deletion (for strikethrough/fade indicator). */
  function isPendingDelete(id: string | number): boolean {
    return deletes.has(id);
  }

  return {
    get counts() {
      return counts;
    },
    get hasPending() {
      return hasPending;
    },
    get pendingInserts() {
      return inserts;
    },
    get pendingUpdates() {
      return updates;
    },
    get pendingDeletes() {
      return deletes;
    },
    pushInsert,
    pushUpdate,
    pushDelete,
    applyAll,
    applyInserts,
    applyUpdates,
    applyDeletes,
    dismissAll,
    isRecentlyUpdated,
    isPendingDelete
  };
}
