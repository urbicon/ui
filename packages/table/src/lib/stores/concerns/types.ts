import type { Column, TableItem } from '$lib/types/tableTypes';
import type { ProcessingMode } from '$lib/view/source';
import type { SummaryConfig } from '../TableStore.svelte';

/**
 * Shared reactive table state. All concerns read from and write to this object.
 *
 * The six view axes are **not** here (#166). Until v9 this interface mirrored
 * them — `searchTerm`, `activeFilters`, `currentPage`, `itemsPerPage`,
 * `sortColumn`/`sortDirection`, `groupByKey` — as getters onto the view, so
 * every axis had two names and a consumer had no rule for choosing. The view
 * object is the one address now: `context.view.search`, `.filters`, `.page`,
 * `.pageSize`, `.sort`, `.groupBy`. What remains here is what the table owns
 * and the view does not: rows, columns, load state, expansion, grouping
 * chrome, summaries, selection, and the prop-driven switches.
 *
 * The one axis-shaped value that survived is `effectiveGroupBy`, the grouping
 * actually applied. It is not a spelling of `view.groupBy` — it can differ
 * from it, which is the whole reason it exists. It sits here because the
 * concerns share it through this object; consumers read it as
 * `context.effectiveGroupBy`.
 */
export interface TableState {
  items: TableItem[];
  columns: Column[];
  loading: boolean;
  error: string | null;

  expandedItemId: string | number | null;
  expandedItemIds: Set<string | number>;
  multiExpand: boolean;

  /**
   * The grouping actually applied — `view.groupBy`, or `null` when the table
   * is virtualized (grouped virtualization is not implemented). Read-only:
   * write `view.groupBy`. Not a mirror of the axis, which is why it survived
   * the #166 cut — it can legitimately differ from what the view holds.
   */
  readonly effectiveGroupBy: string | null;
  /**
   * The grouping key declared via `view.defaults.groupBy`, recorded once and
   * never rewritten. Grouping accepts any item field, so this may name something
   * that has no column — which is exactly the case the grouping menu needs it
   * for. See the note on the property in TableStore.
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
   * Data-processing mode, straight from the resolved {@link TableSource} —
   * all three values, so the manual and the managed server arm stay
   * distinguishable below the store. Concerns that only care where the
   * processing happens compare against `'client'`. Never written (the source
   * is the truth).
   */
  readonly mode: ProcessingMode;
  /**
   * Server-side total for pagination. Derived from a manual server source's
   * `total`; a managed fetch writes it via `setServerResult`. Spelled like the
   * `total` on the source and on `TablePage` (#162), scoped to say which
   * one it holds.
   */
  serverTotal: number;

  /** Table-level switch for the column-visibility feature (visibility menu + header hide action). */
  enableColumnVisibility: boolean;
}
