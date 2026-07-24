import type { Column, Filter, TableItem } from '$lib/types/tableTypes';
import type { SummaryConfig } from '../TableStore.svelte';

/**
 * Shared reactive table state. All concerns read from and write to this object.
 */
export interface TableState {
  items: TableItem[];
  columns: Column[];
  loading: boolean;
  error: string | null;

  searchTerm: string;
  activeFilters: Filter[];
  showAdvancedSearch: boolean;

  currentPage: number;
  itemsPerPage: number;

  sortColumn: string;
  sortDirection: 'asc' | 'desc';

  expandedItemId: string | number | null;
  expandedItemIds: Set<string | number>;
  multiExpand: boolean;

  groupByKey: string | null;
  collapsedGroups: Set<string>;
  allGroupsExpanded: boolean;
  groupOrder: string[];

  summaryConfigs: SummaryConfig[];
  showSummary: boolean;

  selectionMode: 'none' | 'single' | 'multi';
  selectedIds: Set<string | number>;
  /**
   * Whether `selectedIds` is driven by a controlled prop. When true, selection
   * persistence is suppressed so a controlled value is never mirrored to storage
   * (set by `TableProvider` from the `selectedIds` prop).
   */
  selectionControlled: boolean;
  /**
   * Whether a click anywhere on a row body toggles that row's selection (set by
   * `TableProvider` from the resolved `rowClickSelects` prop). The checkbox path
   * is unaffected — this only adds the row itself as a selection target.
   */
  rowClickSelects: boolean;
  /**
   * Whether the table renders virtualized (set by `TableProvider` from the
   * `virtualized` prop). Grouping is not implemented for the virtual list, so
   * this mode suppresses the grouping affordances instead of silently falling
   * back to rendering every row.
   */
  virtualized: boolean;

  mode: 'client' | 'server';
  serverTotalItems: number;

  /** Table-level switch for the column-visibility feature (visibility menu + header hide action). */
  enableColumnVisibility: boolean;
}
