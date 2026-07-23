import type { Snippet } from 'svelte';
import type {
  Column,
  Filter,
  SummaryConfig,
  TableItem,
  TablePersistenceConfig,
  TableQuery,
  TableQueryResult
} from '$lib';
import type { TableSlotClasses } from '../table-style-context';

/**
 * Props interface for Table component
 *
 * @description Advanced data table component with smart filtering, column factories, responsive design,
 * and extensible features for complex data visualization. Supports row selection, keyboard navigation,
 * virtual scrolling, column reorder, server-side data, live updates, and custom cell components.
 *
 * @tag data
 * @related Pagination
 *
 * @example Basic usage
 * ```svelte
 * <Table
 *   items={data}
 *   columns={columns}
 *   itemsPerPage={25}
 *   enableSmartFilter={true}
 * />
 * ```
 *
 * @example Per-column custom cell rendering (recommended)
 * ```svelte
 * {#snippet statusCell(item, value)}
 *   <Badge intent={value === 'active' ? 'success' : 'danger'}>{value}</Badge>
 * {/snippet}
 *
 * <Table items={data} columns={[
 *   { accessor: 'name', title: 'Name', sortable: true },
 *   { accessor: 'status', title: 'Status', cell: statusCell }
 * ]} />
 * ```
 *
 * @example Row selection with callback
 * ```svelte
 * <Table
 *   items={data}
 *   columns={columns}
 *   selectionMode="multi"
 *   onSelectionChange={(selected) => console.log(selected)}
 * />
 * ```
 *
 * @example Server-side data with queryFn
 * ```svelte
 * <Table
 *   mode="server"
 *   columns={columns}
 *   queryFn={async (query, { signal }) => {
 *     const res = await fetch(`/api/users?page=${query.page}`, { signal });
 *     return await res.json();
 *   }}
 * />
 * ```
 *
 * @example Virtual scrolling for large datasets
 * ```svelte
 * <Table items={tenThousandRows} columns={columns} virtualized virtualHeight="500px" />
 * ```
 *
 * @example Persist view state across reloads (filters, search, group,
 * summaries, sort, hidden columns, column order — all in `localStorage`
 * by default):
 * ```svelte
 * <Table {items} {columns} persistenceConfig={{ tableId: 'expenses' }} />
 * ```
 */
export interface TableProps<T = TableItem> {
  /**
   * Array of data items to display in the table.
   * Items with an `id` property get better key stability for animations.
   * If no `id` is present, the array index is used as fallback key.
   * @default []
   */
  items?: T[];

  /**
   * Column configuration array defining the table structure
   * @default []
   */
  columns?: Column<T>[];

  /**
   * Additional CSS class names for the table container
   * @default undefined
   */
  class?: string;

  /**
   * Accessible label for the table, announced by screen readers.
   * @default undefined
   */
  ariaLabel?: string;

  /**
   * Size variant for the table
   * @default "md"
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Visual style of the table chrome (see docs/MIGRATION-v5.md §3):
   * - `flush` (default): no outer frame, sits inline in the reading flow
   * - `surface`: gentle `surface-quiet` tinted zone, no border
   * - `framed`: bordered + rounded + shadowed standalone block
   * @default "flush"
   */
  variant?: 'flush' | 'surface' | 'framed';

  /**
   * Number of items to display per page
   * @default 10
   */
  itemsPerPage?: number;

  /**
   * Initial page number
   * @default 1
   */
  initialPage?: number;

  /**
   * Snippet to render expanded row content
   * @default undefined
   */
  expandedRowContent?: Snippet<[item: T]>;

  /**
   * Allow multiple rows to be expanded simultaneously.
   * When false (default), expanding a row collapses the previously expanded one.
   * @default false
   */
  multiExpand?: boolean;

  /**
   * Callback fired when a row is clicked.
   * Receives the clicked row's data item.
   * @default undefined
   */
  onRowClick?: (item: T) => void;

  /**
   * Enable virtualization for large datasets.
   * When enabled, only visible rows are rendered for performance with >1000 items.
   * Pagination is bypassed — all filtered/sorted items are virtualized in a scrollable container.
   * Not compatible with grouping (grouping takes precedence).
   * @default false
   */
  virtualized?: boolean;

  /**
   * Height of the virtual scroll container. Only used when `virtualized` is true.
   * Accepts any CSS height value.
   * @default "600px"
   */
  virtualHeight?: string;

  /**
   * Custom order for group display
   * @default []
   */
  groupOrder?: string[];

  /**
   * Initial grouping key (if no persisted value exists). Seeds the
   * uncontrolled grouping state once when the table is created. A key restored
   * via `persistenceConfig` (`persistGroupByKey`) takes precedence. Later
   * changes to this prop are ignored; users can still group or ungroup. When
   * grouping is active, pagination is disabled — all grouped items are shown at
   * once. Caveat when combined with `persistenceConfig`: persistence stores
   * only non-empty values, so a grouping the user *cleared* does not survive a
   * reload — the seed applies again on the next visit.
   * @default null
   */
  initialGroupBy?: string | null;

  /**
   * Initial summary configurations (if no persisted value exists). Seeds the
   * uncontrolled summary state once when the table is created; each entry
   * defines a column + aggregation type (sum, avg, count, min, max). A set
   * restored via `persistenceConfig` (`persistSummaryConfigs`) takes
   * precedence. Later changes to this prop are ignored; users can still add or
   * remove summaries. Caveat when combined with `persistenceConfig`:
   * persistence stores only non-empty values, so summaries the user *cleared*
   * do not survive a reload — the seed applies again on the next visit.
   * @default []
   */
  initialSummaryConfigs?: SummaryConfig[];

  /**
   * Initial sort (if no persisted value exists). Seeds the uncontrolled sort
   * state once when the table is created: the header sort indicator shows it
   * and, in server mode, the very first emitted query already contains it —
   * so URL-synced sort params survive the initial emission. A sort restored
   * via `persistenceConfig` (`persistSort`) takes precedence. Later changes
   * to this prop are ignored; users can still change or clear the sort.
   * `column` must match a column's resolved id. Caveat when combined with
   * `persistenceConfig`: persistence stores only non-empty values, so a sort
   * the user *cleared* does not survive a reload — the seed applies again on
   * the next visit.
   * @default undefined
   */
  initialSort?: { column: string; direction: 'asc' | 'desc' };

  /**
   * Initial advanced filters (if no persisted value exists). Seeds the
   * uncontrolled filter state once when the table is created: the filter
   * chips show them and, in server mode, the very first emitted query
   * already contains them. Filters restored via `persistenceConfig`
   * (`persistFilters`) take precedence. Later changes to this prop are
   * ignored; users can still add or remove filters. Caveat when combined
   * with `persistenceConfig`: persistence stores only non-empty values, so a
   * filter set the user *cleared* does not survive a reload — the seed
   * applies again on the next visit.
   * @default undefined
   */
  initialFilters?: Filter[];

  /**
   * Enable smart filtering functionality
   * @default true
   */
  enableSmartFilter?: boolean;

  /**
   * Enable the column-visibility feature: the visibility menu in the smart
   * filter bar and the "hide column" action in every header menu. Set `false`
   * to remove both — this also reveals every currently-hidden column (including
   * one restored from persistence), so no column is ever stranded hidden without
   * a way back. For per-column control, set `hideable: false` on individual
   * columns instead.
   * @default true
   */
  enableColumnVisibility?: boolean;

  /**
   * Placeholder text for search input
   * @default "Search..."
   */
  searchPlaceholder?: string;

  /**
   * Debounce delay for search in milliseconds
   * @default 300
   */
  searchDebounceMs?: number;

  /**
   * Controlled search term. When provided, it drives the table's search state,
   * and `onSearchTermChange` fires on every internal change (typing in the smart
   * filter bar, Escape-to-clear). An empty string is a valid controlled value
   * ("no search"). Leave undefined for uncontrolled search. Takes precedence
   * over `persistenceConfig.persistSearch`.
   */
  searchTerm?: string;

  /**
   * Called whenever the search term changes — typed in the built-in smart
   * filter bar or set programmatically. Pair with {@link searchTerm} for a
   * controlled search, or use alone to observe the uncontrolled value (e.g. to
   * mirror it into the URL).
   */
  onSearchTermChange?: (term: string) => void;

  /**
   * Text displayed during loading state
   * @default "Loading data..."
   */
  loadingText?: string;

  /**
   * Text displayed on error
   * @default "Error loading data"
   */
  errorText?: string;

  /**
   * Text displayed when no data is available
   * @default "No data found."
   */
  noDataText?: string;

  /**
   * Global cell snippet that overrides rendering for ALL columns.
   * For per-column customization, prefer `column.cell` instead.
   * @default undefined
   */
  cell?: Snippet<[item: T, value: unknown, column: Column<T>]>;

  /**
   * Custom header snippet
   * @default undefined
   */
  header?: Snippet;

  /**
   * Custom body snippet
   * @default undefined
   */
  body?: Snippet;

  /**
   * Custom pagination snippet
   * @default undefined
   */
  pagination?: Snippet;

  /**
   * Custom empty state snippet
   * @default undefined
   */
  empty?: Snippet;

  /**
   * Custom loading state snippet
   * @default undefined
   */
  loading?: Snippet;

  /**
   * Custom error state snippet
   * @default undefined
   */
  error?: Snippet;

  /**
   * Custom content for group headers
   * @default null
   */
  groupHeaderContent?: Snippet<[groupName: string, items: T[], isExpanded: boolean]>;

  /**
   * Data processing mode.
   * - `'client'` (default): Filtering, sorting, and pagination are done locally.
   * - `'server'`: The table delegates all data operations to the server. Items passed via
   *   `items` prop (or returned by `queryFn`) are displayed as-is.
   * @default "client"
   */
  mode?: 'client' | 'server';

  /**
   * Total number of items on the server. Required when `mode` is `'server'`
   * and manual control is used (without `queryFn`). Drives pagination calculation.
   * @default 0
   */
  serverTotalItems?: number;

  /**
   * Async function for managed server-side fetching. When provided in `mode: 'server'`,
   * the table calls this function automatically when the query changes (debounced).
   * The table manages loading/error states and request cancellation via `AbortSignal`.
   *
   * @example
   * ```ts
   * queryFn={async (query, { signal }) => {
   *   const params = new URLSearchParams({ page: String(query.page), ... });
   *   const res = await fetch(`/api/users?${params}`, { signal });
   *   const data = await res.json();
   *   return { items: data.results, totalItems: data.total };
   * }}
   * ```
   */
  queryFn?: (query: TableQuery, options: { signal: AbortSignal }) => Promise<TableQueryResult>;

  /**
   * Callback fired when the table query changes in `mode: 'server'`.
   * Use this for manual control — fetch data yourself and update `items`,
   * `serverTotalItems`, `loading`, and `error` props accordingly.
   * Fires after debounce (controlled by `queryDebounceMs`).
   * @default undefined
   */
  onQueryChange?: (query: TableQuery) => void;

  /**
   * Debounce delay in milliseconds for server query changes.
   * Prevents excessive requests during rapid filter/search input.
   * @default 300
   */
  queryDebounceMs?: number;

  /**
   * Enable live update support. When enabled, a `LiveUpdateBanner` is shown
   * when pending inserts/updates/deletes are buffered. Use `getTableContext()`
   * to access `pushInsert`, `pushUpdate`, `pushDelete` from WebSocket/SSE handlers.
   * @default false
   */
  enableLiveUpdates?: boolean;

  /**
   * Automatically apply pending live updates when the user navigates
   * (page change, sort, filter, search). Since the view is already changing,
   * applying buffered changes at this point is non-disruptive.
   * @default true
   */
  autoApplyOnNavigation?: boolean;

  /**
   * Persist table view state across reloads. Pass `{ tableId: 'foo' }` to
   * opt in — every axis (filters, search, group, summary, sort, column
   * visibility, column order) is persisted by default into `localStorage`
   * under keys scoped to `tableId`. Set individual `persist*` flags to
   * `false` to keep an axis volatile.
   *
   * Pagination (current page) is intentionally never persisted — page 1
   * on navigation is standard UX.
   *
   * @example
   * ```svelte
   * <Table {items} {columns} persistenceConfig={{ tableId: 'expenses' }} />
   * ```
   *
   * @example Keep sort and column order, but always start filter-free:
   * ```svelte
   * <Table
   *   {items}
   *   {columns}
   *   persistenceConfig={{
   *     tableId: 'expenses',
   *     persistFilters: false,
   *     persistSearch: false
   *   }}
   * />
   * ```
   *
   * @default undefined
   */
  persistenceConfig?: TablePersistenceConfig;

  /**
   * Remove default tailwind-variants classes. Only user-provided `slotClasses` apply.
   * @default false
   */
  unstyled?: boolean;

  /**
   * Per-slot class overrides merged with (or replacing, if `unstyled`) variant styles.
   * Available slots: `container`, `toolbar`, `scrollArea`, `table`, `thead`, `tbody`,
   * `headerRow`, `headerCell`, `row`, `cell`, `groupHeader`, `summaryRow`,
   * `emptyState`, `loadingState`, `errorState`, `filterBar`, `mobileCard`.
   *
   * **Breaking change in v1.5:** the former `wrapper` slot has been replaced by
   * `scrollArea`. The former hardcoded `overflow-hidden` on `wrapper` blocked
   * `position: sticky`, see [docs/STICKY-PINNING.md](../../../../../docs/STICKY-PINNING.md).
   *
   * @default {}
   */
  slotClasses?: Partial<TableSlotClasses>;

  /**
   * Pin toolbar/header/group-header to the top of the scroll ancestor on scroll.
   * - `false` (default): no pinning, layout matches v1.4.x
   * - `true` / `'both'`: toolbar + thead + group-header all pin
   * - `'toolbar'`: only the toolbar pins
   * - `'header'`: only the thead (and group-header when grouping is active) pins
   *
   * Pair with `stickyOffset` for app shells that have a fixed top bar.
   *
   * For tables wider than the viewport, prefer `fit="viewport"` — it contains
   * horizontal scroll inside the table instead of falling back to page-level
   * horizontal scroll (a sticky pin host cannot also be a horizontal scroll
   * ancestor). `fit="viewport"` supersedes `sticky` when set.
   *
   * @default false
   * @example
   * ```svelte
   * <Table {items} {columns} sticky stickyOffset={64} />
   * ```
   */
  sticky?: boolean | 'toolbar' | 'header' | 'both';

  /**
   * Make the table its own scroll container so wide **and** long lists scroll
   * *within* the table instead of pushing overflow onto the page.
   *
   * - `'content'` (default): the table grows with its content; vertical overflow
   *   scrolls the page. Pair with `sticky` for page-relative pinning.
   * - `'viewport'`: the table is height-capped to the viewport and becomes a
   *   self-contained scroll box. The column header (and group header when
   *   grouping) pin to the top of the box, while the toolbar and pagination stay
   *   fixed outside the scrolling area — only the rows scroll, in both axes. The
   *   available height is measured automatically (the container's distance from
   *   the top of the viewport), so no magic `max-height` is needed in the
   *   consumer, and it adapts to whatever sits above the table (tabs, banners).
   *
   * Notes for `'viewport'`:
   * - Desktop only (`md`+); mobile keeps normal document-level scroll.
   * - Supersedes `sticky`: header/group pinning is intrinsic to the box, so the
   *   `sticky` prop is ignored. `stickyOffset` is ignored too — the measured top
   *   absorbs app-shell offsets automatically.
   * - Mutually exclusive with `virtualized`, which manages its own bounded
   *   scroll via `virtualHeight`; `fit` has no effect when `virtualized`.
   * - The box reaches the bottom of the viewport, so it assumes nothing sits
   *   *below* it. An ancestor with bottom padding (or a following sibling) is
   *   pushed past `100dvh` and produces a second, page-level scrollbar next to
   *   the table's own. The container reflects the resolved mode as
   *   `data-fit="viewport"` (vs `"content"`, also when `virtualized`) so a
   *   layout can drop that inset. The height cap is desktop-only (`md`+) while
   *   `data-fit` is not breakpoint-scoped — it reports the requested mode at
   *   every width — so gate the override on the same breakpoint, or it also
   *   strips the inset on mobile, where the table scrolls with the document and
   *   the padding is wanted:
   *   `@media (min-width: 48rem) { main:has([data-fit='viewport']) { padding-block-end: 0 } }`.
   *
   * @default "content"
   * @example
   * ```svelte
   * <!-- Full-height list page: header pinned, toolbar + pagination fixed -->
   * <Table {items} {columns} fit="viewport" />
   * ```
   */
  fit?: 'content' | 'viewport';

  /**
   * Pixel offset for the topmost sticky layer (toolbar, or thead when no toolbar).
   * Writes the CSS custom property `--blocks-table-sticky-top` on the container.
   * Use this to push the pin below a fixed app shell top bar.
   *
   * @default 0
   */
  stickyOffset?: number;

  /**
   * Custom toolbar snippet. Replaces the default `SmartFilterBar`.
   * Renders inside the sticky toolbar wrapper when `sticky` is enabled — so a
   * custom toolbar inherits the pinning behavior without extra wiring.
   *
   * Access the table context via `getTableContext()` to wire up custom filter UIs.
   *
   * @default undefined (renders default SmartFilterBar when enableSmartFilter)
   * @example
   * ```svelte
   * <Table {items} {columns} sticky enableSmartFilter={false}>
   *   {#snippet toolbar()}
   *     <MyCustomToolbar />
   *   {/snippet}
   * </Table>
   * ```
   */
  toolbar?: Snippet;

  /**
   * Enable drag-and-drop column reordering on desktop.
   * Users can drag column headers to rearrange them. Also supports keyboard
   * reorder via Shift+ArrowLeft/Right on focused headers.
   * @default false
   */
  enableColumnReorder?: boolean;

  /**
   * Row selection mode.
   * - `'none'`: No selection (default)
   * - `'single'`: Only one row can be selected at a time
   * - `'multi'`: Multiple rows can be selected with checkboxes
   * @default "none"
   */
  selectionMode?: 'none' | 'single' | 'multi';

  /**
   * Initial selected row ids (if no persisted value exists). Seeds the
   * uncontrolled selection once when the table is created. Ignored entirely
   * when the controlled `selectedIds` prop is set — controlled always wins.
   * A selection restored via `persistenceConfig.persistSelection` takes
   * precedence. Later changes to this prop are ignored; users can still
   * change or clear the selection. Rows are keyed by `item.id` (row-index
   * fallback). Caveat when combined with
   * `persistenceConfig.persistSelection`: persistence stores only non-empty
   * values, so a selection the user *cleared* does not survive a reload —
   * the seed applies again on the next visit.
   * @default undefined
   */
  initialSelectedIds?: Array<string | number>;

  /**
   * Controlled selected row IDs. When provided, the component reflects this value
   * instead of managing selection internally.
   * @default undefined
   */
  selectedIds?: Array<string | number>;

  /**
   * Callback fired when the selection changes.
   * Receives the array of currently selected items.
   * @default undefined
   */
  onSelectionChange?: (selectedItems: T[]) => void;
}
