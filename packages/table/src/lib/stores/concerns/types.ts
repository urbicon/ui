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

  mode: 'client' | 'server';
  serverTotalItems: number;

  /** Table-level switch for the column-visibility feature (visibility menu + header hide action). */
  enableColumnVisibility: boolean;
}
