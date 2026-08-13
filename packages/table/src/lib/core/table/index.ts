import type { Snippet } from 'svelte';
import type { Column, TableItem, TablePrefsConfig } from '$lib';
import type { TableState } from '$lib/stores/concerns/types.js';
import type { LiveUpdateCounts } from '$lib/stores/concerns/useLiveUpdates.svelte';
import type { SummaryConfig } from '$lib/stores/TableStore.svelte';
import type { Filter, FilterOperator } from '$lib/types/tableTypes';
import type { CardsBelowStep } from '$lib/variants/table.variants';
import type { TableSource } from '$lib/view/source';
import type { TableView, TableViewDefaults, ViewSort } from '$lib/view/view.svelte';
import type { TableSlotClasses } from '../table-style-context';

/**
 * The table's live context object — the **supported consumer surface** of the
 * store: reactive `state`, the derived collections, and the imperative API
 * (search, filter, sort, page, group, select, summarize, live-update
 * push/apply).
 *
 * Handed to {@link TableProps.onReady} for consumers outside the table's
 * component tree, and returned by `getTableContext()` inside it (a `toolbar`
 * snippet, a custom cell). It is a live object for the lifetime of the table;
 * hold on to it, it is not re-created.
 *
 * Hand-written and deliberately narrower than the store object behind it
 * (since v8): wiring and lifecycle members — column set/order/visibility
 * plumbing, focus internals, the managed-fetch sink, preference persistence —
 * are not part of the contract. Prefer the action methods here over writing
 * the matching `view` axis directly: the methods enforce the interaction side
 * effects (a new search, filter or grouping resets to page 1; a summary
 * mutation keeps the summary row's visibility consistent). A bare
 * `view.search = 'x'` is legitimate — it just changes only the search.
 */
export interface TableContext {
  /**
   * The shared reactive state — what the *table* owns: `state.items`,
   * `state.columns`, `state.loading`, `state.selectedIds`, the expansion and
   * grouping chrome, the summaries. The six view axes are not here; they live
   * on {@link view}, under one set of names (#166).
   *
   * Fields are reactive to *replacement*, not to writes reaching inside them:
   * `state.items[0].name = 'x'` re-renders nothing — edit a row through
   * {@link pushUpdate}, or assign a new array. For writes, prefer the action
   * methods on this context.
   */
  readonly state: TableState;

  /**
   * The view object this table reads and writes — the six shareable axes
   * (search, sort, page, pageSize, filters, groupBy), fully resolved against
   * its defaults. For a zero-config table this is the table-owned view; with
   * a `view` prop it is that same object.
   *
   * This is the one address for an axis. Read `view.search`, write
   * `view.page = 2`; the action methods below exist for the ones that carry
   * an interaction side effect (a new search or filter resets to page 1) and
   * write the same fields.
   */
  readonly view: TableView;

  // ── Derived collections ──

  /** Rows after search + filters, before sorting and pagination. */
  readonly filteredItems: TableItem[];
  /** Rows after search, filters and sort, before pagination. */
  readonly sortedItems: TableItem[];
  /** The rows of the current page — what the desktop body renders when ungrouped. */
  readonly paginatedItems: TableItem[];
  /**
   * Total row count after filtering — the server total in server mode.
   * Spelled like the `total` on the source and on `TablePage` (#162): one
   * word for "how many rows match", wherever you read it.
   */
  readonly total: number;
  /** Page count derived from {@link total} and `view.pageSize` (min. 1). */
  readonly totalPages: number;
  /**
   * The page actually rendered — `view.page` clamped into range. Everything
   * user-facing reads this, never `view.page`: the raw value is the reader's
   * *intent* and can sit out of range after the page size or the item count
   * changed under it.
   */
  readonly effectivePage: number;
  /**
   * The grouping actually applied — `view.groupBy`, or `null` on a
   * virtualized table (grouped virtualization is not implemented, and a key
   * that slipped through would render every row). Same distinction as
   * {@link effectivePage}: read `view.groupBy` for what the reader asked
   * for, this for what they are looking at.
   *
   * This is the address to use. `state.effectiveGroupBy` holds the same
   * value — it is the channel the store's concerns share it through, and the
   * gate lives there so it cannot be applied twice.
   */
  readonly effectiveGroupBy: string | null;

  // ── Search ──

  /** Set the search term. A *new* term resets to page 1; re-applying the current one does not. */
  setSearch(term: string): void;

  // ── Filtering ──

  /** Append a filter and reset to page 1. */
  addFilter(filter: Filter): void;
  /** Remove the filter at `index` in `view.filters` and reset to page 1. */
  removeFilter(index: number): void;
  /**
   * Remove every filter matching `column` — narrowed further by `operator`
   * and `value` when given — and reset to page 1.
   */
  removeFiltersByColumn(column: string, operator?: FilterOperator, value?: string): void;
  /** Drop all filters and reset to page 1. */
  clearAllFilters(): void;
  /** Whether a filter for `column` (narrowed by `operator`/`value` when given) is active. */
  hasFilterForColumn(column: string, operator?: FilterOperator, value?: string): boolean;

  // ── Sorting ──

  /** The column-header click: cycles the column asc → desc → unsorted. */
  handleSort(column: string): void;
  /**
   * Set an exact sort, no cycling — for controls without a header to click.
   * `null` clears it; "unsorted" is a value, not an empty column name.
   */
  setSort(sort: ViewSort | null): void;

  // ── Pagination ──

  /** Navigate to `page` if it is within `1..totalPages`; out-of-range calls are ignored. */
  goToPage(page: number): void;
  /** Set the page size and reset to page 1. */
  setPageSize(count: number): void;

  // ── Grouping ──

  /**
   * Group by an item field (any field, not only ones with a column), or
   * `null` to ungroup. Collapsed-group state is cleared on change and the
   * table resets to page 1 — the interaction side effect that makes this the
   * method to call rather than writing `view.groupBy`. On a virtualized table
   * a non-null key is refused (grouped virtualization is not implemented);
   * clearing stays allowed.
   */
  setGroupBy(key: string | null): void;

  // ── Selection ──
  // Rows are keyed by `item.id`, with the row index as fallback. All
  // selection mutations sync to `prefs.persistSelection` storage when enabled.

  /** The currently selected rows, resolved from `state.selectedIds`. */
  readonly selectedItems: TableItem[];
  /** Whether every *filtered* row is selected (the header checkbox state). */
  readonly allSelected: boolean;
  /** Whether some but not all filtered rows are selected (indeterminate). */
  readonly someSelected: boolean;
  /** Select one row (in `single` mode this replaces the selection). */
  selectItem(id: string | number): void;
  /** Deselect one row. */
  deselectItem(id: string | number): void;
  /** Toggle one row's selection. */
  toggleItem(id: string | number): void;
  /** Select every filtered row (multi mode). */
  selectAll(): void;
  /** Clear the selection. */
  deselectAll(): void;
  /** Header-checkbox behaviour: select all filtered rows, or clear if all are selected. */
  toggleAll(): void;
  /** Whether the row with `id` is selected. */
  isSelected(id: string | number): boolean;
  /** Replace the selection with `ids`. */
  setSelectedIds(ids: Array<string | number>): void;

  // ── Summaries ──

  /** Add (or replace, per column) a summary aggregation; shows the summary row. */
  addSummaryConfig(config: SummaryConfig): void;
  /** Remove the summary for `column`; hides the summary row when none remain. */
  removeSummaryConfig(column: string): void;
  /** Toggle the summary row's visibility. */
  toggleSummary(): void;
  /** Replace all summary configurations; summary row shows iff any remain. */
  setSummaryConfigs(configs: SummaryConfig[]): void;

  // ── Live updates ──
  // The push family is the feed side (call from your WebSocket/SSE handler);
  // pushes buffer instead of applying, and the apply/dismiss family is the
  // user's decision. See `enableLiveUpdates`.

  /** Pending buffer counts (`inserts`/`updates`/`deletes`/`total`), reactive. */
  readonly liveUpdateCounts: LiveUpdateCounts;
  /** Whether anything is buffered — drives the `LiveUpdateBanner`. */
  readonly hasPendingUpdates: boolean;
  /** Buffer a new row. */
  pushInsert(item: TableItem): void;
  /** Buffer a partial change to the row with `id`. */
  pushUpdate(id: string | number, changes: Partial<TableItem>): void;
  /** Buffer a row removal. */
  pushDelete(id: string | number): void;
  /** Apply the whole buffer (deletes prune the selection too). */
  applyAllUpdates(): void;
  /** Apply only the buffered inserts. */
  applyInserts(): void;
  /** Apply only the buffered updates. */
  applyUpdates(): void;
  /** Apply only the buffered deletes (prunes deleted rows from the selection). */
  applyDeletes(): void;
  /** Drop the whole buffer without applying. */
  dismissAllUpdates(): void;
  /** Whether the row with `id` was applied recently — drives the row highlight. */
  isRecentlyUpdated(id: string | number): boolean;
  /** Whether the row with `id` has a buffered delete pending. */
  isPendingDelete(id: string | number): boolean;
}

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
 *   viewDefaults={{ pageSize: 25 }}
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
 * @example Server-side data with a managed source
 * ```svelte
 * <Table
 *   columns={columns}
 *   source={{
 *     processing: 'server',
 *     query: async (view, { signal }) => {
 *       const res = await fetch(`/api/users?page=${view.page}`, { signal });
 *       return await res.json();
 *     }
 *   }}
 * />
 * ```
 *
 * @example Virtual scrolling for large datasets
 * ```svelte
 * <Table items={tenThousandRows} columns={columns} virtualized virtualHeight="500px" />
 * ```
 *
 * @example Persist the view across reloads ("yesterday's view is still there")
 * ```svelte
 * <script lang="ts">
 *   import { Table, createTableView, bindViewToStorage } from '@urbicon-ui/table';
 *
 *   const view = createTableView({ defaults: { pageSize: 25 } });
 *   bindViewToStorage(view, { key: 'expenses' });
 * </script>
 *
 * <Table {items} {columns} {view} prefs={{ storage: 'expenses' }} />
 * ```
 */
export interface TableProps<T = TableItem> {
  /**
   * Array of data items to display in the table — the shorthand for
   * `source={{ processing: 'client', items }}`, and the right prop whenever the rows are all you
   * have to say. Reach for {@link source} once loading, error or a server
   * total come into it.
   *
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
   *
   * Applies to both layouts — on a narrow container the same frame wraps the
   * mobile record list, whose records are separated by hairlines instead of
   * each carrying a frame.
   * @default "flush"
   * @summary How much chrome the table carries: none, a tinted zone, or a framed block.
   */
  variant?: 'flush' | 'surface' | 'framed';

  /**
   * The view object — the six shareable axes (search, sort, page, pageSize,
   * filters, groupBy) as one consumer-constructed reactive object, fully
   * resolved against its `defaults`. The table reads and writes its fields
   * directly (`view.page`, `view.sort`, …); decorate it with `bindViewToUrl`
   * (from `@urbicon-ui/sveltekit-utils`) and/or `bindViewToStorage` to give
   * the axes a home — the bindings are decorations over the object, not
   * props of the table.
   *
   * Leave unset for a table that owns its view (zero-config); use
   * {@link viewDefaults} to adjust the defaults of that owned view. Passing
   * both fails loud (also in prod — a miswired view corrupts state either
   * way). Resolved once, at construction: a view is an identity, not a
   * value — a later change of this prop is ignored.
   *
   * The table's own interaction handlers reset the page on a new search,
   * filter or grouping; a *direct field write* (`view.search = 'x'`) does
   * not — write `view.page = 1` alongside, or go through the context's
   * `setSearch`.
   *
   * **Sharing one view across tables.** Several tables may mount the same
   * view: they read and write the same six axes, and a table takes no claim
   * of its own (a remounting `{#if}` child inherits the current state).
   * Two limits are worth knowing. A **virtualized** table discards any
   * grouping as a system decision, and on a shared view that discard is not
   * scoped to the table that made it — an un-virtualized sibling loses a
   * grouping it could render, so give the virtualized table its own view.
   * And a **managed source** (`{ query }`) on both tables fetches once *per
   * table* per interaction — a shared view is not a shared cache; wire the
   * fetch once yourself and hand both tables a manual `processing: 'server'`
   * source if that matters.
   *
   * @example A view whose state lives in the URL
   * ```svelte
   * <script lang="ts">
   *   import { Table, createTableView } from '@urbicon-ui/table';
   *   import { bindViewToUrl } from '@urbicon-ui/sveltekit-utils/url.svelte';
   *
   *   const view = createTableView({ defaults: { pageSize: 25 } });
   *   bindViewToUrl(view);
   * </script>
   *
   * <Table {items} {columns} {view} />
   * ```
   * @default undefined
   */
  view?: TableView;

  /**
   * Defaults for the view the table owns when no {@link view} prop is passed
   * — the one-liner for the most common configuration:
   * `viewDefaults={{ pageSize: 25 }}`. Mutually exclusive with `view`
   * (a consumer-owned view carries its own defaults); passing both fails
   * loud. Resolved once, at construction — a later change of this prop is
   * ignored.
   * @default undefined
   */
  viewDefaults?: TableViewDefaults;

  /**
   * Where the rows come from, and **who processes them** — sorts, filters,
   * searches and pages. Three shapes, and the invalid combinations of the old
   * `mode`/`queryFn`/`loading`/`error`/`serverTotal` props are not
   * expressible:
   * - `{ processing: 'client', items, loading?, error? }` — the table does
   *   that work in the browser; you fetched the rows, so `loading`/`error`
   *   are yours to report
   * - `{ processing: 'server', items, total, loading?, error? }` — your
   *   backend does it; you fetch and hand in each page
   * - `{ processing: 'server', query, debounceMs? }` — same, and the table
   *   calls `query` when the view changes (first fetch immediate, later ones
   *   debounced), manages loading/error and aborts superseded requests
   *
   * `processing` is required on every variant: it decides whether the reader's
   * sort headers reorder the page in front of them or ask your backend for a
   * different one, which is too visible a difference to be inferred from a
   * `total` that happened to be passed.
   *
   * For rows and nothing else, reach for {@link items} —
   * `source={{ processing: 'client', items }}` says the same thing. `source`
   * wins when both are set.
   *
   * @example Managed server flow
   * ```svelte
   * <Table
   *   {columns}
   *   source={{
   *     processing: 'server',
   *     query: async (view, { signal }) => {
   *       const res = await fetch(`/api/users?page=${view.page}`, { signal });
   *       return await res.json();
   *     }
   *   }}
   * />
   * ```
   * @default undefined
   */
  source?: TableSource<T>;

  /**
   * Preference channel (#152): column visibility, column order, summaries —
   * and, opt-in, the selection. Preferences belong to the table, not the
   * view: nobody wants to share a link that hides columns on the other end,
   * so they live in web storage, never in the URL.
   *
   * `storage` names the storage key (string shorthand or
   * `{ key, kind?, debounceMs? }`); `defaults` are the initial preferences
   * for a table nobody touched (applied at construction, SSR-visible);
   * `persistSelection: true` opts the selection into storage.
   *
   * Using the same key string here and in `bindViewToStorage` is a naming
   * convention, not a link: the two channels stay independent, so persisting
   * both the view and the preferences always takes both statements.
   *
   * @example
   * ```svelte
   * <Table {items} {columns} prefs={{ storage: 'expenses' }} />
   * ```
   * @default undefined
   */
  prefs?: TablePrefsConfig;

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
   * The width below which the table stops being a grid and becomes one card per
   * row. Measured on the table's **own container** — not on the window — so a
   * table in a narrow column switches while the window stays wide.
   *
   * The right step depends on the columns, which is why it is a prop: a
   * four-column index needs about 29rem and reads fine in a 32rem sidebar,
   * while a twelve-column report is already cramped at 48rem. Add up the column
   * `width`s and pick the next step above the sum.
   *
   * Below the step the grid is not squeezed, it is replaced: the card list
   * takes over, and the grid only ever renders at or above the width it was
   * given. A grid wider than its container scrolls sideways.
   *
   * @example
   * ```svelte
   * <Table {items} {columns} cardsBelow="28rem" />
   * ```
   * @default "48rem"
   * @summary The container width below which rows become cards — pick it from your column widths.
   */
  cardsBelow?: CardsBelowStep;

  /**
   * How much of a record a mobile card shows before it is opened. Below
   * {@link TableProps.cardsBelow} of the table's **own container** — not of the
   * window — the table renders one card per row instead of the grid.
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
   * affordances are suppressed, and a grouping arriving through the view
   * (its defaults, a URL, storage) is discarded as a *system* decision (DEV
   * warns): the URL is cleaned, but the discard never reaches storage as a
   * user wish, so a stored grouping applies again on the next load without
   * `virtualized`.
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
   * Text displayed during loading state. The loading *state* itself comes
   * from the {@link source} — `{ items, loading }` for data you fetch
   * yourself, or the managed `{ query }` flow where the table drives it.
   * @default i18n `data.loading`
   */
  loadingText?: string;

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
   * grid's `<tbody>`. **Grid only:** the card list below
   * {@link TableProps.cardsBelow} renders
   * {@link noDataText} instead, because row markup cannot live in a `<div>`
   * (the parser drops the tags). Same contract as the two state snippets below.
   * @default undefined
   */
  emptyState?: Snippet;

  /**
   * Custom loading state snippet, rendered while the {@link source} reports
   * loading. Named after its `slotClasses.loadingState` slot.
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
   * The context is a live object typed as {@link TableContext} — since v8 a
   * hand-written, deliberately narrow surface: `pushInsert`/`pushUpdate`/
   * `pushDelete` and `applyAllUpdates` for live feeds, the reactive `state`,
   * the derived collections and the documented action methods. Hold on to it
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
   * Remove the default variant classes. Only user-provided `slotClasses` apply.
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
   * - Desktop only (`md`+ **viewport**); mobile keeps normal document-level
   *   scroll. This is the one thing the table decides from the window rather
   *   than from its own container — a nested scroll box is wrong on a phone
   *   whatever the container measures, and only the viewport knows which one
   *   it is.
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
   * A selection restored via `prefs.persistSelection` takes
   * precedence. Later changes to this prop are ignored; users can still
   * change or clear the selection. Rows are keyed by `item.id` (row-index
   * fallback). Precedence when combined with
   * `prefs.persistSelection` goes by *presence*, not emptiness:
   * once storage holds a selection for this table — including the empty one
   * written when the user deselected everything — it wins and the seed no
   * longer applies.
   * @default undefined
   */
  initialSelectedIds?: Array<string | number>;

  /**
   * Controlled selected row ids. When set, `initialSelectedIds` is ignored
   * and the table adopts this value: it seeds the selection at construction —
   * the server HTML carries the selected rows — and every later prop value
   * replaces the selection. An empty array is a valid value — nothing
   * selected; `undefined` returns ownership to the table. User clicks still
   * change the selection and fire {@link onSelectionChange} — write the new
   * ids back into this prop, or the next change to it discards what the user
   * clicked. Never written to storage (`prefs.persistSelection` has no
   * effect), and a stored selection never overrides it — the prop is the
   * source of truth.
   * @default undefined
   */
  selectedIds?: Array<string | number>;

  /**
   * Callback fired when the selection changes — and only then. Paging,
   * sorting or a new page of server rows do not fire it.
   *
   * The first argument is the selected rows, the second their ids. The two are
   * **not** interchangeable: rows can only be handed over for the items the
   * table currently holds, so under `processing: 'server'` the first argument
   * carries the selected rows *of the loaded page* while the second carries the
   * whole selection.
   *
   * With controlled {@link TableProps.selectedIds}, write the **ids** back —
   * `(items, ids) => (selectedIds = ids)`. Mapping the rows instead
   * (`items.map((item) => item.id)`) is correct in client mode and silently
   * drops every row from another page in server mode.
   * @example
   * ```svelte
   * <Table
   *   {items}
   *   {columns}
   *   selectionMode="multi"
   *   {selectedIds}
   *   onSelectionChange={(items, ids) => (selectedIds = ids)}
   * />
   * ```
   * @default undefined
   * @summary Fires when the selection changes, with the selected rows and — always complete — their ids.
   */
  onSelectionChange?: (selectedItems: T[], selectedIds: Array<string | number>) => void;
}
