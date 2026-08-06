/**
 * Type-level guards for the v8 `TableContext` cut (#16) against the real
 * compiler. This file is *checked*, never executed: every `@ts-expect-error`
 * here is a claim that the compiler rejects the line — and svelte-check fails
 * when one stops erroring, so each probe carries its own positive control.
 *
 * Both directions of the contract are pinned:
 *
 * - **Store → interface** (`pub = wide` below): the wide store object must
 *   satisfy the hand-written narrow interface. Renaming or removing a public
 *   member in `createTableState` turns the assignment red. Verified red by
 *   temporarily adding a fictional `frobnicate(): void` to the interface.
 * - **Interface stays narrow** (the `@ts-expect-error` probes): an internal
 *   or removed member must not exist on the public type. Verified red by
 *   temporarily re-adding `setColumns` to the interface — its probe then
 *   reports an unused `@ts-expect-error`.
 * - **Public roll call** (the `use(...)` sweep): removing a member from the
 *   interface turns its access red. Verified red by temporarily removing
 *   `pushInsert` from the interface.
 *
 * If `InternalTableContext` ever degrades to `any` (a stale/parallel build),
 * every probe reports an *unused* `@ts-expect-error` — the gate fails loud
 * instead of going green for the wrong reason.
 */

import type * as Store from '$lib/stores/TableStore.svelte';
import type { InternalTableContext } from '$lib/stores/TableStore.svelte';
import type { TableContext } from './index.js';

declare const wide: InternalTableContext;
declare function use(...values: unknown[]): void;

// ── Store → interface: the wide object satisfies the public contract ──────
const pub: TableContext = wide;

// ── Public roll call: every documented member exists on the narrow type ───
use(pub.state, pub.view);
use(
  pub.filteredItems,
  pub.sortedItems,
  pub.paginatedItems,
  pub.totalItems,
  pub.totalPages,
  pub.effectivePage
);
use(pub.setSearchTerm);
use(
  pub.addFilter,
  pub.removeFilter,
  pub.removeFiltersByColumn,
  pub.clearAllFilters,
  pub.hasFilterForColumn
);
use(pub.handleSort, pub.setSort);
use(pub.goToPage, pub.setItemsPerPage);
use(pub.setGroupByKey);
use(
  pub.selectedItems,
  pub.allSelected,
  pub.someSelected,
  pub.selectItem,
  pub.deselectItem,
  pub.toggleItem,
  pub.selectAll,
  pub.deselectAll,
  pub.toggleAll,
  pub.isSelected,
  pub.setSelectedIds
);
use(pub.addSummaryConfig, pub.removeSummaryConfig, pub.toggleSummary, pub.setSummaryConfigs);
use(
  pub.liveUpdateCounts,
  pub.hasPendingUpdates,
  pub.pushInsert,
  pub.pushUpdate,
  pub.pushDelete,
  pub.applyAllUpdates,
  pub.applyInserts,
  pub.applyUpdates,
  pub.applyDeletes,
  pub.dismissAllUpdates,
  pub.isRecentlyUpdated,
  pub.isPendingDelete
);

// ── Wiring/lifecycle members are NOT part of the public contract ──────────
// Each stays reachable in-tree via `getInternalTableContext()`.

// Data wiring — the consumer path is the `source` union / `columns` prop.
// @ts-expect-error setItems is internal wiring
void pub.setItems;
// @ts-expect-error setColumns is internal wiring
void pub.setColumns;
// @ts-expect-error setPage is internal (unclamped raw write) — goToPage is the public one
void pub.setPage;

// Expansion + group collapse are the table's own row/header chrome.
// @ts-expect-error toggleExpand is internal
void pub.toggleExpand;
// @ts-expect-error isItemExpanded is internal
void pub.isItemExpanded;
// @ts-expect-error toggleGroup (group collapse) is internal
void pub.toggleGroup;
// @ts-expect-error toggleAllGroups is internal
void pub.toggleAllGroups;

// Render feeds of the table's own body/summary row.
// @ts-expect-error grouped is an internal render feed
void pub.grouped;
// @ts-expect-error navigableItems is the internal focus index space
void pub.navigableItems;
// @ts-expect-error summaryData is an internal render feed
void pub.summaryData;
// @ts-expect-error groupedSummaryData is an internal render feed
void pub.groupedSummaryData;
// @ts-expect-error getFormattedSummaryValue is an internal render helper
void pub.getFormattedSummaryValue;

// Column visibility/order plumbing — the feature is prop-driven
// (`enableColumnVisibility`, `enableColumnReorder`, `prefs`).
// @ts-expect-error allColumns is internal
void pub.allColumns;
// @ts-expect-error hiddenColumnKeys is internal
void pub.hiddenColumnKeys;
// @ts-expect-error hideColumn is internal
void pub.hideColumn;
// @ts-expect-error showColumn is internal
void pub.showColumn;
// @ts-expect-error toggleColumnVisibility is internal
void pub.toggleColumnVisibility;
// @ts-expect-error showAllColumns is internal
void pub.showAllColumns;
// @ts-expect-error orderedColumns is internal
void pub.orderedColumns;
// @ts-expect-error columnOrder is internal
void pub.columnOrder;
// @ts-expect-error reorderColumn is internal
void pub.reorderColumn;
// @ts-expect-error resetColumnOrder is internal
void pub.resetColumnOrder;
// @ts-expect-error getColumnIndex is internal
void pub.getColumnIndex;

// Focus internals — keyboard navigation is built in.
// @ts-expect-error focusedRowIndex is internal
void pub.focusedRowIndex;
// @ts-expect-error resetFocus is internal
void pub.resetFocus;
// @ts-expect-error setFocusedRow is internal
void pub.setFocusedRow;
// @ts-expect-error moveFocus is internal
void pub.moveFocus;
// @ts-expect-error isFocusedRow is internal
void pub.isFocusedRow;

// Managed-fetch sink — the consumer path is a `kind: 'server'` or `{ query }` source.
// @ts-expect-error setServerResult is internal
void pub.setServerResult;
// @ts-expect-error setServerError is internal
void pub.setServerError;
// @ts-expect-error setServerLoading is internal
void pub.setServerLoading;

// Preference-persistence lifecycle.
// @ts-expect-error applyPersistedState is internal
void pub.applyPersistedState;
// @ts-expect-error clearPersistedSummaryConfigs is internal
void pub.clearPersistedSummaryConfigs;
// @ts-expect-error clearPersistedHiddenColumns is internal
void pub.clearPersistedHiddenColumns;
// @ts-expect-error clearPersistedColumnOrder is internal
void pub.clearPersistedColumnOrder;
// @ts-expect-error clearPersistedSelection is internal
void pub.clearPersistedSelection;
// @ts-expect-error clearAllPersistentData is internal
void pub.clearAllPersistentData;
// @ts-expect-error forceSavePersistentData is internal
void pub.forceSavePersistentData;

// ── Removed from the store entirely (v8 cut, C8) — gone from BOTH types ───

// @ts-expect-error query left with the projection — use viewToQuery(view.snapshot())
void wide.query;
// @ts-expect-error queryKey left with the projection
void wide.queryKey;
// @ts-expect-error initColumnOrder had no caller
void wide.initColumnOrder;
// @ts-expect-error toggleGroupExpand was an alias of toggleGroup
void wide.toggleGroupExpand;
// @ts-expect-error setLoading had no caller — loading comes from the source
void wide.setLoading;
// @ts-expect-error setError had no caller — errors come from the source
void wide.setError;
// @ts-expect-error setGroupOrder had no caller — groupOrder is a prop
void wide.setGroupOrder;
// @ts-expect-error toggleAdvancedSearch had no reader (with state.showAdvancedSearch)
void wide.toggleAdvancedSearch;
// @ts-expect-error showAdvancedSearch left TableState with its toggle
void wide.state.showAdvancedSearch;
// @ts-expect-error the column utilities are standalone package exports, not context members
void wide.resolveColumnId;
// @ts-expect-error the column utilities are standalone package exports, not context members
void wide.getNestedValue;
// @ts-expect-error the column utilities are standalone package exports, not context members
void wide.findColumnById;

// setTableContext is gone — `<TableProvider>` (mounted by `<Table>`) is the
// only way a context comes to exist.
// @ts-expect-error setTableContext was removed with the v8 cut
use({} as typeof Store.setTableContext);
