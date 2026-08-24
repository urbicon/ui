import { createOptionalContext } from '@urbicon-ui/blocks';
import { BASE_LOCALE } from '@urbicon-ui/i18n';
import { SvelteSet } from 'svelte/reactivity';
import type { Column, TableItem } from '$lib';
import type { TableContext } from '$lib/core/table/index.js';
import { normalizeItems } from '$lib/utils';
import type { SummaryType } from '$lib/utils/summary-types.js';
import { resolveSource, type TableSource } from '$lib/view/source';
import { createTableView, type TableView } from '$lib/view/view.svelte';
import type { TableState } from './concerns/types.js';
import { useColumnOrder } from './concerns/useColumnOrder.svelte.js';
import { useColumnVisibility } from './concerns/useColumnVisibility.svelte.js';
import { useExpansion } from './concerns/useExpansion.svelte.js';
import { useFiltering } from './concerns/useFiltering.svelte.js';
import { useFocusManagement } from './concerns/useFocusManagement.svelte.js';
import { useGrouping } from './concerns/useGrouping.svelte.js';
import { useLiveUpdates } from './concerns/useLiveUpdates.svelte.js';
import { usePagination } from './concerns/usePagination.svelte.js';
import { usePrefs } from './concerns/usePrefs.svelte.js';
import { useRemoteData } from './concerns/useRemoteData.svelte.js';
import { useSearch } from './concerns/useSearch.svelte.js';
import { useSelection } from './concerns/useSelection.svelte.js';
import { useSorting } from './concerns/useSorting.svelte.js';
import { useSummary } from './concerns/useSummary.svelte.js';

/**
 * Column summary configuration.
 * Defines which column to aggregate and how. The store keeps at most one
 * aggregation per column — when a set of configs carries duplicates, the
 * later entry wins (same rule as re-adding a column).
 */
export interface SummaryConfig {
  /** Column key to aggregate */
  column: string;
  /**
   * Aggregation type — derived from the one vocabulary in
   * `utils/summary-types.ts`, so the union and the rendered list of
   * types cannot drift apart (#251).
   */
  type: SummaryType;
  /** Optional custom formatter for the aggregated value */
  formatter?: (value: number) => string;
}

/**
 * The table's preference channel (#152): column visibility, column order,
 * summaries — and, opt-in, the selection. Preferences belong to the *table*:
 * nobody wants to share a link that hides columns on the other end, so they
 * live in web storage, never in the URL. The six view axes (search, sort,
 * page, page size, filters, grouping) are the view object's business —
 * persisted, if at all, through `bindViewToStorage`.
 *
 * Stored values are read at construction and **applied after hydration**
 * (storage does not exist on the server, so anything applied earlier makes
 * the client's first render disagree with the server HTML). `defaults` are
 * deterministic on both sides and therefore apply at construction — a
 * default-hidden column is hidden in the server HTML too. A stored value
 * wins over the matching default, including a stored *empty* one.
 */
export interface TablePrefsConfig {
  /**
   * Where to persist the preferences. A string is the shorthand for
   * `{ key }`; without this field the preferences stay volatile and only
   * `defaults` apply.
   */
  storage?:
    | string
    | {
        /** Unique identifier for this table — used as the storage-key suffix. */
        key: string;
        /** Storage type. @default 'localStorage' */
        kind?: 'localStorage' | 'sessionStorage';
        /** Write debounce in ms. @default 500 */
        debounceMs?: number;
      };
  /** Initial preferences for a table nobody has touched yet. */
  defaults?: {
    /** Column ids hidden initially. */
    hiddenColumns?: string[];
    /** Initial column order (resolved column ids). */
    columnOrder?: string[];
    /** Initial summary configurations. */
    summaries?: SummaryConfig[];
  };
  /**
   * Persist selected row ids across reloads. **Opt-in — default `false`**,
   * unlike every axis above (a restored selection surprises more often than
   * it helps). No effect when `selectedIds` is controlled: the prop is the
   * source of truth, so a controlled value is never written to storage.
   * Rows are keyed by `item.id`; without a stable `id` the selection falls
   * back to the row's position index, which restores onto *different* rows
   * after a reorder — enable this only for data with stable ids.
   */
  persistSelection?: boolean;
}

/**
 * The consumer props the store derives from, handed in as getters so the source
 * stays tracked.
 *
 * Every entry here used to be mirrored into the store by an `$effect` in
 * `TableProvider`. Effects do not run during server rendering, so none of it
 * reached the prerendered HTML — the table rendered its empty state and, on the
 * docs site, 81 API pages asserted the documented component had no properties
 * (#10). As getters feeding deriveds, the same values are evaluated during SSR.
 *
 * All optional: a store constructed without them behaves exactly as the old
 * defaults did, which is what keeps the store's own test suite meaningful.
 */
export interface TablePropSources {
  /** The data source union — `TableProvider` resolves the `items` shorthand into it. */
  source?: () => TableSource | undefined;
  columns?: () => Column[];
  multiExpand?: () => boolean;
  groupOrder?: () => string[];
  selectionMode?: () => 'none' | 'single' | 'multi';
  /** Whether `selectedIds` is controlled — i.e. the prop is present. */
  selectionControlled?: () => boolean;
  rowClickSelects?: () => boolean;
  activeRowId?: () => string | number | null;
  virtualized?: () => boolean;
  enableColumnVisibility?: () => boolean;
}

/** Construction-time seeds that are neither view nor preference state. */
export interface TableSeedState {
  /**
   * Initial selected row ids (keyed by `item.id`, row-index fallback),
   * applied once at construction — during SSR too, so the seed is in the
   * server HTML. `TableProvider` feeds it from the controlled `selectedIds`
   * prop when that is present, from `initialSelectedIds` otherwise. For the
   * uncontrolled seed, a selection restored via `prefs.persistSelection`
   * takes precedence — including a stored *empty* one; a controlled seed
   * wins over storage (the prop is the source of truth).
   */
  selectedIds?: Array<string | number>;
}

// Referentially stable empty list — the managed-source item slot must not
// change identity across re-evaluations, or every parent render would count
// as an items change.
const NO_ITEMS: TableItem[] = [];

// The `source`-less fallback (no `source`, no `items`): a table with no rows
// yet. Hoisted for the same reason as `NO_ITEMS` — a literal here would be a
// fresh object on every re-evaluation of the derived below.
const NO_SOURCE: TableSource = { processing: 'client', items: NO_ITEMS };

/**
 * A source-seeded slot the server machinery may overwrite (`setServerResult`
 * writes `loading`/`error`/`serverTotal`), with an EXPLICIT override
 * lifetime: the override is valid for exactly one seed identity, and the
 * seed's identity changes precisely when `epoch` (the source arm) or the
 * seeded value changes — so an arm flip discards a standing server error, a
 * fetched total, a settled loading, even where the two arms' seed VALUES
 * coincide (error: null on both sides of a managed→client flip, total: 0 on
 * both). Value-identical fresh source literals re-derive neither input
 * (both are primitive intermediate deriveds), so a settled override survives
 * parent re-renders (#153-R1).
 *
 * Deliberately NOT an overridable `$derived`: measured 2026-08-20 (Svelte
 * 5.56.x, sveltejs/svelte#18681) — under server codegen a reassigned derived
 * is never evaluated again, so the built-in discard on dependency change
 * exists only in the client build. This store runs under both (SSR, node
 * tests) and must behave the same everywhere, so the lifetime rule lives
 * here, in plain state.
 */
function createServerSlot<T>(seed: () => T, epoch: () => unknown) {
  // The box is the override's validity token: one object identity per
  // (arm, seed value) EPISODE. Memoised by value in a plain closure — NOT by
  // relying on the derived staying cached, because an unowned derived (SSR,
  // store-level reads) re-evaluates on read after any write in the system,
  // and a fresh box each time would kill every override on arrival. The
  // memo is pure: same inputs, same box; a change to either input replaces
  // the box for good, so an override from a previous episode can never come
  // back — not even when a later episode carries the same values again
  // (flip away and back), as long as the in-between state was observed by
  // at least one read. An entirely unobserved in-between flip is the one
  // case this cannot see (nothing effect-free can), and it requires that no
  // derived, no DOM and no binding read the store across two consecutive
  // source changes — unreachable in a mounted table.
  let lastBox: { epoch: unknown; value: T } | null = null;
  const seedBox = $derived.by(() => {
    const e = epoch();
    const v = seed();
    if (lastBox === null || lastBox.epoch !== e || lastBox.value !== v) {
      lastBox = { epoch: e, value: v };
    }
    return lastBox;
  });
  // `$state.raw`, necessarily: deep `$state` would proxy the stored box, and
  // `o.box === box` compares that proxy against the original — never equal,
  // so every override would be dead on arrival. The slot value is replaced
  // wholesale, never mutated, which is exactly the raw contract.
  let override = $state.raw<{ box: { epoch: unknown; value: T }; value: T } | null>(null);
  return {
    get value(): T {
      const box = seedBox;
      const o = override;
      return o !== null && o.box === box ? o.value : box.value;
    },
    set value(next: T) {
      override = { box: seedBox, value: next };
    }
  };
}

/**
 * Creates the table state by composing independent concerns.
 *
 * Derived chain: items → filteredItems → sortedItems → grouped → paginatedItems
 *
 * Each concern owns a slice of functionality (search, filtering, sorting, etc.)
 * and shares a reactive state object. The six view axes are NOT on it (#166):
 * the concerns that own an axis take the {@link TableView} itself, so a
 * concern writing `view.page = 1` writes the consumer's object directly, with
 * `user` origin — which is what lets the bindings tell a reader's change from
 * an applied one without the store keeping ownership bookkeeping of its own.
 *
 * **Generic T erasure**: The consumer-facing `TableProps<T>` is generic, but the
 * store operates on `TableItem` (`Record<string, unknown>`). This is intentional —
 * Svelte's context system cannot carry generics, and the store concerns only need
 * property access by string key. Type safety for row data is the consumer's
 * responsibility at the `TableProps<T>` boundary.
 */
export function createTableState(
  view?: TableView,
  prefs?: TablePrefsConfig,
  props?: TablePropSources,
  seed?: TableSeedState
) {
  // A table without a `view` prop owns an unbound view of its own — the
  // zero-config path. `TableProvider` resolves `view`/`viewDefaults` before
  // handing the result in here.
  const tableView = view ?? createTableView();

  // ── Source resolution ────────────────────────────────────────────────────
  //
  // Two derived stages, deliberately (#153-R1 class): `resolvedSource`
  // re-evaluates whenever the consumer passes a fresh `source` literal —
  // which an inline `source={{ query: (q) => … }}` does on every parent
  // render. The stages below extract *stable* values out of it (a mode
  // string, the items reference, booleans), and Svelte skips propagation
  // when a derived's new value is referentially identical to the old one —
  // so nothing downstream re-runs unless the content actually changed.
  const resolvedSource = $derived(resolveSource(props?.source?.() ?? NO_SOURCE));
  const sourceMode = $derived(resolvedSource.mode);
  const sourceItems = $derived(
    resolvedSource.mode === 'server-managed' ? NO_ITEMS : resolvedSource.items
  );
  // A managed source seeds `loading` TRUE: its first fetch is unavoidable, so
  // "loading" is the honest construction-time state — and only a
  // construction-time value reaches the SSR HTML (effects never run there).
  // Seeding false shipped the empty state to every prerendered reader while
  // the fetch had not even started. The overridable derived carries the rest:
  // `setServerResult`/`setServerError` write false, and an arm flip re-seeds
  // (the slots below track the mode as an input).
  const sourceLoading = $derived(
    resolvedSource.mode === 'server-managed' ? true : resolvedSource.loading
  );
  const sourceError = $derived(
    resolvedSource.mode === 'server-managed' ? null : resolvedSource.error
  );
  const sourceTotal = $derived(resolvedSource.mode === 'server-manual' ? resolvedSource.total : 0);

  // ── Prop-driven slots ────────────────────────────────────────────────────
  //
  // Overridable deriveds: evaluated during SSR (#10), still writable for the
  // second writers — live updates and managed fetches assign to
  // `state.items`/`loading`/`error`/`serverTotal`. An assignment holds until
  // a tracked input changes, which then re-seeds.
  // See docs/SVELTE5-PATTERNS.md → "Prop-derived state".
  let items = $derived(normalizeItems(sourceItems));
  // The server-writable slots: seeded from the source, overwritable by
  // `setServerResult`/`setServerError`/`setServerLoading` and live updates,
  // and re-seeded on a genuine arm change — the override lifetime rule lives
  // in {@link createServerSlot}. Measured before this: a server error and a
  // stale serverTotal survived a flip to client (both arms seed the same
  // value there), and the stale total then clamped a deep-link intent on the
  // flip back to managed. `items` stays a plain overridable derived: its
  // seeds differ by array identity on every arm change, so a flip re-seeds
  // it without episode tracking.
  const loadingSlot = createServerSlot(
    () => sourceLoading,
    () => sourceMode
  );
  const errorSlot = createServerSlot(
    () => sourceError,
    () => sourceMode
  );
  const serverTotalSlot = createServerSlot(
    () => sourceTotal,
    () => sourceMode
  );
  let multiExpand = $derived(props?.multiExpand?.() ?? false);
  let groupOrder = $derived(props?.groupOrder?.() ?? []);
  let selectionMode = $derived(props?.selectionMode?.() ?? 'none');
  let selectionControlled = $derived(props?.selectionControlled?.() ?? false);
  let rowClickSelects = $derived(props?.rowClickSelects?.() ?? false);
  let activeRowId = $derived(props?.activeRowId?.() ?? null);
  let virtualized = $derived(props?.virtualized?.() ?? false);
  let enableColumnVisibility = $derived(props?.enableColumnVisibility?.() ?? true);

  // `state.columns` is the *visible* subset. The full list comes from the prop,
  // the filtering lives in `useColumnVisibility` — which needs `state` to exist
  // first, so both accessors are bound in after the concerns are built. Until
  // then the unfiltered prop list is the honest answer (nothing is hidden yet).
  let columnsView: (() => Column[]) | null = null;
  let columnsWrite: ((next: Column[]) => void) | null = null;

  // `state.effectiveSummaryConfigs` is bound in the same way and for the same
  // reason: the "which aggregations are in force" answer is derived once in
  // `useSummary` (#252), and that concern takes `state`, so it cannot exist
  // yet. Until the bind, the empty list is the honest answer — nothing is
  // configured and `showSummary` is false.
  let effectiveSummaryView: (() => SummaryConfig[]) | null = null;

  // ── Shared reactive state ──
  //
  // What the table owns, and nothing the view does (#166): rows, columns, load
  // state, expansion, grouping chrome, summaries, selection, and the
  // prop-driven switches. The one derived value with an axis shape is
  // `effectiveGroupBy`, and it is here because several concerns need the
  // gated grouping and the gate must exist once.
  const state: TableState = $state({
    get items() {
      return items;
    },
    set items(next: TableItem[]) {
      items = next;
    },
    get columns() {
      return columnsView?.() ?? props?.columns?.() ?? [];
    },
    set columns(next: Column[]) {
      columnsWrite?.(next);
    },
    get loading() {
      return loadingSlot.value;
    },
    set loading(next: boolean) {
      loadingSlot.value = next;
    },
    get error() {
      return errorSlot.value;
    },
    set error(next: string | null) {
      errorSlot.value = next;
    },

    expandedItemId: null as string | number | null,
    expandedItemIds: new SvelteSet<string | number>(),
    get multiExpand() {
      return multiExpand;
    },
    set multiExpand(next: boolean) {
      multiExpand = next;
    },

    /**
     * The grouping actually applied, which is not always the one requested —
     * and that gap is why this survived the #166 cut while the other five
     * axis mirrors did not. Grouped virtualization is not implemented, and a
     * key that slips through deactivates virtualization and renders the
     * *entire* item set, so a virtualized table renders ungrouped however the
     * view is set. Read `view.groupBy` for what the reader asked for; read
     * this for what they are looking at.
     *
     * The gate holds during SSR too — a `?group=…` deep link on a virtualized
     * table renders ungrouped on the server. This gate is the ONLY
     * enforcement: the view keeps the value, a URL may keep carrying it, and
     * an un-virtualized reader of the same view renders it grouped. DEV
     * reports the mismatch; nothing writes it away.
     *
     * Read-only: write `view.groupBy`, or call `setGroupBy` for the
     * page-1 reset and the collapsed-group cleanup that go with it.
     */
    get effectiveGroupBy() {
      const requested = tableView.groupBy;
      // Gated on the same overridable slot `useGrouping`'s setter gate reads
      // (`state.virtualized`) — not on the raw prop — so the two gates can
      // never disagree about what "virtualized" currently means.
      return requested && virtualized ? null : requested;
    },
    /**
     * The grouping key the consumer *declared* via `view.defaults.groupBy`,
     * kept for the lifetime of the table and never written again.
     *
     * Grouping accepts any item field, not only the ones that have a column —
     * a table can group by `day` while showing no Day column, because the day
     * belongs in the group header and would be redundant in every row. The
     * grouping menu lists columns, so such a key has no option: the Select held
     * a value it could not display, DEV-logged `[Select] value "day" has no
     * matching option`, and once the user ungrouped there was no way back.
     *
     * Deriving the missing option from the *active* `groupByKey` fixes only the
     * display half — it disappears the moment you ungroup, which is precisely
     * the reported symptom. The declaration is the right source: the consumer
     * asked for this grouping, so it belongs in the menu whether or not it is
     * currently applied.
     */
    declaredGroupByKey: null as string | null,
    collapsedGroups: new SvelteSet<string>(),
    allGroupsExpanded: true,
    get groupOrder() {
      return groupOrder;
    },
    set groupOrder(next: string[]) {
      groupOrder = next;
    },

    summaryConfigs: [] as SummaryConfig[],
    showSummary: false,
    /**
     * The aggregations actually in force — `summaryConfigs` while
     * `showSummary` is true, nothing while it is not. The display-side
     * counterpart of `effectiveGroupBy` above, and public for the same reason:
     * `toggleSummary()` ships no UI, so the consumer who builds that switch
     * would otherwise have to re-derive the combination the table already
     * decided (#252). The derivation itself is in `useSummary`.
     */
    get effectiveSummaryConfigs() {
      return effectiveSummaryView?.() ?? [];
    },

    get selectionMode() {
      return selectionMode;
    },
    set selectionMode(next: 'none' | 'single' | 'multi') {
      selectionMode = next;
    },
    selectedIds: new SvelteSet<string | number>(),
    get selectionControlled() {
      return selectionControlled;
    },
    set selectionControlled(next: boolean) {
      selectionControlled = next;
    },
    get rowClickSelects() {
      return rowClickSelects;
    },
    set rowClickSelects(next: boolean) {
      rowClickSelects = next;
    },
    /**
     * The row currently being shown elsewhere (master/detail) — distinct from
     * selection, which implies an action on a set. Marking it needed
     * `selectionMode` before, which also switches on the checkbox column.
     */
    get activeRowId() {
      return activeRowId;
    },
    set activeRowId(next: string | number | null) {
      activeRowId = next;
    },
    get virtualized() {
      return virtualized;
    },
    set virtualized(next: boolean) {
      virtualized = next;
    },

    get mode() {
      return sourceMode;
    },
    get serverTotal() {
      return serverTotalSlot.value;
    },
    set serverTotal(next: number) {
      serverTotalSlot.value = next;
    },

    get enableColumnVisibility() {
      return enableColumnVisibility;
    },
    set enableColumnVisibility(next: boolean) {
      enableColumnVisibility = next;
    }
  });

  // ── Prefs (reads storage at construction, applies after hydration) ──
  const prefsStore = usePrefs(state, prefs);

  // ── Concerns (composed in derived-chain order) ──
  const search = useSearch(tableView);
  const filtering = useFiltering(state, tableView);
  const sorting = useSorting(state, tableView, () => filtering.filteredItems);
  const grouping = useGrouping(state, tableView, () => sorting.sortedItems);
  const pagination = usePagination(
    state,
    tableView,
    () => filtering.filteredItems,
    () => sorting.sortedItems
  );
  const expansion = useExpansion(state);
  const columnVisibility = useColumnVisibility(() => props?.columns?.() ?? []);
  // Bind the visible-column view now that the concern exists. Before this line
  // `state.columns` answers with the unfiltered prop list, which is correct:
  // nothing can be hidden yet.
  columnsView = () => columnVisibility.visibleColumns;
  columnsWrite = (next) => columnVisibility.setColumns(next);
  const summary = useSummary(
    state,
    () => sorting.sortedItems,
    () => grouping.grouped
  );
  // Bind the in-force summary view now that the concern exists — same contract
  // as the column view above: before this line `state.effectiveSummaryConfigs`
  // answers with the empty list, which is correct (nothing is configured yet).
  effectiveSummaryView = () => summary.effectiveSummaryConfigs;
  const selection = useSelection(state, () => filtering.filteredItems, {
    onPersist: () => prefsStore.syncSelection()
  });
  const columnOrder = useColumnOrder(state);

  /**
   * The item rows in the order they are actually rendered — the one index space
   * keyboard navigation moves through.
   *
   * Ungrouped this is just the current page. Grouped it is NOT: `grouped` buckets
   * every item it is handed — which in client mode is the whole sorted set,
   * because grouping suspends paging there, and in server mode is the current
   * page, because paging continues (#159) — and a collapsed group renders no
   * item rows at all. Feeding `paginatedItems.length` to focus
   * management was therefore wrong in both directions when grouped — it counted a
   * page's worth of rows against a full, partially-hidden list.
   *
   * Group headers are deliberately NOT part of this sequence: they carry their own
   * `tabindex={0}` and answer Enter/Space by collapsing, so they are reachable by
   * Tab without competing with the arrow keys for an index.
   *
   * Virtualized, the rendered rows are the whole sorted list in client mode —
   * pagination is bypassed, exactly as the prop documents — and the loaded
   * page in server mode, where `sortedItems` passes the page through
   * unchanged. Falling through to `paginatedItems` here capped the keyboard
   * index space at `pageSize` while the scroll container rendered everything:
   * past the first page's worth of rows, no row carried `tabindex="0"` any
   * more and the list had no keyboard entry point at all. Gated on the
   * `state.virtualized` slot, not the raw prop — the same slot discipline as
   * `effectiveGroupBy`, so the gates cannot disagree.
   */
  const navigableItems = $derived.by((): TableItem[] => {
    if (state.effectiveGroupBy) {
      return Object.entries(grouping.grouped)
        .filter(([groupName]) => !state.collapsedGroups.has(groupName))
        .flatMap(([, groupItems]) => groupItems);
    }
    if (state.virtualized) return sorting.sortedItems;
    return pagination.paginatedItems;
  });

  const focus = useFocusManagement(state, () => navigableItems.length);
  const remoteData = useRemoteData(state);
  // Delete pruning goes through the selection's commit gate as a user-origin
  // write, so it persists exactly like any other selection change — the pair
  // of repair wrappers that re-synced storage after the fact is gone.
  const liveUpdates = useLiveUpdates(state, {
    pruneSelection: (ids) => selection.deselectMany(ids, 'user')
  });

  /**
   * Apply everything storage supplied — summaries and selection on the shared
   * state, plus the column visibility and order that live inside their own
   * concerns. Called by `TableProvider` from an `$effect`, which is the
   * hydration boundary: storage is a client-only layer, so nothing read from
   * it may reach the server HTML (see {@link TablePrefsConfig}).
   *
   * The `defaults` do NOT run through here — they are deterministic on both
   * sides of hydration and applied at construction below, so a default-hidden
   * column is hidden in the server HTML too. A stored value arriving here
   * overrides the default, including a stored *empty* one.
   */
  let appliedStoredSelection = false;
  function applyPersistedState() {
    prefsStore.applyPersistedState();
    const storedHidden = prefsStore.storedHiddenColumnIds;
    if (storedHidden !== null) {
      columnVisibility.setHiddenIds(storedHidden);
    }
    const storedOrder = prefsStore.storedColumnOrder;
    if (storedOrder !== null && storedOrder.length > 0) {
      columnOrder.applyOrder(storedOrder);
    }
    // The read-side mirror of syncSelection's guard: a controlled selection
    // never reaches storage, and a stored one (from an earlier uncontrolled
    // era) never overrides the controlled prop. Applied through the commit
    // gate as `external`: hydration is not a user action and must not write
    // back to storage. Once, ever — the drained-pending contract the prefs
    // concern documents: a second call must not re-apply the stored snapshot
    // over a value the user has since changed.
    const storedSelection = prefsStore.storedSelectionIds;
    if (!appliedStoredSelection && storedSelection !== null && !state.selectionControlled) {
      appliedStoredSelection = true;
      selection.setSelectedIds(storedSelection, 'external');
    }
  }

  // ── Construction-time defaults ──
  //
  // Prefs defaults apply synchronously (SSR-visible); a stored value replaces
  // them after hydration. Deliberately WITHOUT a storage write-back: since v8
  // a default is not synced into storage — only what the reader themselves
  // changes is written. After a deploy with changed defaults the new default
  // greets returning readers who never touched the axis (the seed-resync
  // delta, v8 notes).
  if (prefs?.defaults?.hiddenColumns?.length) {
    columnVisibility.setHiddenIds(prefs.defaults.hiddenColumns);
  }
  if (prefs?.defaults?.columnOrder?.length) {
    columnOrder.applyOrder(prefs.defaults.columnOrder);
  }
  const summaryDefaults = prefs?.defaults?.summaries;
  if (
    summaryDefaults &&
    summaryDefaults.length > 0 &&
    state.summaryConfigs.length === 0 &&
    !prefsStore.hydratedSummaryConfigs
  ) {
    // `setSummaryConfigs` normalizes into a fresh array, so the default never
    // aliases the consumer's array (pinned by the seed tests).
    summary.setSummaryConfigs(summaryDefaults);
  }
  if (
    seed?.selectedIds &&
    seed.selectedIds.length > 0 &&
    state.selectedIds.size === 0 &&
    // A controlled selection is the source of truth over anything storage
    // holds; only the uncontrolled initial seed yields to a stored value.
    (state.selectionControlled || !prefsStore.hydratedSelection)
  ) {
    // A seed is not a user action and must not write storage (origin rule).
    selection.setSelectedIds(seed.selectedIds, 'external');
  }
  if (tableView.defaults.groupBy) {
    // Recorded even when grouping is not currently applied: it is a
    // declaration about what the grouping menu should offer, not about what
    // is grouped right now.
    state.declaredGroupByKey = tableView.defaults.groupBy;
  }

  // ── Thin wrappers ──
  //
  // The view axes need no persistence syncing anymore: they write into the
  // view object, and whatever bindings the consumer attached observe it. The
  // prefs axes keep their explicit `sync*` calls — prefs storage is fed from
  // the table's own action wrappers, never from a value resolving.
  function setItems(newItems: TableItem[]) {
    state.items = normalizeItems(newItems);
  }

  function addSummaryConfig(config: SummaryConfig) {
    summary.addSummaryConfig(config);
    prefsStore.syncSummaryConfigs();
  }

  function removeSummaryConfig(column: string) {
    summary.removeSummaryConfig(column);
    prefsStore.syncSummaryConfigs();
  }

  function setSummaryConfigs(configs: SummaryConfig[]) {
    summary.setSummaryConfigs(configs);
    prefsStore.syncSummaryConfigs();
  }

  function hideColumn(id: string) {
    columnVisibility.hideColumn(id);
    prefsStore.syncHiddenColumns([...columnVisibility.hiddenColumnKeys]);
  }

  function showColumn(id: string) {
    columnVisibility.showColumn(id);
    prefsStore.syncHiddenColumns([...columnVisibility.hiddenColumnKeys]);
  }

  function toggleColumnVisibility(id: string) {
    columnVisibility.toggleColumnVisibility(id);
    prefsStore.syncHiddenColumns([...columnVisibility.hiddenColumnKeys]);
  }

  function showAllColumns() {
    columnVisibility.showAllColumns();
    prefsStore.syncHiddenColumns([]);
  }

  function reorderColumn(fromIndex: number, toIndex: number) {
    columnOrder.reorderColumn(fromIndex, toIndex);
    prefsStore.syncColumnOrder(columnOrder.columnOrder);
  }

  function resetColumnOrder() {
    columnOrder.resetColumnOrder();
    prefsStore.syncColumnOrder([]);
  }

  // Selection needs no wrappers: persistence is decided per write inside the
  // concern's commit gate (`user` persists via `onPersist`, `external` never
  // does) — not by call-site discipline out here. The pair of repair wrappers
  // around the live-update apply path is gone for the same reason: delete
  // pruning goes through the gate too.

  // ── Store surface ──
  // This object is the *internal* surface ({@link InternalTableContext});
  // what consumers see is the hand-written `TableContext` interface — the
  // subset `getTableContext()` and `onReady` are typed against. Adding a
  // member here does NOT publish it; removing or renaming a public one fails
  // the `getTableContext()` return type (and `context.typecheck.ts`).
  // External consumers should prefer the wrapper methods (setSearch,
  // addFilter, handleSort, etc.) which enforce side effects like the
  // page-1 reset.
  return {
    state,
    /** The view object this table reads and writes — the six shareable axes. */
    view: tableView,

    // Derived getters
    get filteredItems() {
      return filtering.filteredItems;
    },
    get sortedItems() {
      return sorting.sortedItems;
    },
    get paginatedItems() {
      return pagination.paginatedItems;
    },
    get total() {
      return pagination.totalItems;
    },
    get totalPages() {
      return pagination.totalPages;
    },
    /** The grouping actually applied — `null` on a virtualized table. */
    get effectiveGroupBy() {
      return state.effectiveGroupBy;
    },
    /**
     * The page actually rendered — `view.page` clamped into range.
     *
     * Everything user-facing reads this, never `view.page`: the raw value is
     * the reader's *intent* and can sit out of range after the page size or
     * the item count changed under it. Displaying it produced
     * a pager reading "5 / 1", and paging keys computed from it went dead in
     * both directions — `PageDown` compares `5 < 3`, `PageUp` asks `goToPage(4)`
     * which the range check rejects.
     */
    get effectivePage() {
      return pagination.effectivePage;
    },
    /**
     * The resolved page descriptor — totals, clamped page, fetch page, range
     * start and pager visibility, answered once for every reader. `total`,
     * `totalPages` and `effectivePage` above are views into it.
     */
    get pageInfo() {
      return pagination.descriptor;
    },
    get grouped() {
      return grouping.grouped;
    },
    /** Rendered item rows in visual order (collapsed groups excluded) — the index
     *  space `focusedRowIndex` addresses. See the derivation above. */
    get navigableItems() {
      return navigableItems;
    },
    get summaryData() {
      return summary.summaryData;
    },
    get groupedSummaryData() {
      return summary.groupedSummaryData;
    },

    // Data management (internal wiring — consumers use the `source` union)
    setItems,
    setColumns: columnVisibility.setColumns,

    // Search
    setSearch: search.setSearch,
    // Internal wiring, not part of the public {@link TableContext}: the search
    // bar writes through this one when its own `searchDebounceMs` timer has
    // already waited, and `TableProvider` hands the reader to the managed
    // fetch so that write does not wait a second time (#255).
    setSearchDebounced: search.setSearchDebounced,
    takeDebouncedSearchWrite: search.takeDebouncedSearchWrite,

    // Filtering
    addFilter: filtering.addFilter,
    removeFilter: filtering.removeFilter,
    removeFiltersByColumn: filtering.removeFiltersByColumn,
    clearAllFilters: filtering.clearAllFilters,
    hasFilterForColumn: filtering.hasFilterForColumn,

    // Sorting
    handleSort: sorting.handleSort,
    setSort: sorting.setSort,

    // Pagination
    setPage: pagination.setPage,
    goToPage: pagination.goToPage,
    setPageSize: pagination.setPageSize,

    // Expansion
    toggleExpand: expansion.toggleExpand,
    isItemExpanded: expansion.isItemExpanded,

    // Grouping
    toggleGroup: grouping.toggleGroup,
    toggleAllGroups: grouping.toggleAllGroups,
    setGroupBy: grouping.setGroupBy,

    // Summary
    addSummaryConfig,
    removeSummaryConfig,
    toggleSummary: summary.toggleSummary,
    setSummaryConfigs,
    getFormattedSummaryValue: summary.getFormattedSummaryValue,

    // Column visibility
    get allColumns() {
      return columnVisibility.allColumns;
    },
    get hiddenColumnKeys() {
      return columnVisibility.hiddenColumnKeys;
    },
    hideColumn,
    showColumn,
    toggleColumnVisibility,
    showAllColumns,

    // Selection
    get selectedItems() {
      return selection.selectedItems;
    },
    get allSelected() {
      return selection.allSelected;
    },
    get someSelected() {
      return selection.someSelected;
    },
    selectItem: selection.selectItem,
    deselectItem: selection.deselectItem,
    toggleItem: selection.toggleItem,
    selectAll: selection.selectAll,
    deselectAll: selection.deselectAll,
    toggleAll: selection.toggleAll,
    isSelected: selection.isSelected,
    setSelectedIds: selection.setSelectedIds,

    // Column order
    get orderedColumns() {
      return columnOrder.orderedColumns;
    },
    get columnOrder() {
      return columnOrder.columnOrder;
    },
    applyPersistedState,
    reorderColumn,
    resetColumnOrder,
    getColumnIndex: columnOrder.getColumnIndex,

    // Focus management
    get focusedRowIndex() {
      return focus.focusedRowIndex;
    },
    resetFocus: focus.resetFocus,
    setFocusedRow: focus.setFocusedRow,
    moveFocus: focus.moveFocus,
    isFocusedRow: focus.isFocusedRow,

    // Remote data (internal wiring — the managed-fetch sink)
    setServerResult: remoteData.setServerResult,
    setServerError: remoteData.setServerError,
    setServerLoading: remoteData.setServerLoading,

    // Live updates
    get liveUpdateCounts() {
      return liveUpdates.counts;
    },
    get hasPendingUpdates() {
      return liveUpdates.hasPending;
    },
    pushInsert: liveUpdates.pushInsert,
    pushUpdate: liveUpdates.pushUpdate,
    pushDelete: liveUpdates.pushDelete,
    applyAllUpdates: liveUpdates.applyAll,
    applyInserts: liveUpdates.applyInserts,
    applyUpdates: liveUpdates.applyUpdates,
    applyDeletes: liveUpdates.applyDeletes,
    dismissAllUpdates: liveUpdates.dismissAll,
    isRecentlyUpdated: liveUpdates.isRecentlyUpdated,
    isPendingDelete: liveUpdates.isPendingDelete,

    // Prefs persistence
    clearPersistedSummaryConfigs: prefsStore.clearPersistedSummaryConfigs,
    clearPersistedHiddenColumns: prefsStore.clearPersistedHiddenColumns,
    clearPersistedColumnOrder: prefsStore.clearPersistedColumnOrder,
    clearPersistedSelection: prefsStore.clearPersistedSelection,
    clearAllPersistentData: prefsStore.clearAllPersistentData,
    forceSavePersistentData: prefsStore.forceSavePersistentData
  };
}

/**
 * The full store surface — everything `createTableState` returns, including
 * the wiring and lifecycle members (`setColumns`, `applyPersistedState`,
 * `setServer*`, focus internals, preference persistence) that the public
 * {@link TableContext} deliberately leaves out.
 *
 * In-tree only: the type is not exported from the package, and the wide
 * surface is reachable solely through {@link getInternalTableContext}. Both
 * context types describe the same live object — the split is a contract
 * boundary, not a second store.
 */
export type InternalTableContext = ReturnType<typeof createTableState>;

// Optional context — the raw getter must be permissive (returns undefined
// when unset) so `getTableContext` can fail loud with its own message.
const [getTableContextRaw, setTableContextRaw] = createOptionalContext<InternalTableContext>();

/**
 * The BCP 47 tag the formatting cells hand to `Intl`, resolved once per table.
 *
 * A getter rather than a value, so a locale switch re-renders: `<TableProvider>`
 * puts `() => resolveDateLocale('auto', useI18n().locale)` here during its own
 * init, and the cells read it.
 *
 * Per table, not per cell, because every cell and every mobile card is its own
 * component instance — a virtualized 2000-row table would otherwise build a
 * fresh `useI18n()` object (eight getters) for each one, thousands of times,
 * to answer a question with the same answer every time.
 */
const [getCellLocaleRaw, setCellLocaleRaw] = createOptionalContext<() => string>();

/**
 * Called by `<TableProvider>` once, alongside {@link attachTableContext}.
 *
 * Exported for the provider, not for consumers: it is pure wiring, and a
 * consumer calling it would silently re-point the formatting locale for a
 * subtree. `getCellLocale()` is the half worth reaching for — a custom
 * `column.component` cell wants the table's resolved tag.
 */
export function attachCellLocale(resolve: () => string) {
  setCellLocaleRaw(resolve);
}

/**
 * The resolved formatting locale for this table. Falls back to the base locale
 * when no provider is mounted, matching `useI18n()`'s own read-tolerance — a
 * cell rendered outside a `<TableProvider>` still formats identically on both
 * sides of hydration.
 */
export function getCellLocale(): string {
  return getCellLocaleRaw()?.() ?? BASE_LOCALE;
}

/**
 * Retrieves the table context — the public, hand-written {@link TableContext}
 * surface. Throws when called outside of a `<TableProvider>` (the `<Table>`
 * component mounts one for you), so consumers within the table tree can rely
 * on a defined return value.
 *
 * The return-type annotation is the contract gate: the wide store object must
 * satisfy the narrow interface, so renaming or removing a public member in
 * `createTableState` fails to compile here.
 */
export function getTableContext(): TableContext {
  return requireTableContext();
}

/**
 * The same live context, typed with the full store surface. In-tree only —
 * the table's own sub-components (header, rows, toolbar, menus) legitimately
 * reach the wiring members from *inside*; consumers get {@link TableContext}
 * via `getTableContext()` and never this.
 */
export function getInternalTableContext(): InternalTableContext {
  return requireTableContext();
}

function requireTableContext(): InternalTableContext {
  const ctx = getTableContextRaw();
  if (!ctx) {
    throw new Error(
      '`getTableContext()` was called outside of a `<TableProvider>`. Wrap the consuming component in `<TableProvider>` (the `<Table>` component does this for you).'
    );
  }
  return ctx;
}

/**
 * Set the table context to an externally-created `tableState`. Used by
 * `<TableProvider>` so it can construct the state once and share it
 * with the rest of the table tree. Not exported from the package.
 */
export function attachTableContext(tableState: InternalTableContext) {
  setTableContextRaw(tableState);
}
