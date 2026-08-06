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
import type { createTableState, TableViewState } from '$lib/stores/TableStore.svelte';
import type { TableSlotClasses } from '../table-style-context';

/**
 * The table's live context object — the store's public surface: reactive
 * `state`, the derived collections, and the imperative API (selection,
 * grouping, pagination, live-update push/apply).
 *
 * Handed to {@link TableProps.onReady} for consumers outside the table's
 * component tree, and returned by `getTableContext()` inside it.
 */
export type TableContext = ReturnType<typeof createTableState>;

/**
 * Props interface for Table component
 *
 * @summary Data in rows: sort, filter, group, select and page through it.
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
   * Visual style of the table chrome (see the shipped VARIANT-CONTRACT.md § Table chrome):
   * - `flush` (default): no outer frame, sits inline in the reading flow
   * - `surface`: gentle `surface-quiet` tinted zone, no border
   * - `framed`: bordered + rounded + shadowed standalone block
   * @default "flush"
   * @summary How much chrome the table carries: none, a tinted zone, or a framed block.
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
   * How much of a record a mobile card shows before it is opened. Below the
   * `md` breakpoint the table renders one card per row instead of a grid.
   * - `collapsed` (default): the card shows the first two card columns —
   *   title and label-less subtitle — and opens the rest on tap. A record
   *   costs roughly a third of the height, so a phone screen holds three
   *   instead of one.
   * - `expanded`: title on top, every other card column in the grid below it,
   *   nothing hidden. The shape before v6.48.
   *
   * Independent of `expandedRowContent`, which stays behind the chevron in
   * both modes.
   * @default "collapsed"
   * @summary Whether a mobile card opens its detail fields on tap or shows them all.
   */
  mobileCardDetails?: 'collapsed' | 'expanded';

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
   * Not compatible with grouping — and virtualization wins: the grouping
   * affordances are suppressed, and `initialGroupBy`, a controlled
   * `groupByKey` or a persisted grouping is ignored (DEV warns). Storage is not
   * cleared, so a persisted grouping applies again on the next load without
   * `virtualized`; toggling the prop at runtime does not bring the current
   * grouping back.
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
   * once. Precedence when combined with `persistenceConfig` goes by *presence*,
   * not emptiness: once storage holds a grouping key for this table —
   * including the `null` written when the user ungrouped — it wins and the
   * seed no longer applies.
   * @default null
   */
  initialGroupBy?: string | null;

  /**
   * Initial summary configurations (if no persisted value exists). Seeds the
   * uncontrolled summary state once when the table is created; each entry
   * defines a column + aggregation type (sum, avg, count, min, max). A set
   * restored via `persistenceConfig` (`persistSummaryConfigs`) takes
   * precedence. Later changes to this prop are ignored; users can still add or
   * remove summaries. Precedence when combined with `persistenceConfig` goes
   * by *presence*, not emptiness: once storage holds a summary set for this
   * table — including the empty one written when the user removed every
   * summary — it wins and the seed no longer applies.
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
   * `column` must match a column's resolved id. Precedence when combined with
   * `persistenceConfig` goes by *presence*, not emptiness: once storage holds
   * a sort for this table — including the "no sort" written when the user
   * cycled the header past `desc` — it wins and the seed no longer applies.
   * @default undefined
   */
  initialSort?: { column: string; direction: 'asc' | 'desc' };

  /**
   * Initial advanced filters (if no persisted value exists). Seeds the
   * uncontrolled filter state once when the table is created: the filter
   * chips show them and, in server mode, the very first emitted query
   * already contains them. Filters restored via `persistenceConfig`
   * (`persistFilters`) take precedence. Later changes to this prop are
   * ignored; users can still add or remove filters. Precedence when combined
   * with `persistenceConfig` goes by *presence*, not emptiness: once storage
   * holds a filter set for this table — including the empty one written when
   * the user cleared every chip — it wins and the seed no longer applies.
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
   * @default i18n `search.placeholder`
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
   * Loading state. Renders the loading row (or the {@link loadingState} snippet)
   * instead of the table body, and suppresses the mobile cards + pagination.
   *
   * Use it for data you fetch yourself — in `mode: 'client'` as well as in the
   * manual server flow driven by {@link onQueryChange}. With a managed
   * {@link queryFn} the table owns the loading lifecycle, so this prop is
   * ignored there (a DEV warning points that out).
   * @default false
   */
  loading?: boolean;

  /**
   * Text displayed during loading state
   * @default i18n `data.loading`
   */
  loadingText?: string;

  /**
   * Error message. When set (non-empty), the table renders the error row (or the
   * {@link errorState} snippet) instead of the body, with {@link errorText} as
   * the heading and this string as the detail — the same shape the managed
   * {@link queryFn} path produces on a failed fetch.
   *
   * Like {@link loading} this is your channel for data you fetch yourself; with
   * a managed `queryFn` the table owns the error lifecycle and ignores the prop.
   * @default null
   */
  error?: string | null;

  /**
   * Text displayed on error
   * @default i18n `error.loadingError`
   */
  errorText?: string;

  /**
   * Text displayed when no data is available
   * @default i18n `data.empty`
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
   * Custom empty state snippet. Named after its `slotClasses.emptyState` slot
   * (renamed from `empty` in v6.41 — `loading` is now the boolean state prop).
   *
   * Must be table-row markup (`<tr><td colspan="99">…`) — it renders into the
   * desktop `<tbody>`. **Desktop only:** the mobile card list renders
   * {@link noDataText} instead, because row markup cannot live in a `<div>`
   * (the parser drops the tags). Same contract as the two state snippets below.
   * @default undefined
   */
  emptyState?: Snippet;

  /**
   * Custom loading state snippet, rendered while {@link loading} is true.
   * Named after its `slotClasses.loadingState` slot (renamed from `loading` in
   * v6.41, which now carries the boolean state).
   *
   * Table-row markup, desktop only — mobile renders {@link loadingText}.
   * @default undefined
   */
  loadingState?: Snippet;

  /**
   * Custom error state snippet. Named after its `slotClasses.errorState` slot
   * (renamed from `error` in v6.41, alongside its two siblings).
   *
   * Table-row markup, desktop only — mobile renders {@link errorText}.
   * @default undefined
   */
  errorState?: Snippet;

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
   * Callback fired when the table query changes — page, page size, sort,
   * search term, filters, grouping.
   *
   * In `mode: 'server'` this is the manual fetch path: fetch the data yourself
   * and update {@link items}, {@link serverTotalItems}, {@link loading} and
   * {@link error} accordingly. (With a managed {@link queryFn} the table fetches
   * instead and this does not fire.)
   *
   * In `mode: 'client'` — the default — nothing is fetched; the table simply
   * reports the view state it is rendering. That is what makes the state
   * shareable: pair it with `createTableQueryUrlSync` from
   * `@urbicon-ui/sveltekit-utils` to mirror it onto the URL, and pass the parsed
   * query back in through {@link query} so the server renders the same view the
   * reader linked to.
   *
   * Fires after debounce (controlled by `queryDebounceMs`); the first emission
   * is immediate.
   * @default undefined
   */
  onQueryChange?: (query: TableQuery) => void;

  /**
   * Controlled view state — the axes that decide *which* data is shown: page,
   * page size, sort, search term, filters, grouping.
   *
   * Per-field: a field that is present takes that axis over, a field left
   * `undefined` changes nothing. An axis under control outranks both
   * {@link persistenceConfig} and the matching `initial*` seed, and is no
   * longer written to storage — otherwise the stored copy would resurface the
   * moment the table stopped being controlled.
   *
   * Because presence *is* the switch, pass only the axes you mean to control.
   * An object with every field filled in claims every axis — so a table handed
   * a complete query ignores `persistenceConfig` and every `initial*` seed, on
   * every URL, including one with no parameters at all. `createTableQueryUrlSync`
   * exposes both shapes for exactly this reason: `viewState` (the axes the URL
   * names — this prop) and `initialQuery` (a complete snapshot, for a fetch).
   *
   * The reason to reach for this is the server. View state kept in
   * `localStorage` is invisible to it, so a server-rendered table shows an
   * unfiltered, unsorted view that the client then replaces on hydration. Put
   * the same state in the URL and the server renders what the reader asked
   * for — and the link becomes shareable, which is the same property from the
   * other side (#152).
   *
   * Pair it with {@link onQueryChange}, which now fires in client mode too.
   *
   * @example A table whose view lives in the URL
   * ```svelte
   * <script lang="ts">
   *   import { createTableQueryUrlSync } from '@urbicon-ui/sveltekit-utils/url.svelte';
   *
   *   const sync = createTableQueryUrlSync();
   * </script>
   *
   * <Table
   *   {items}
   *   {columns}
   *   query={sync.viewState}
   *   onQueryChange={sync.syncQuery}
   * />
   * ```
   * @default undefined
   */
  query?: TableViewState;

  /**
   * Debounce delay in milliseconds for server query changes.
   * Prevents excessive requests during rapid filter/search input.
   * @default 300
   */
  queryDebounceMs?: number;

  /**
   * Enable live update support. When enabled, a `LiveUpdateBanner` is shown
   * when pending inserts/updates/deletes are buffered. Get hold of
   * `pushInsert`, `pushUpdate`, `pushDelete` for your WebSocket/SSE handler via
   * {@link onReady} — or, from inside the table's own tree (a `toolbar`
   * snippet, a custom cell), via `getTableContext()`.
   * @default false
   */
  enableLiveUpdates?: boolean;

  /**
   * Called once with the table's context after the table is set up — the
   * supported way to reach the imperative API from *outside* the table's tree
   * (`getTableContext()` only resolves inside it).
   *
   * The context is a live object: `pushInsert`/`pushUpdate`/`pushDelete` and
   * `applyAllUpdates` for live feeds, plus the reactive `state`. Hold on to it
   * for the lifetime of the table; it is not re-created.
   *
   * `state.items` and `state.columns` are reactive to *replacement*, not to
   * writes reaching inside them: `state.items[0].name = 'x'` changes the row
   * and re-renders nothing. Edit a row through `pushUpdate`, or assign a new
   * array.
   *
   * @example Feeding a WebSocket into a live-updating table
   * ```svelte
   * <script lang="ts">
   *   import type { TableContext } from '@urbicon-ui/table';
   *   let table = $state<TableContext | null>(null);
   *
   *   $effect(() => {
   *     if (!table) return;
   *     const socket = new WebSocket('wss://example.test/rows');
   *     socket.onmessage = (e) => table?.pushInsert(JSON.parse(e.data));
   *     return () => socket.close();
   *   });
   * </script>
   *
   * <Table {items} {columns} enableLiveUpdates onReady={(ctx) => (table = ctx)} />
   * ```
   */
  onReady?: (context: TableContext) => void;

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
   * Wiring {@link query} changes this: the shareable axes (sort, search,
   * filters, grouping) then live in the URL and stop reaching storage, so a
   * visit without params starts clean. Set `persistControlled: true` to store
   * them as well — writes come from the reader's own edits only, never from a
   * controlled value resolving, and the URL still outranks the stored value
   * per axis.
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
   * @summary Whether rows can be selected, and one at a time or many.
   */
  selectionMode?: 'none' | 'single' | 'multi';

  /**
   * Whether clicking anywhere on a row body toggles that row's selection, in
   * addition to the always-present checkbox.
   *
   * On by default in `selectionMode="single"` (where a single click is the
   * expected gesture and there is no marquee/range interaction to conflict
   * with), as long as the row click means nothing else yet — neither
   * {@link onRowClick} nor {@link expandedRowContent} is set. Set it explicitly
   * to opt in for `multi` or for expandable rows, or to `false` to keep the
   * checkbox as the only selection target.
   *
   * A click that ends a text selection *inside the row* never selects, so cell
   * content stays copyable. Applies to desktop rows (flat and grouped); mobile
   * cards keep the checkbox as their only selection control, since a selectable
   * card cannot be a button without nesting interactive elements.
   *
   * Defaults to `true` only in `selectionMode="single"` without `onRowClick`
   * and without `expandedRowContent` — a row click that already expands must
   * not silently also select.
   * @default false
   */
  rowClickSelects?: boolean;

  /**
   * The row that is currently being shown elsewhere — the master/detail
   * pattern, where clicking a row renders that record beside or below the
   * table.
   *
   * Deliberately separate from selection: a selection is a set the user has
   * marked for an action and brings a checkbox column with it, whereas a
   * current row is a *view* state with no consequence beyond what is on screen.
   * Marking one used to require `selectionMode`, which switched on that column
   * as a side effect.
   *
   * The matching row gets `aria-current="true"` and a `data-active` attribute
   * (a hook for consumer CSS, e.g. emphasising a cell in that row), plus a
   * quiet ground of its own. Ids are matched against `item.id`, with the row
   * index as the same fallback the rest of the table uses. Pair it with
   * {@link onRowClick} — this prop only reflects state, it never sets it.
   *
   * @default null
   * @example
   * ```svelte
   * <Table {items} {columns} activeRowId={shown?.id ?? null} onRowClick={(row) => (shown = row)} />
   * ```
   */
  activeRowId?: string | number | null;

  /**
   * Initial selected row ids (if no persisted value exists). Seeds the
   * uncontrolled selection once when the table is created. Ignored entirely
   * when the controlled `selectedIds` prop is set — controlled always wins.
   * A selection restored via `persistenceConfig.persistSelection` takes
   * precedence. Later changes to this prop are ignored; users can still
   * change or clear the selection. Rows are keyed by `item.id` (row-index
   * fallback). Precedence when combined with
   * `persistenceConfig.persistSelection` goes by *presence*, not emptiness:
   * once storage holds a selection for this table — including the empty one
   * written when the user deselected everything — it wins and the seed no
   * longer applies.
   * @default undefined
   */
  initialSelectedIds?: Array<string | number>;

  /**
   * Controlled selected row ids. When set, the table adopts this value
   * whenever it changes, `initialSelectedIds` is ignored, and nothing is
   * written to storage
   * (`persistenceConfig.persistSelection` has no effect). An empty array is a
   * valid value — nothing selected; `undefined` returns ownership to the
   * table. User clicks still change the selection and fire
   * {@link onSelectionChange} — write the new ids back into this prop, or the
   * next change to it discards what the user clicked.
   * @default undefined
   */
  selectedIds?: Array<string | number>;

  /**
   * Callback fired when the selection changes. Receives the currently
   * selected items — the rows themselves, not their ids. With controlled
   * {@link selectedIds}, this is where the new value is written back:
   * `(items) => (selectedIds = items.map((item) => item.id))`.
   * @default undefined
   */
  onSelectionChange?: (selectedItems: T[]) => void;
}
