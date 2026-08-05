# @urbicon-ui/table

Feature-complete data table for Svelte 5 — zero runtime dependencies, part of the Urbicon UI monorepo.

> **Maturity:** stable since `v1.0.0` (2026-05-12). `v2.0.0` (2026-05-15) refactored the Column API to separate `accessor` (value extraction) from `id` (state-targeting), eliminating the `"[object Object]"`-search trap; see `CHANGELOG.md`. All nine implementation phases are closed; 232 unit tests cover every concern.

## Installation

```bash
bun add @urbicon-ui/table @urbicon-ui/blocks
```

```css
/* app.css — after Tailwind */
@import '@urbicon-ui/blocks/style/index.css';
@import '@urbicon-ui/table/style/index.css';
```

Peer dependencies: `svelte` (^5), `@urbicon-ui/blocks`, `@urbicon-ui/i18n`. No SvelteKit needed — the package imports neither `$app/*` nor `@sveltejs/kit`.

## Capability Overview

| Area                | Highlights                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Data pipeline       | `$derived`-chain `items → filteredItems → sortedItems → grouped → paginatedItems`; all stages reactive                      |
| Sorting & Filtering | Column sort (asc/desc/none tri-state), smart filter bar, column-level filters, search highlighting, controlled `searchTerm` |
| Selection           | Single / multi, `onSelectionChange`, select-all spans all **filtered** rows, keyboard toggle (`Space`), row-click select (`rowClickSelects`, on by default in single mode) |
| Keyboard            | Roving tabindex, ARIA-Grid role, arrow keys, `Home`/`End`/`PageUp`/`PageDown`, Skip-Link                                    |
| Grouping            | `groupByKey`, collapsible group headers, grouped summary rows                                                               |
| Pagination          | Built-in paginator, auto-disable on grouping, mobile-friendly controls                                                      |
| Virtualization      | `computeVirtualItems` for 10k+ rows (custom, zero deps); `virtualHeight` prop; falls back to normal rendering when inactive |
| Column ordering     | Pointer-event drag-and-drop + `Shift+ArrowLeft/Right` keyboard reorder via shared `createDraggable` action                  |
| Column visibility   | Header menu + persistence API; opt out per column (`hideable: false`) or table-wide (`enableColumnVisibility={false}`)      |
| Remote mode         | `mode: 'server'` + `queryFn` (managed fetch with `AbortSignal`) or `onQueryChange` (manual), debounced, cancellation-safe   |
| URL / view state    | `query` controls search, sort, page, page size, filters and grouping **per axis**; resolved during SSR, so a shared link renders server-side |
| Live updates        | `pushInsert/Update/Delete` pending-buffer, `LiveUpdateBanner`, auto-apply on navigation                                     |
| Styling             | `unstyled`, `slotClasses`, `TableStyleContext` — every subcomponent respects the 17-slot map                                |
| Cells               | `LinkCell`, `NumberCell`, `DateCell`, `UserAvatar`, `StatusBadge`, `CustomCell`, Fill-Cell                                  |
| i18n                | Package-scoped namespace `table.*`, EN + DE                                                                                 |

## Quick Start

```svelte
<script lang="ts">
  import { Table, TableColumns } from '@urbicon-ui/table';

  let items = $state([
    { id: 1, name: 'Alice', role: 'Admin' },
    { id: 2, name: 'Bob', role: 'User' }
  ]);

  const columns = [
    TableColumns.text('name', 'Name', { sortable: true }),
    TableColumns.text('role', 'Role')
  ];
</script>

<Table {items} {columns} selectionMode="multi" onSelectionChange={(rows) => console.log(rows)} />
```

### Server-mode with managed fetch

```svelte
<Table
  mode="server"
  serverTotalItems={total}
  queryFn={async (query, { signal }) => {
    const res = await fetch(`/api/users?${new URLSearchParams(query)}`, { signal });
    return res.json(); // { items, totalItems }
  }}
  {columns}
/>
```

### Live updates

`onReady` hands you the table context from outside the table's tree — the imperative API (`pushInsert` / `pushUpdate` / `pushDelete`, `applyAllUpdates`) plus the reactive `state`:

```svelte
<script lang="ts">
  import { Table, type TableContext } from '@urbicon-ui/table';

  let table = $state<TableContext | null>(null);
</script>

<button onclick={() => table?.pushInsert({ id: crypto.randomUUID(), name: 'New' })}> + row </button>

<Table {items} {columns} enableLiveUpdates onReady={(ctx) => (table = ctx)} />
```

Inside the table's tree (a `toolbar` snippet, a custom cell) `getTableContext()` returns the same object.

## View State in the URL

The axes that decide **which** rows are shown — search, sort, page, page size, filters, grouping — can be controlled from outside via `query`, so the view becomes a link: shareable, reload-proof, and visible to the server. In SvelteKit the wiring is two props:

```svelte
<script lang="ts">
  import { createTableQueryUrlSync } from '@urbicon-ui/sveltekit-utils/url.svelte';

  const sync = createTableQueryUrlSync({ defaults: { itemsPerPage: 25 } });
</script>

<Table {items} {columns} itemsPerPage={25} query={sync.viewState} onQueryChange={sync.syncQuery} />
```

`query` is read **per field**: a field that is present controls its axis, an absent one leaves persistence and the `initial*` seeds alone (`{ page: 2 }` pages without clearing a stored sort). An explicitly empty value is a real state — `sortColumn: ''` means "no sort", and no seed slips past it.

Each controlled axis is a `$derived`, not a value written at construction, and that is the point: **`$effect` never runs during server rendering**, so view state ingested in one is absent from the prerendered HTML and the client swaps the table out on hydration. A derivation resolves on the server, so the linked view is in the markup that arrives — which `localStorage` can never achieve, since the server cannot read it. `query` is what makes a sorted, filtered table server-renderable at all.

Column visibility and column order are deliberately **not** part of `query`. They are presentation rather than selection — nobody wants to share a link that hides columns on the other end — so they stay in `localStorage` and the server renders every column. A `groupByKey` arriving from a URL is refused on a `virtualized` table, exactly like every other route into grouping.

`@urbicon-ui/sveltekit-utils` is a peer of the wiring, not of this package: `query` takes a plain `TableViewState`, so any router (or a plain `$state` object) can drive it.

## State Persistence

`persistenceConfig={{ tableId: 'foo' }}` is enough to make filters, search, group-by, summaries, sort, column visibility and column order survive a page reload. Every axis is on by default and stored under a `tableId`-scoped key in `localStorage`. Pagination is intentionally **not** persisted — page 1 on navigation is standard UX.

```svelte
<Table {items} {columns} persistenceConfig={{ tableId: 'expenses' }} />
```

Disable individual axes (e.g. always start filter-free, but keep the column layout the user picked):

```svelte
<Table
  {items}
  {columns}
  persistenceConfig={{
    tableId: 'expenses',
    persistFilters: false,
    persistSearch: false
  }}
/>
```

Storage keys are namespaced by `tableId` (`urbicon_table_filters_expenses_v1`, …); pick a stable, unique `tableId` per table — two tables sharing one id will overwrite each other. A key is only written once its axis differs from the default, so a table nobody touched writes nothing at all.

**Cleared counts as state.** Restoring keys off "is a value stored", not "is the stored value non-empty" — so clearing the sort, removing every filter chip, ungrouping, dropping all summaries or deselecting everything is persisted as such and survives the reload. Where an axis also has an `initial*` seed (`initialSort`, `initialFilters`, `initialGroupBy`, `initialSummaryConfigs`, `initialSelectedIds`), the stored value wins — the seed only fills an axis storage has nothing for. Disable that axis' persistence if the seed should win on every visit.

**Precedence is per axis: `query` → storage → `initial*` seed.** A controlled axis is by default neither restored from storage nor written to it — while the URL carries the state, the URL *is* the state. What that does not survive is opening the page from a bare link, because nothing was stored. For a business table that is usually the wrong answer ("my filters are still there tomorrow" is expected), so `persistControlled: true` stores the controlled axes as well:

```svelte
<Table
  {items}
  {columns}
  query={sync.viewState}
  onQueryChange={sync.syncQuery}
  persistenceConfig={{ tableId: 'invoices', persistControlled: true }}
/>
```

Writes then happen on the reader's own edits only — never when a controlled value resolves — so following someone else's link stores nothing, and a bare visit later restores what the reader themselves changed. The reading order is unaffected: a URL that names an axis still outranks the stored value for that axis.

`storage: 'sessionStorage'` limits persistence to the current tab (lost on tab close). The `clearAllPersistentData` and `forceSavePersistentData` methods on the table context let you reset or flush state imperatively; after `clearAllPersistentData` the axes are back to "nothing stored", so the seeds apply again on the next load.

## Subcomponent Styling

Every structural subcomponent (`EmptyState`, `ErrorState`, `LoadingState`, `GroupedRow`, `SummaryRow`, `MobileCard`, `SmartFilterBar`) consumes `TableStyleContext` — pass `slotClasses` at the `<Table>` root and it reaches the leaves.

```svelte
<Table
  {items}
  {columns}
  unstyled
  slotClasses={{
    container: 'rounded-2xl bg-surface-elevated',
    headerCell: 'text-text-tertiary uppercase tracking-wider text-xs',
    row: 'hover:bg-surface-hover'
  }}
/>
```

**`cell` and `headerCell` are the data-column slots.** They reach the `<td>`/`<th>` that render column content — in flat rows, grouped rows and the header alike. The table's own structural cells (selection checkbox, expand chevron, group-indentation spacer, group toggle) are chrome with fixed widths and deliberately stay outside both slots, so a padding or alignment override cannot deform the controls it was never aimed at. Reach those through `row`/`headerRow`, or take over completely with `unstyled`.

## i18n

Namespace: `table.*`. Resolve typed keys via the context hook `useTableI18n` — call it during component init and alias the result `tt`:

```svelte
<script>
  import { useTableI18n } from '@urbicon-ui/table';
  const tt = useTableI18n();
</script>

<span>{tt('data.loading')}</span>
<!-- "Loading data…" -->
<span>{tt('pagination.showing', { start: 1, end: 10, total: 100 })}</span>
```

Resolves against the request-scoped locale from `<I18nProvider>` (or the base locale `en` without one). Add a locale: register a new package via `@urbicon-ui/i18n`'s `createPackageI18n`, or extend the existing bundles in `src/lib/translations/`.

## Known Limitations

Deliberate trade-offs of the zero-dependency implementation — documented so they surprise no one:

- **Virtualization assumes fixed row heights.** The row height derives from the `size` prop (`sm`/`md`/`lg` via `ROW_HEIGHTS`); rows with dynamic height (wrapping text, expanded content) are not supported in virtualized mode.
- **Virtualization and grouping are mutually exclusive — virtualization wins.** Grouped virtualization is not implemented, so a `virtualized` table suppresses the grouping affordances (header menu, toolbar grouping menu) and ignores every other route into grouping — `initialGroupBy`, a controlled `groupByKey`, a persisted key — with a dev warning. (Until v6.41 grouping won instead, which silently deactivated virtualization and rendered the full item set — the very failure `virtualized` exists to prevent.) For large datasets, group server-side via remote mode or keep grouped views paginated instead of virtualized.
- **Virtualized mode bypasses pagination.** All sorted items live in one scrollable container; only ~viewport rows are in the DOM.
- **Live updates ship no transport.** `enableLiveUpdates` is a push-model pending-buffer — the app supplies WebSocket/SSE/polling and calls `pushInsert`/`pushUpdate`/`pushDelete`.

## Behavior contracts

Semantics worth stating outright, since they differ from some other table libraries:

- **Select-all covers every filtered row, not just the current page.** In `selectionMode="multi"`, the header checkbox toggles all rows that pass the active search/filters — across every page — and its indeterminate state reflects that same set. (TanStack/shadcn default to a page-scoped select-all.) Selection is keyed by `item.id`, falling back to the row index, so it survives paging and re-sorting.
- **`greaterThan`/`lessThan` compare numbers first, dates second.** When both the cell value and the filter value convert via `Number()`, they are compared as numbers; otherwise both sides are read as instants (`Date` objects, epoch milliseconds, ISO-8601 strings) — every other string format never matches, so a malformed or empty value filters everything out instead of matching everything. For a bare calendar date (`YYYY-MM-DD`, what a `dataType: 'date'` column's filter input emits) "after"/"before" compare on **UTC day boundaries**, so a row stamped `2021-03-15T09:00Z` matches neither `after 2021-03-15` nor `before 2021-03-15`; a filter value with a time of day compares instants strictly. A `Date` built from local parts (`new Date(2021, 2, 15)`) can land on the neighbouring UTC day — store ISO strings or UTC-constructed dates for day-exact filtering.
- **A controlled `searchTerm` wins over `persistSearch`.** When you pass `searchTerm`, it drives the search state and takes precedence over a value restored from `persistenceConfig.persistSearch`. Leave it `undefined` to let persistence (or the built-in filter bar) own the term; an empty string is a valid controlled value that clears the search. This is the single-axis case of the general rule above — `query` applies the same precedence to sort, page, page size, filters and grouping, by field presence.

## Development

```bash
bun --filter='@urbicon-ui/table' run dev     # svelte-package watch
bun --filter='@urbicon-ui/table' run build   # svelte-package
bun --filter='@urbicon-ui/table' run check   # svelte-check
bunx --bun vitest run                        # unit tests (from package root)
```

## Related

- [docs/STICKY-PINNING.md](./docs/STICKY-PINNING.md) — scroll models: page-relative sticky pinning + contained scroll (`fit="viewport"`), API, CSS vars. Ships in this package.
- [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) — remote-data architecture (monorepo only)
