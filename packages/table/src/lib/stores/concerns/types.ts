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
  /**
   * The grouping key declared via `initialGroupBy`, recorded once and never
   * rewritten. Grouping accepts any item field, so this may name something that
   * has no column — which is exactly the case the grouping menu needs it for.
   * See the note on the property in TableStore.
   */
  declaredGroupByKey: string | null;
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
   * The row currently being shown elsewhere — master/detail (set by
   * `TableProvider` from the `activeRowId` prop). Distinct from
   * {@link selectedIds}: a view state with no action attached, so it brings no
   * checkbox column and no `aria-selected`, only `aria-current` and a quiet
   * ground. `null` means no row is current.
   */
  activeRowId: string | number | null;
  /**
   * Whether the table renders virtualized (set by `TableProvider` from the
   * `virtualized` prop). Grouping is not implemented for the virtual list, so
   * this mode suppresses the grouping affordances instead of silently falling
   * back to rendering every row.
   */
  virtualized: boolean;

  /**
   * Data-processing mode, derived from the resolved {@link TableSource} —
   * `'server'` covers both the manual and the managed server variant. Read by
   * the sorting/pagination concerns; never written (the source is the truth).
   */
  readonly mode: 'client' | 'server';
  /**
   * Server-side total for pagination. Derived from a manual server source's
   * `total`; a managed fetch writes it via `setServerResult`.
   */
  serverTotalItems: number;

  /** Table-level switch for the column-visibility feature (visibility menu + header hide action). */
  enableColumnVisibility: boolean;
}
