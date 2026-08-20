import { SvelteSet } from 'svelte/reactivity';
import type { TableItem } from '$lib/types/tableTypes';
import { findColumnById, resolveValueById } from '$lib/utils';
import type { TableView } from '$lib/view/view.svelte';
import type { TableState } from './types';

/**
 * Grouping concern: manages group-by key, group order, collapse state,
 * and computes grouped items.
 * @param state - Shared table state.
 * @param view - The view object the grouping axis lives on.
 * @param getSortedItems - Getter for upstream sorted items.
 */
export function useGrouping(state: TableState, view: TableView, getSortedItems: () => TableItem[]) {
  const grouped = $derived.by((): Record<string, TableItem[]> => {
    const items = getSortedItems();
    if (!state.effectiveGroupBy) return { ungrouped: items };

    // Synthetic columns have no accessor — grouping by them would bucket
    // every row under 'Unassigned'. Fall back to ungrouped instead.
    const groupColumn = findColumnById(state.columns, state.effectiveGroupBy);
    if (groupColumn && groupColumn.accessor === undefined) return { ungrouped: items };

    const result: Record<string, TableItem[]> = {};

    for (const item of items) {
      const groupValue: unknown = resolveValueById(state.columns, item, state.effectiveGroupBy);
      const groupKey =
        groupValue !== undefined && groupValue !== null ? String(groupValue) : 'Unassigned';

      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(item);
    }

    if (state.groupOrder && state.groupOrder.length > 0) {
      const ordered: Record<string, TableItem[]> = {};

      state.groupOrder.forEach((groupKey) => {
        if (result[groupKey]) {
          ordered[groupKey] = result[groupKey];
        }
      });

      Object.keys(result).forEach((groupKey) => {
        if (!ordered[groupKey]) {
          ordered[groupKey] = result[groupKey];
        }
      });

      return ordered;
    }

    return result;
  });

  function setGroupBy(key: string | null) {
    // The write-side gate, for the paths that come through this setter: the
    // header menu and the toolbar menus. Grouped virtualization is not
    // implemented, and letting a key through used to deactivate virtualization
    // and render the *full* item set — the failure mode `virtualized` exists
    // to prevent. Clearing stays allowed, so a key restored before the mode
    // was known can still be undone.
    //
    // It is NOT every path, and the JSDoc used to claim it was (#166 review).
    // A consumer writing `view.groupBy` directly, and every binding (view
    // defaults, URL, storage), bypass this setter entirely. The read gate
    // behind `state.effectiveGroupBy` covers them all — it is what actually
    // decides what renders, and the value it ignores stays on the view
    // (DEV reports the mismatch in `TableProvider`).
    if (key && state.virtualized) {
      if (import.meta.env?.DEV) {
        console.warn(
          `[Table] Grouping is not available on a virtualized table — ignoring groupBy "${key}". Drop \`virtualized\` to group, or group server-side.`
        );
      }
      return;
    }
    view.groupBy = key;
    state.collapsedGroups = new SvelteSet();
    state.allGroupsExpanded = true;
    view.page = 1;
  }

  function toggleGroup(groupName: string) {
    const newGroups = new SvelteSet(state.collapsedGroups);

    if (newGroups.has(groupName)) {
      newGroups.delete(groupName);
    } else {
      newGroups.add(groupName);
    }

    state.collapsedGroups = newGroups;

    const groupKeys = Object.keys(grouped);
    if (groupKeys.length > 0) {
      state.allGroupsExpanded = state.collapsedGroups.size === 0;
    }
  }

  function toggleAllGroups() {
    const isExpanded = state.allGroupsExpanded;
    if (isExpanded) {
      state.collapsedGroups = new SvelteSet(Object.keys(grouped));
    } else {
      state.collapsedGroups = new SvelteSet();
    }
    state.allGroupsExpanded = !state.allGroupsExpanded;
  }

  return {
    get grouped() {
      return grouped;
    },
    setGroupBy,
    toggleGroup,
    toggleAllGroups
  };
}
