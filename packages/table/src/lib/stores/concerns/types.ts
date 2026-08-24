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
  /**
   * The columns the grid renders — the *visible* subset, i.e. everything the
   * visibility feature has not hidden. Read it to draw something; resolve a
   * column *definition* over {@link allColumns} instead (see there).
   */
  columns: Column[];
  /**
   * Every column the consumer declared, hidden ones included.
   *
   * The two lists divide one job: `columns` answers "what is on screen",
   * `allColumns` answers "what did this table declare". Hiding a column is a
   * presentation act — it must not change what a filter, sort, grouping or
   * aggregation *means* — so every lookup that turns an id back into a column
   * (accessor, `dataType`, label) reads this list, and only rendering reads
   * the visible one. While there was a single name for both, half the readers
   * were silently on the wrong side of it: a hidden function-accessor column's
   * filter fell through to a raw `getNestedValue` path, yielded `undefined`
   * for every row, and emptied the table (#253).
   *
   * Read-only: the list comes from the `columns` prop. Visibility is
   * prop-driven (`enableColumnVisibility`, `prefs`) and its mutators stay
   * internal.
   */
  readonly allColumns: Column[];
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

  /**
   * The aggregations a column is *configured* to carry — the raw intent, at
   * most one entry per column. The editing controls (the filter bar's summary
   * menu, the tools sheet's panel, the column menu's submenu) show and change
   * this; every surface that *displays* a summary reads
   * {@link effectiveSummaryConfigs} instead, because a configuration survives
   * the row being hidden.
   */
  summaryConfigs: SummaryConfig[];
  /**
   * Whether the summary is shown. Writable, and `toggleSummary()` is the
   * action for it — but note what it switches: not only the row, but every
   * surface that announces a summary (the chips, the head indicators, the Σ
   * badge, both tool counts, both layouts) and the aggregate values
   * themselves, because all of them read {@link effectiveSummaryConfigs}.
   *
   * Adding or replacing an aggregation sets this to `true`; removing the last
   * one sets it to `false`.
   */
  showSummary: boolean;
  /**
   * The aggregations actually in force: {@link summaryConfigs} while
   * {@link showSummary} is true, and nothing while it is not.
   *
   * Read-only, and the one answer to "is a summary acting on this grid" — the
   * same role {@link effectiveGroupBy} plays for grouping. Every display
   * surface inside the table reads it, so a consumer's own "show totals"
   * switch does not have to re-derive the combination that the table already
   * decided (#252). Write {@link showSummary} or the summary actions.
   *
   * It answers at *one* address, and that is the half of the grouping pattern
   * a new axis should copy: `effectiveGroupBy` is additionally mirrored as
   * `context.effectiveGroupBy`, and two names for one value is what the #166
   * cut removed everywhere else.
   */
  readonly effectiveSummaryConfigs: SummaryConfig[];

  selectionMode: 'none' | 'single' | 'multi';
  /**
   * The selected row ids. `readonly` on purpose: the instance is mutated
   * through the selection concern's one commit gate and must never be
   * replaced — an instance swap detaches every derived tracking the old set
   * (the live-update delete path did exactly that once). Writers go through
   * `useSelection`; a swap is a compile error.
   */
  readonly selectedIds: Set<string | number>;
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
