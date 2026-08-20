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

| Area                | Highlights                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data pipeline       | `$derived`-chain `items → filteredItems → sortedItems → grouped → paginatedItems`; all stages reactive                                                                            |
| Sorting & Filtering | Column sort (asc/desc/none tri-state), smart filter bar, column-level filters, search highlighting, `view.search`                                                                 |
| Selection           | Single / multi, `onSelectionChange`, select-all spans all **filtered** rows, keyboard toggle (`Space`), row-click select (`rowClickSelects`, on by default in single mode)        |
| Keyboard            | Roving tabindex, ARIA-Grid role, arrow keys, `Home`/`End`/`PageUp`/`PageDown`, Skip-Link                                                                                          |
| Grouping            | `view.groupBy`, collapsible group headers, grouped summary rows                                                                                                                   |
| Pagination          | Built-in paginator, auto-disable on grouping (client processing only — a grouped server table stays paged), mobile-friendly controls                                              |
| Virtualization      | `computeVirtualItems` for 10k+ rows (custom, zero deps); `virtualHeight` prop; falls back to normal rendering when inactive                                                       |
| Column ordering     | Pointer-event drag-and-drop + `Shift+ArrowLeft/Right` keyboard reorder via shared `createDraggable` action                                                                        |
| Column visibility   | Header menu + `prefs` storage; opt out per column (`hideable: false`) or table-wide (`enableColumnVisibility={false}`)                                                            |
| Remote mode         | `source={{ processing: 'server', query }}` — managed fetch with `AbortSignal`, debounced, cancellation-safe — or `source={{ processing: 'server', items, total }}` when you drive the fetch                   |
| URL / view state    | One `view` object carries search, sort, page, page size, filters and grouping; `bindViewToUrl` applies a deep link at init — during SSR too, so a shared link renders server-side |
| Live updates        | `pushInsert/Update/Delete` pending-buffer, `LiveUpdateBanner`, auto-apply on navigation                                                                                           |
| Styling             | `unstyled`, `slotClasses`, `TableStyleContext` — every subcomponent respects the 17-slot map                                                                                      |
| Cells               | `LinkCell`, `NumberCell`, `DateCell`, `UserAvatar`, `StatusBadge`, `CustomCell`, Fill-Cell                                                                                        |
| i18n                | Package-scoped namespace `table.*`, EN + DE                                                                                                                                       |

## Quick Start

```svelte
<script lang="ts">
  import { Table, TableColumns, type Column } from '@urbicon-ui/table';

  let items = $state([
    { id: 1, name: 'Alice', role: 'Admin' },
    { id: 2, name: 'Bob', role: 'User' }
  ]);

  const columns: Column[] = [
    TableColumns.text('name', 'Name', { sortable: true }),
    TableColumns.text('role', 'Role')
  ];
</script>

<Table {items} {columns} selectionMode="multi" onSelectionChange={(rows) => console.log(rows)} />
```

### Server-mode with a managed source

```svelte
<Table
  {columns}
  source={{
    processing: 'server',
    query: async (q, { signal }) => {
      const res = await fetch(`/api/users?page=${q.page}&size=${q.pageSize}`, { signal });
      return res.json(); // { items, total }
    }
  }}
/>
```

`q` is the view itself — the same six axes (`search`, `sort`, `page`, `pageSize`, `filters`, `groupBy`) a reader manipulates, under the same names; project them onto your backend's parameters inside the function.

The table calls `query` whenever the view changes — the first fetch immediately, later ones debounced (`debounceMs`, default 300) — and aborts superseded requests through the `AbortSignal`. Loading, error and the total row count are the table's in this flow; they are not expressible on a managed source. When you drive the fetch yourself, hand in what you have instead: `source={{ processing: 'server', items, total, loading, error }}`. `processing` is required on every variant, and it is the whole decision: it names who sorts, filters, searches and pages — the table or your backend. Not where the data comes from; the client variant fetches from a server too.

### Live updates

`onReady` hands you the table context from outside the table's tree — the imperative API (`pushInsert` / `pushUpdate` / `pushDelete`, `applyAllUpdates`), the reactive `state` (rows, columns, selection, load state) and the `view` (the six axes — `ctx.view.search`, `ctx.view.sort`, …):

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

The axes that decide **which** rows are shown — search, sort, page, page size, filters, grouping — are one object you construct: the view. Bindings decorate it, so giving those axes the URL as their home is one line, and the view becomes a link: shareable, reload-proof, and visible to the server.

```svelte
<script lang="ts">
  import { Table, createTableView } from '@urbicon-ui/table';
  import { bindViewToUrl } from '@urbicon-ui/sveltekit-utils/url.svelte';

  const view = createTableView({ defaults: { pageSize: 25 } });
  bindViewToUrl(view);
</script>

<Table {items} {columns} {view} />
```

The defaults are stated once, on the view, and the binding elides against exactly them: an axis equal to its default writes no param, so a table nobody has touched leaves the URL clean. Both calls belong in the component's initialisation — a view in module scope is state shared between requests on the server.

The URL is applied **synchronously at init**, not from an `$effect`, and that is the point: effects never run during server rendering, so view state ingested in one is absent from the prerendered HTML and the client swaps the table out on hydration. Applied at init, the linked view is in the markup that arrives — which `localStorage` can never achieve, since the server cannot read it. This is what makes a sorted, filtered table server-renderable at all.

At runtime, navigations apply too, which is what makes the back button work: a URL that no longer carries `?sort` restores the view's default sort rather than the last value. Reads go the direct way — `view.sort`, `view.search` — and a write to a field is the reader's own change, which is how a binding tells it apart from a value it applied itself.

Column visibility and column order are deliberately **not** view axes. They are presentation rather than selection — nobody wants to share a link that hides columns on the other end — so they belong to `prefs`, live in web storage, and the server renders every column. A grouping arriving from a URL renders ungrouped on a `virtualized` table, exactly like every other route into grouping — the parameter itself stays in the URL.

`@urbicon-ui/sveltekit-utils` is a peer of the wiring, not of this package: the URL binding decorates the view object from outside, so nothing here imports `$app/*`. A table without SvelteKit simply leaves the binding off.

## State Persistence

Two classes of state, two homes. The six **view** axes are persisted by binding the view to web storage; the table's **preferences** — column visibility, column order, summaries and, opt-in, the selection — go through `prefs`. They take the same id and are two independent lines:

```svelte
<script lang="ts">
  import { Table, createTableView, bindViewToStorage } from '@urbicon-ui/table';

  const view = createTableView({ defaults: { pageSize: 25 } });
  bindViewToStorage(view, { key: 'expenses' });
</script>

<Table {items} {columns} {view} prefs={{ storage: 'expenses' }} />
```

`bindViewToStorage` covers five of the six axes by default (`STORAGE_DEFAULT_AXES`: search, sort, page size, filters, grouping). **`page` is never stored** — page 1 on navigation is standard UX — but `pageSize` is: "yesterday's page size is still set" is squarely what a saved view promises. Narrow the set with `axes` to always start filter- and search-free:

```typescript
bindViewToStorage(view, { key: 'expenses', axes: ['sort', 'pageSize'] });
```

`storage` (default `window.localStorage`) takes any storage object — `sessionStorage` limits persistence to the current tab — and `debounceMs` (default 500) the write delay. The returned handle carries the two imperative affordances: `clear()` drops this table's stored view (the "reset saved view" button; the live view is untouched), `flush()` writes pending changes immediately — the teardown deliberately discards them, so an edit younger than the debounce is lost on unmount unless flushed.

`prefs` names its storage key as a string or as `{ key, kind: 'sessionStorage', debounceMs }`, seeds a table nobody has touched via `prefs={{ defaults: { hiddenColumns, columnOrder, summaries } }}`, and takes `persistSelection: true` — the one axis that is opt-in, because a restored selection surprises more often than it helps. Both channels namespace their keys by the id (`urbicon_table_view_expenses_v1` for the view, `table_hidden_columns_expenses` and its siblings for the preferences); pick a stable, unique id per table — two tables sharing one overwrite each other.

**Cleared counts as state.** Restoring keys off "is a value stored", not "is the stored value non-empty" — so clearing the sort, removing every filter chip, ungrouping, dropping all summaries or deselecting everything is persisted as such and survives the reload. A stored value therefore wins over the matching `prefs.defaults` entry, including a stored *empty* one; a missing **or corrupt** entry counts as absent, so junk in storage can never block a default permanently.

**A default is never written back.** Storage holds only what the reader themselves changed: what a binding applied — the state a shared link carried, the storage seed itself — is never written. So a deploy that changes the defaults reaches everyone who has not touched that axis.

That is the whole precedence rule, and it is a sequence rather than a ranking: defaults → URL (at init) → storage (after hydration), and at runtime only the URL still applies while storage only writes. A deep link therefore beats a stored value on the axes it names, and following someone else's link stores nothing.

`clearAllPersistentData` and `forceSavePersistentData` on the table context reset or flush the **preferences**; the view's own entry is `clear()` / `flush()` on the storage binding's handle.

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

- **Virtualization assumes fixed row heights.** The table measures one rendered row and strides in that height — so a custom row height from `slotClasses.row` works, and `ROW_HEIGHTS` (derived from the `size` prop) only supplies the first frame. What is still unsupported is rows that differ *from each other*: wrapping text or expanded content in virtualized mode.
- **Virtualization and grouping are mutually exclusive — virtualization wins.** Grouped virtualization is not implemented, so a `virtualized` table suppresses the grouping affordances (header menu, toolbar grouping menu) and renders ungrouped no matter which route the grouping arrives by — the view's defaults, a URL, storage — with a dev warning. The value itself is left standing: the URL keeps its parameter, an un-virtualized table reading the same view still groups, and storage only ever holds what the reader chose — so the grouping applies again on the next load without `virtualized`. (Until v6.41 grouping won instead, which silently deactivated virtualization and rendered the full item set — the very failure `virtualized` exists to prevent.) For large datasets, group server-side via remote mode or keep grouped views paginated instead of virtualized.
- **Virtualized mode bypasses pagination.** All sorted items live in one scrollable container; only ~viewport rows are in the DOM.
- **Live updates ship no transport.** `enableLiveUpdates` is a push-model pending-buffer — the app supplies WebSocket/SSE/polling and calls `pushInsert`/`pushUpdate`/`pushDelete`.

## Behavior contracts

Semantics worth stating outright, since they differ from some other table libraries:

- **Select-all covers every filtered row, not just the current page.** In `selectionMode="multi"`, the header checkbox toggles all rows that pass the active search/filters — across every page — and its indeterminate state reflects that same set. (TanStack/shadcn default to a page-scoped select-all.) Selection is keyed by `item.id`, falling back to the row index, so it survives paging and re-sorting.
- **`greaterThan`/`lessThan` compare numbers first, dates second.** When both the cell value and the filter value convert via `Number()`, they are compared as numbers; otherwise both sides are read as instants (`Date` objects, epoch milliseconds, ISO-8601 strings) — every other string format never matches, so a malformed or empty value filters everything out instead of matching everything. For a bare calendar date (`YYYY-MM-DD`, what a `dataType: 'date'` column's filter input emits) "after"/"before" compare on **UTC day boundaries**, so a row stamped `2021-03-15T09:00Z` matches neither `after 2021-03-15` nor `before 2021-03-15`; a filter value with a time of day compares instants strictly. A `Date` built from local parts (`new Date(2021, 2, 15)`) can land on the neighbouring UTC day — store ISO strings or UTC-constructed dates for day-exact filtering.

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
