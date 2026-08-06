<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { resolveDateLocale, useI18n } from '@urbicon-ui/i18n';
  import { findColumnById } from '$lib';
  import { useTableI18n } from '$lib/i18n';
  import { ColumnValidation } from '$lib/factories/ColumnValidation';
  import type { Column, TableItem } from '$lib/types/tableTypes';
  import {
    attachCellLocale,
    attachTableContext,
    createTableState,
    type TablePrefsConfig
  } from '$lib/stores/TableStore.svelte';
  import { createManagedFetch } from '$lib/view/observe.svelte';
  import type { TableSource } from '$lib/view/source';
  import { resolveViewProp, type TableView, type TableViewDefaults } from '$lib/view/view.svelte';
  import type { TableContext } from './table/index';

  const tt = useTableI18n();

  // Resolved once per table and published on the context, not read per cell —
  // see `attachCellLocale`. A getter, so a locale switch re-renders the cells.
  const i18n = useI18n();
  attachCellLocale(() => resolveDateLocale('auto', i18n.locale));

  export type TableProviderProps = {
    /** Shorthand for `source={{ processing: 'client', items }}` — just the rows. */
    items?: TableItem[];
    columns: Column[];
    /** Where the rows come from — see the `TableSource` union. Wins over `items`. */
    source?: TableSource;
    /** The consumer-owned view object. Mutually exclusive with `viewDefaults`. */
    view?: TableView;
    /** Shorthand defaults for a table that owns its view. Mutually exclusive with `view`. */
    viewDefaults?: TableViewDefaults;
    /** Preference channel: column visibility/order, summaries, opt-in selection. */
    prefs?: TablePrefsConfig;
    groupOrder?: string[];
    multiExpand?: boolean;
    virtualized?: boolean;
    children?: Snippet;
    enableLiveUpdates?: boolean;
    autoApplyOnNavigation?: boolean;
    selectionMode?: 'none' | 'single' | 'multi';
    rowClickSelects?: boolean;
    activeRowId?: string | number | null;
    selectedIds?: Array<string | number>;
    initialSelectedIds?: Array<string | number>;
    onSelectionChange?: (selectedItems: TableItem[]) => void;
    enableColumnVisibility?: boolean;
    onReady?: (context: TableContext) => void;
  };

  let {
    items = [],
    columns = [],
    source = undefined,
    view = undefined,
    viewDefaults = undefined,
    prefs = undefined,
    groupOrder = [],
    multiExpand = false,
    virtualized = false,
    children,
    enableLiveUpdates = false,
    autoApplyOnNavigation = true,
    selectionMode = 'none',
    rowClickSelects = false,
    activeRowId = null,
    selectedIds = undefined,
    initialSelectedIds = undefined,
    onSelectionChange = undefined,
    enableColumnVisibility = true,
    onReady = undefined
  }: TableProviderProps = $props();

  // The view is resolved once, at construction: a table without a `view` prop
  // owns an unbound view of its own (zero-config), `viewDefaults` is the
  // shorthand for exactly that table, and passing both is fail-loud. Later
  // changes to either prop are ignored — a view is an identity, not a value.
  // svelte-ignore state_referenced_locally
  const tableView = resolveViewProp(view, viewDefaults);

  // `source` wins over the `items` shorthand, which is exactly the union's
  // client arm — wrapping it here is the whole resolution. A `$derived` rather
  // than an inline expression at each of the two use sites: it caches, so the
  // shorthand path hands out ONE object identity for as long as `items` itself
  // is stable, instead of a fresh literal per read.
  const resolvedSource = $derived<TableSource>(source ?? { processing: 'client', items });

  // Store is built once from the initial prefs config — not meant to
  // re-create if the prop changes reactively. `initialSelectedIds` is
  // construction-time-only (seed-once); a controlled `selectedIds` wins over
  // it and seeds construction too, so the controlled value is in the SERVER
  // HTML (runtime changes of the prop, which only exist client-side, are
  // applied by the effect below) — and, per syncSelection, a controlled
  // selection is never mirrored to storage.
  // svelte-ignore state_referenced_locally
  const tableState = createTableState(
    tableView,
    prefs,
    // Prop → store, as getters rather than as effects: a derived is evaluated
    // during SSR, so the server renders the actual rows and columns instead
    // of an empty table (#10). See docs/SVELTE5-PATTERNS.md → "Prop-derived state".
    {
      // The store's resolution stages harden everything downstream against
      // fresh source literals a consumer hands in per render.
      source: () => resolvedSource,
      columns: () => columns,
      multiExpand: () => multiExpand,
      groupOrder: () => groupOrder,
      selectionMode: () => selectionMode,
      selectionControlled: () => selectedIds !== undefined,
      rowClickSelects: () => rowClickSelects,
      activeRowId: () => activeRowId ?? null,
      virtualized: () => virtualized,
      enableColumnVisibility: () => enableColumnVisibility
    },
    { selectedIds: selectedIds ?? initialSelectedIds }
  );
  attachTableContext(tableState);

  const { state } = tableState;

  // Virtualization vs. grouping, construction half: a grouping the view
  // arrived with (defaults, or a URL binding's init) is discarded as a
  // *system* decision — the read gate in the store already hides it (during
  // SSR too), and the `system` origin is what lets the URL binding clean the
  // param while the storage binding keeps the discard out of storage (a
  // persisted grouping lives again on the next un-virtualized load).
  // svelte-ignore state_referenced_locally
  if (virtualized && tableView.groupBy) {
    if (import.meta.env?.DEV) {
      console.warn(
        `[Table] Ignoring grouping ("${tableView.groupBy}") on a virtualized table — grouped virtualization is not implemented. Drop \`virtualized\` to group, or group server-side.`
      );
    }
    tableView.applyExternal({ groupBy: null }, 'system');
  }

  // Everything storage supplied lands here, and the `$effect` is the whole
  // point: it does not run on the server, so the server's HTML and the
  // client's first render agree, and the stored preferences arrive
  // afterwards. Storage exists only in the browser, so no axis read from it
  // may be applied before hydration.
  //
  // Untracked: it drains a snapshot taken at construction and must run once.
  $effect(() => {
    untrack(() => tableState.applyPersistedState());
  });

  // The collapse set holds *group names* — values of whatever column is grouped
  // by — so it cannot outlive its key: after regrouping, those names mean
  // nothing, and one that happens to match collapses a group nobody touched.
  // `setGroupBy` clears it for every imperative path, but the applied grouping
  // also changes when a URL binding applies a navigation — no setter involved.
  // Watching the value covers that door. The page deliberately stays out
  // of it: resetting to page 1 belongs to a click, not to a link that names
  // its own page.
  let lastGroupKey: string | null | undefined;
  $effect(() => {
    const key = state.effectiveGroupBy;
    const previous = untrack(() => lastGroupKey);
    lastGroupKey = key;
    if (previous === undefined || key === previous) return;
    untrack(() => {
      state.collapsedGroups = new SvelteSet();
      state.allGroupsExpanded = true;
    });
  });

  // Virtualization vs. grouping, runtime half: a grouping that arrives while
  // virtualized (runtime toggle into virtualization, a later URL navigation)
  // is discarded the same way — as a `system` write, so view, URL and
  // rendering agree instead of diverging for the table's lifetime.
  $effect(() => {
    if (!virtualized) return;
    const active = tableView.groupBy;
    if (!active) return;
    if (import.meta.env?.DEV) {
      console.warn(
        `[Table] Ignoring grouping ("${active}") on a virtualized table — grouped virtualization is not implemented.`
      );
    }
    untrack(() => {
      tableView.applyExternal({ groupBy: null }, 'system');
    });
  });

  // ── DEV validation of the props the store derives from ──
  // Effects, legitimately: they only report.
  $effect(() => {
    if (!import.meta.env?.DEV || !columns || columns.length === 0) return;
    const result = ColumnValidation.validateColumns(columns);
    if (!result.isValid) {
      console.warn('[Table] Column validation:', result.errors);
    }
    // A sort against a nonexistent column stays silently inert
    // (read-tolerant), so surface it. This value usually comes from a URL or
    // the view defaults, so it can be set by whoever sent the link rather
    // than by the developer.
    const sortColumn = tableView.sort?.column;
    if (sortColumn && !findColumnById(columns, sortColumn)) {
      console.warn(
        `[Table] the view's sort column "${sortColumn}" does not match any column id — the table renders unsorted.`
      );
    }
  });

  // Turning column visibility off means "all columns visible": reveal everything
  // and drop any hidden set — including one hydrated from persistence —
  // otherwise persisted-hidden columns would be stranded (hidden, with both
  // restore UIs gated off). A write to a different slice, so still an effect;
  // untrack keeps it keyed only on the flag.
  $effect(() => {
    if (enableColumnVisibility) return;
    untrack(() => tableState.showAllColumns());
  });

  // Controlled selection: the flag itself derives from the prop (see above), but
  // *applying* the value is a write into the selection set, which is a genuine
  // effect. untrack keeps it keyed only on the prop: setSelectedIds reads
  // `state.selectedIds` on its write path, so without it every internal row click
  // would re-run this, re-assert the stale prop value and freeze the selection
  // against user interaction.
  $effect(() => {
    if (!selectedIds) return;
    untrack(() => tableState.setSelectedIds(selectedIds));
  });

  $effect(() => {
    if (onSelectionChange && state.selectionMode !== 'none') {
      const selected = tableState.selectedItems;
      onSelectionChange(selected);
    }
  });

  // Hand the context to consumers outside the table's tree (getTableContext()
  // only resolves inside it). untrack keeps the callback off the dependency
  // list; an inline arrow prop would otherwise re-fire this on every parent
  // re-render.
  let readyFired = false;
  $effect(() => {
    if (readyFired || !onReady) return;
    readyFired = true;
    untrack(() => onReady(tableState));
  });

  // ── Managed server fetch ──
  // The whole lifecycle lives in `createManagedFetch`: first fetch immediate,
  // later ones debounced (`source.debounceMs`), in-flight aborts, destroy
  // teardown. It tracks the structural view key and the boolean "is a
  // managed source wired" — never the source object or its `query` function,
  // so a fresh inline `source={{ query: … }}` literal per parent render does
  // not refetch. A no-op for client and manual-server sources.
  createManagedFetch(tableView, () => resolvedSource, {
    onLoading: tableState.setServerLoading,
    onResult: tableState.setServerResult,
    onError: (message) => tableState.setServerError(message ?? tt('error.fetchFailed'))
  });

  // ── Live updates: auto-apply on navigation ──
  $effect(() => {
    if (!enableLiveUpdates || !autoApplyOnNavigation) return;

    // Track ONLY the navigation signature — one snapshot read covers all six
    // axes, whether a field write or a binding's applyExternal changed them.
    // Read unconditionally, before any pending check: tracking
    // `hasPendingUpdates` here would re-run the effect on every push and
    // apply the buffer immediately instead of deferring it to the next
    // navigation.
    void tableView.snapshot();

    // Auto-apply pending changes when the user navigates (view is already
    // changing). untrack: the pending check and the apply read/write
    // live-update state, which must not become a dependency of this effect —
    // without it the effect ran 3× per navigation (push triggers, buffer
    // reset re-invalidates).
    untrack(() => {
      if (tableState.hasPendingUpdates) {
        tableState.applyAllUpdates();
      }
    });
  });
</script>

{#if children}
  {@render children()}
{/if}
