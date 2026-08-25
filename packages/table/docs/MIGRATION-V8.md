# Migrating the Table to v8

v8 replaces eleven view-state props and two ownership mechanisms with **one object you
own**. Everything that decides *which rows a reader is looking at* — search, sort, page,
page size, filters, grouping — lives in a `TableView` you construct, under one name scheme,
fully resolved against its defaults. Where those axes live (the URL, web storage, nowhere)
is decided by *bindings you apply to the object*, not by props of the table.

Nothing about columns, cells, selection, virtualization, styling or snippets changed.

## Already on 8.0?

v9 tightens four things v8 shipped with, and deletes two CSS files that never did anything.
All the API changes are quick, and TypeScript names every call site that has to move. In
plain JavaScript there is no compiler to do that, so the two changes that alter a *shape* —
the dropped array arm and the required `processing` — throw on the first render with a
message that names them. The two renames cannot: a `{ items, totalItems }` your query still
returns simply leaves `total` undefined, and the pager reads "1 / NaN". Grep for
`totalItems` before you run it.

**`source` is always an object.** The bare-array arm is gone: it resolved into exactly the
same thing as `{ items }`, so "how do I pass rows?" had three correct answers and no rule
for choosing.

```svelte
<Table {columns} source={rows} />           <!-- 8.0 -->
<Table {columns} source={{ processing: 'client', items: rows }} /> <!-- v9 — or items={rows} -->
```

The rule that remains: `items` for rows and nothing else, `source` for rows plus how they
arrive (loading, error, a server total, a fetch function).

**The query speaks the view's vocabulary.** v8.0 shipped `TableQuery` unchanged from v7, so
the same six axes had two spellings depending on which side of `source.query` you stood on —
and the row count was `total` going in, `totalItems` coming out. There is one vocabulary now:

| 8.0 | v9 |
| --- | --- |
| `q.searchTerm` | `q.search` |
| `q.itemsPerPage` | `q.pageSize` |
| `q.activeFilters` | `q.filters` |
| `q.groupByKey` | `q.groupBy` |
| `q.sortColumn` + `q.sortDirection` | `q.sort` — `{ column, direction }` or `null` |
| `return { items, totalItems }` | `return { items, total }` |

`TableQuery` is gone as a type: what `source.query` receives *is* a `TableViewSnapshot`. So
is `viewToQuery`, which had nothing left to project — `observeView(view, cb)` hands `cb`
the snapshot, and you pass it straight on:

```ts
observeView(view, (snapshot) => fetchPage(viewToQuery(snapshot))); // 8.0
observeView(view, (snapshot) => fetchPage(snapshot));              // v9
```

The one axis that changed shape rather than name is `sort`. `sortColumn: ''` was a sentinel
for "unsorted" that left `sortDirection` holding a direction for no column; `sort: null`
cannot express that at all. Where you wrote `if (q.sortColumn)`, write `if (q.sort)`.

In `@urbicon-ui/sveltekit-utils` the `./table-query` subpath is gone with the vocabulary it
served. Its codec was the same URL scheme under the old spellings, so it now lives in
`./table-view` (also exported from the package root):

| 8.0 | v9 |
| --- | --- |
| `searchParamsToTableQuery` · `searchParamsToViewQuery` | `searchParamsToViewSnapshot` |
| `tableQueryToSearchParams` | `viewSnapshotToSearchParams` |
| `applyTableQueryToSearchParams` | `applyViewToSearchParams` (axis-scoped) |
| `viewSnapshotToTableQuery` | gone — it was the identity |
| `TableQueryParams` | `TableViewSnapshot` |
| `TableQueryFilter` · `TABLE_QUERY_FILTER_OPERATORS` | `TableViewFilter` · `TABLE_VIEW_FILTER_OPERATORS` |
| `TableQuerySortDirection` · `TableQueryFilterOperator` | `TableViewSort['direction']` · `TableViewFilterOperator` |
| `TableQueryDefaults` · `TableQueryUrlOptions` | no successor — see below |

**The options object became positional parameters**, so this is not a pure rename:

```ts
tableQueryToSearchParams(q, { defaults, prefix });                  // 8.0
viewSnapshotToSearchParams(snapshot, defaults, axes, prefix);       // v9
```

`defaults` is required now rather than optional, and it is a full snapshot rather than the
partial `TableQueryDefaults` — which is what lets a default *filter set* participate in
elision at all, the one axis the old baseline had no field for. `axes` is new: pass a subset
to restrict the output to one binding's axes, or omit it for all six. TypeScript flags every
call site, but the shape of the fix is worth knowing before you start.

The write-strict validation the old serializer performed inline is now
`assertValidViewSnapshot`, called by `applyViewToSearchParams` and deliberately not by
`viewSnapshotToSearchParams` — that one runs inside the URL binding on every view change,
where a throw over a `view.page = 0` would take the table down rather than the URL. If you
used `tableQueryToSearchParams` to build a backend query string and relied on it rejecting a
bad page or an unknown operator, call `assertValidViewSnapshot` yourself first: nothing in
the type system will point out that the guard left.

**`kind: 'server'` became `processing`, required on every variant.** The tag decides who
sorts, filters, searches and pages — the table or your backend — and `kind` said none of
that. It read as a statement about where the data comes from, which is a different question
and one the tag never answered: the client variant fetches from a server too.

```svelte
<Table {columns} source={{ items: rows }} />                              <!-- 8.0 -->
<Table {columns} source={{ processing: 'client', items: rows }} />        <!-- v9 -->

<Table {columns} source={{ kind: 'server', items, total }} />             <!-- 8.0 -->
<Table {columns} source={{ processing: 'server', items, total }} />       <!-- v9 -->

<Table {columns} source={{ query: loadUsers }} />                         <!-- 8.0 -->
<Table {columns} source={{ processing: 'server', query: loadUsers }} />   <!-- v9 -->
```

`items={rows}` is untouched — it is still the shorthand for a client source, and still the
right prop when rows are all you have to say.

Required is the point, not the spelling. In 8.0 the tag sat on one variant out of three, so
the union leaned on `?: never` fields to keep a tagless server config — `{ items, total }` —
from matching the *client* variant structurally. That worked: it was a compile error in 8.0,
and it still is. What the required tag adds is a second, independent line under the same
shape, and one thing the `never` fields could never provide — a consumer writing plain
JavaScript now gets a named error at the first render instead of a table that quietly sorts
a page of server-paged rows in the browser. Which of the two lines carries which case is
measured probe by probe in `source.typecheck.ts`.

**The context stopped mirroring the view axes.** `TableContext.state` carried a second
spelling of all six — `state.searchTerm`, `state.currentPage`, `state.sortColumn` +
`state.sortDirection`, `state.activeFilters`, `state.itemsPerPage`, `state.groupByKey` — as
getters onto the very same view. `context.view` is the one address now:

| 8.0 | v9 |
| --- | --- |
| `ctx.state.searchTerm` | `ctx.view.search` |
| `ctx.state.currentPage` | `ctx.view.page` |
| `ctx.state.itemsPerPage` | `ctx.view.pageSize` |
| `ctx.state.activeFilters` | `ctx.view.filters` |
| `ctx.state.sortColumn` + `.sortDirection` | `ctx.view.sort` — `{ column, direction }` or `null` |
| `ctx.state.groupByKey` | **`ctx.effectiveGroupBy`** — the drop-in; `ctx.view.groupBy` is the *requested* one, see below |
| `ctx.totalItems` | `ctx.total` |
| `ctx.setSearchTerm(t)` | `ctx.setSearch(t)` |
| `ctx.setItemsPerPage(n)` | `ctx.setPageSize(n)` |
| `ctx.setGroupByKey(k)` | `ctx.setGroupBy(k)` |
| `ctx.setSort(column, direction)` | `ctx.setSort({ column, direction })`, or `setSort(null)` |
| `ctx.state.serverTotalItems` | `ctx.state.serverTotal` |

Everything else on `state` is untouched — `items`, `columns`, `loading`, `error`,
`selectedIds`, the expansion, grouping and summary chrome, the prop-driven switches. Those
are the table's own; the axes never were.

**`ctx.effectiveGroupBy` is new, and it is not a rename.** `state.groupByKey` was the only
one of the six that did not simply mirror the view: on a virtualized table it read `null`
while `view.groupBy` named a column, because grouped virtualization is not implemented and
a key slipping through would render every row. That distinction survives under a name that
states it, next to the `effectivePage` that already draws the same one — read `view.groupBy`
for what the reader asked for, `effectiveGroupBy` for what they are looking at.

**`TableQueryResult` became `TablePage`.** With `TableQuery` gone (above) the old name was
half of a pair whose other half no longer existed. Same shape, `{ items, total }`.

**The two density theme files are gone.** `@urbicon-ui/table/style/themes/comfortable.css`
and `…/compact.css` no longer exist, and the `./style/themes/*` export with them. Delete the
`@import`; nothing replaces it, because nothing was there. Each file's whole body was seven
`@theme` custom properties — `--table-row-height`, `--table-header-height`,
`--table-cell-padding-x` / `-y`, `--filter-bar-height` / `-padding` / `-gap` — that no rule in
the shipped CSS reads, so Tailwind tree-shook them and importing either file moved no pixel.
`compact` hid it best: the 40px row it claimed is the *default* `md` row, so the import
looked like it had taken. The seven base declarations are gone from `style/table-theme.css`
too. If your own CSS referenced one, replace the reference with the literal you actually
want: their values never described the table — the base `--table-row-height` said 3.5rem
where an `md` row renders `h-10`, 40px.

Density is the `size` prop — `sm` / `md` / `lg` on `<Table>` — which moves row height, header
height and cell padding together.

## The shape of the change

```svelte
<script lang="ts">
  import { Table, createTableView, bindViewToStorage } from '@urbicon-ui/table';
  import { bindViewToUrl } from '@urbicon-ui/sveltekit-utils/url.svelte';

  const view = createTableView({
    defaults: { pageSize: 25, sort: { column: 'date', direction: 'desc' } }
  });

  bindViewToUrl(view);                           // shareable, server-visible
  bindViewToStorage(view, { key: 'invoices' });  // "yesterday's view is still there"
</script>

<Table {items} {columns} {view} prefs={{ storage: 'invoices' }} />
```

Zero-config is unchanged: `<Table {items} {columns} />` still works — the table then owns an
unbound view of its own.

## Prop-by-prop

### View state

| v7 | v8 |
| --- | --- |
| `itemsPerPage={25}` | `viewDefaults={{ pageSize: 25 }}` |
| `initialPage={2}` | `viewDefaults={{ page: 2 }}` |
| `initialSort={{ column: 'date', direction: 'desc' }}` | `viewDefaults={{ sort: { column: 'date', direction: 'desc' } }}` |
| `initialFilters={[…]}` | `viewDefaults={{ filters: […] }}` |
| `initialGroupBy="team"` | `viewDefaults={{ groupBy: 'team' }}` |
| `searchTerm={term}` + `onSearchTermChange={…}` | `view.search` — read it, write it |
| `groupByKey` (on `TableProvider`) | `view.groupBy` |
| `query={sync.viewState}` + `onQueryChange={sync.syncQuery}` | `bindViewToUrl(view)` |
| `queryDebounceMs={300}` | `bindViewToUrl(view, { debounceMs: 300 })` / `source={{ processing: 'server', query, debounceMs: 300 }}` |
| `initialSummaryConfigs={[…]}` | `prefs={{ defaults: { summaries: […] } }}` — summaries are a preference, not a view axis |

Several axes collapse into **one** `viewDefaults` object rather than several props:

```svelte
<!-- v7 --> <Table {items} {columns} itemsPerPage={5} initialSort={{ column: 'salary', direction: 'desc' }} />
<!-- v8 --> <Table {items} {columns} viewDefaults={{ pageSize: 5, sort: { column: 'salary', direction: 'desc' } }} />
```

`viewDefaults` is the shorthand for a table that owns its view; it is **mutually exclusive**
with `view` and resolved once, at construction. Pass both and it throws — a miswired view
corrupts state either way, so it is not a precedence question.

`sort` is `null` when unsorted. The v7 sentinel (an empty `sortColumn`) is gone: "unsorted"
is a value now, not a convention.

### Data source

The `mode`/`queryFn`/`loading`/`error`/`serverTotalItems` combinations became one union of
three object shapes, in which the invalid combinations are not expressible:

| v7 | v8 |
| --- | --- |
| `items={rows}` | `items={rows}` (unchanged) or `source={{ processing: 'client', items: rows }}` |
| `{items}` + `{loading}` + `{error}` in client mode | `source={{ processing: 'client', items, loading, error }}` |
| `mode="server"` + `serverTotalItems` + `{items}` + `{loading}` + `{error}` + `onQueryChange` | `source={{ processing: 'server', items, total, loading, error }}` + `observeView(view, cb)` |
| `mode="server"` + `queryFn` + `queryDebounceMs` | `source={{ processing: 'server', query, debounceMs }}` |

`processing: 'server'` is mandatory on both server sources. It hands sorting and
filtering to the server, so it has to be a decision you took, not a shape you fell into —
`{ items, total }` without the tag matches no variant at all.

The managed source (`{ query }`) owns loading and error itself, aborts superseded requests
and issues the first fetch immediately, later ones debounced. It has no `loading`/`error`
fields at all, so the v7 rule "those props are ignored when `queryFn` is set" no longer has
anything to warn about.

That variant is deliberately the short path and nothing more: the view is the only thing
that triggers a fetch, and it will stay that way. Re-running the same query (a refresh
button, polling, resync after a failed optimistic update), caching, deduplication and
invalidation after a mutation belong to a data layer — bring your own, and hand the table
its result through `processing: 'server'` with rows and a total.

### Persistence

`persistenceConfig` covered two classes of state in one prop. They are two channels now,
because they answer to different owners: **view** state belongs to the consumer and can be
shared, **preferences** belong to the table and never leave the browser.

| v7 | v8 |
| --- | --- |
| `persistenceConfig={{ tableId: 'x' }}` (view axes: sort, search, filters, group) | `bindViewToStorage(view, { key: 'x' })` |
| `persistSort` / `persistSearch` / `persistFilters` / `persistGroupByKey` | `bindViewToStorage(view, { key: 'x', axes: […] })` |
| `persistColumnVisibility` / `persistColumnOrder` / `persistSummaryConfigs` | `prefs={{ storage: 'x' }}` |
| `persistSelection: true` | `prefs={{ storage: 'x', persistSelection: true }}` |
| `storage: 'sessionStorage'` | `prefs={{ storage: { key: 'x', kind: 'sessionStorage' } }}`, and `bindViewToStorage(view, { key: 'x', storage: sessionStorage })` |
| `persistControlled: true` | gone — the combination is now just the two independent lines above |
| `debounceMs` | per binding: `bindViewToStorage(…, { debounceMs })`, `prefs={{ storage: { key, debounceMs } }}` |

`bindViewToStorage` returns two affordances v7 had no place for: `clear()` removes this
table's stored view (the "reset my saved view" button) and `flush()` writes pending changes
immediately.

Using the same key for `bindViewToStorage(view, { key: 'x' })` and `prefs={{ storage: 'x' }}`
is a naming convention, not a link — the two channels stay independent, and persisting both
the view and the preferences always takes both statements.

**If you drive an axis yourself** — the v8 equivalent of v7's controlled `searchTerm` prop is
writing `view.search` from your own state — exclude that axis from the storage binding:
`bindViewToStorage(view, { key: 'x', axes: ['sort', 'pageSize', 'filters', 'groupBy'] })`.
Your writes are field writes, which count as reader changes, so a driven axis would land in
storage like any other edit; v7 suppressed that automatically once `searchTerm` was
controlled, v8 has no way to tell your writes from the reader's.

### URL state

`createTableQueryUrlSync` is gone, and with it the `viewState`-vs-`initialQuery` choice and
the hand-maintained `defaults` copy:

```svelte
<!-- v7 -->
const sync = createTableQueryUrlSync({ defaults: { itemsPerPage: 25 } });
<Table {items} {columns} itemsPerPage={25} query={sync.viewState} onQueryChange={sync.syncQuery} />

<!-- v8 -->
const view = createTableView({ defaults: { pageSize: 25 } });
bindViewToUrl(view);
<Table {items} {columns} {view} />
```

The defaults are written once. They are the elision baseline *and* the table's starting
state, so they cannot disagree with each other.

`bindViewToUrl(view, { axes?, debounceMs?, replaceState?, prefix?, reflectExternal? })`.
Two bound tables on one page still namespace with `prefix`. The URL **format is unchanged**
for readers: existing deep links keep working.

The pure serializers are still SvelteKit-free. For the load path, use
`searchParamsToViewSnapshot` from `@urbicon-ui/sveltekit-utils/table-view`: it takes the
*same* defaults object the component hands `createTableView`, so the server cannot resolve
an absent param differently from the client.

```ts
// view-defaults.ts — imported by both the component and the load function
export const invoiceView = { pageSize: 25, sort: { column: 'date', direction: 'desc' } };

// +page.server.ts
export const load = async ({ url }) => ({
  initialResult: await fetchInvoices(searchParamsToViewSnapshot(url.searchParams, invoiceView))
});
```

What it hands back is the same shape a managed `source.query` receives, so the `load` and
the table's own fetches speak to your backend identically.

### The context surface (`onReady` / `getTableContext`)

`TableContext` is a hand-written interface now, and it is the whole contract. In v7 the
type was an alias for everything the internal store returned, so the store's wiring —
`setColumns`, `initColumnOrder`, `resetFocus`, `setServerResult`, `clearAllPersistentData`
and some sixty other members — was formally public API and every internal restructuring a
breaking change. v8 keeps the parts that were meant for consumers:

- **`state`** (what the table owns: rows, columns, load state, selection, chrome) and
  **`view`** (the six shareable axes),
- the **derived collections** — `filteredItems`, `sortedItems`, `paginatedItems`,
  `total`, `totalPages`, `effectivePage`, `effectiveGroupBy`, `selectedItems`,
  `allSelected`, `someSelected`,
- the **action families** — search (`setSearch`), filters (`addFilter`,
  `removeFilter`, `removeFiltersByColumn`, `clearAllFilters`, `hasFilterForColumn`),
  sort (`handleSort`, `setSort`), pagination (`goToPage`, `setPageSize`), grouping
  (`setGroupBy`), selection (`selectItem` … `setSelectedIds`, `isSelected`) and
  summaries (`addSummaryConfig`, `removeSummaryConfig`, `toggleSummary`,
  `setSummaryConfigs`),
- the **live-update family** — `pushInsert`/`pushUpdate`/`pushDelete`, the apply/dismiss
  methods, `liveUpdateCounts`, `hasPendingUpdates`, `isRecentlyUpdated`, `isPendingDelete`.

What no longer appears on the type, and where its job went:

| v7 context member | v8 |
| --- | --- |
| `setItems` / `setLoading` / `setError` | the `source` union: `source={{ processing: 'client', items, loading, error }}` |
| `setServerResult` / `setServerError` / `setServerLoading` | a `processing: 'server'` source, with rows or with a `query` |
| `query` / `queryKey` | `view.snapshot()`, or `observeView(view, cb)` |
| `setColumns` | the `columns` prop |
| `hideColumn` / `showColumn` / `toggleColumnVisibility` / `showAllColumns` / `hiddenColumnKeys` | the built-in visibility UI (`enableColumnVisibility`), initial state via `prefs.defaults.hiddenColumns` |
| `allColumns` | `state.allColumns` — every column you declared, hidden ones included. `state.columns` stays the visible subset, which is what the grid draws |
| `reorderColumn` / `resetColumnOrder` / `orderedColumns` / `columnOrder` / `getColumnIndex` / `initColumnOrder` | `enableColumnReorder` (drag + keyboard), initial order via `prefs.defaults.columnOrder` |
| `focusedRowIndex` / `resetFocus` / `setFocusedRow` / `moveFocus` / `isFocusedRow` | keyboard navigation is built in |
| `toggleExpand` / `isItemExpanded` | the built-in expansion chevron (`expandedRowContent`) |
| `toggleGroup` / `toggleGroupExpand` / `toggleAllGroups` | the built-in group headers |
| `setPage` | `goToPage(page)` (range-checked), or write `view.page` |
| `setGroupOrder` | the `groupOrder` prop |
| `toggleAdvancedSearch` | gone — nothing read it since the tools sheet replaced the advanced-search panel |
| `getNestedValue` / `resolveColumnId` / `resolveColumnValue` / `resolveValueById` / `findColumnById` | the standalone package exports of the same names |
| `applyPersistedState` / `clearPersisted*` / `forceSavePersistentData` | preference persistence is the table's own lifecycle; to reset a table's preferences, remove its `urbicon_table_*_<key>_v1` storage entries |
| `setTableContext()` | gone — `<Table>` (via its `TableProvider`) is what establishes the context |

The store barrel also stopped re-exporting its wiring wholesale: `createTableState`,
`attachTableContext`, `attachCellLocale`, `TablePropSources`, `TableSeedState` and
`TableViewState` were formally public in v7 (an `export *`) but never documented; they
are internal now. If you constructed table state yourself, `<Table>` plus the context
above is the supported path.

The object behind the interface is unchanged and alive — nothing about *when* you get it
(`onReady` once, `getTableContext()` inside the tree) moved. If a member you relied on is
missing from the narrow surface, that is a conversation worth having rather than a cast:
widening the interface later is additive, the cast freezes an internal.

## The one rule that replaces the precedence sections

> One view object, fully resolved against its `defaults`. Bindings declare their axes
> statically. Defaults → URL (on arrival) → storage (after hydration); at runtime only the
> URL applies, storage only writes, and an axis is stored when its last change came from the
> reader.

What follows from it:

- **A deep link beats storage** — once, at init: an axis the URL names is not seeded from
  storage.
- **The back button restores the default**, not the stored value: storage never applies
  again after init.
- **Someone else's link stores nothing**: what a binding applies never counts as your change.
- **Two bindings of the same kind on one axis throw** — that is a programming error, not a
  precedence question.
- **The server renders the linked view**: the URL is applied synchronously at init, so a
  `?sort=…&filter=…` link arrives sorted and filtered in the server HTML.

## Behaviour that deliberately changed

1. **Defaults are never written back to storage.** In v7 an `initial*` seed was synced into
   storage on first render. Now storage only ever holds what the reader changed — so after a
   deploy with different defaults, users who never touched an axis get the new default.
2. **`pageSize` is persisted; `page` never is.** v7 persisted no pagination at all. "Yesterday's
   page size is still set" is squarely what a storage binding promises; the page number is not.
3. **The v7 per-axis storage keys are abandoned.** `table_sort_*`, `table_search_*`,
   `table_filters_*` and `table_group_by_*` are orphaned; v8 writes one entry per view
   (`urbicon_table_view_<key>_v1`). Stored views do not carry over — readers start from your
   defaults once, then their own state accrues again. Preference keys
   (`table_hidden_columns_*`, `table_column_order_*`, `table_summary_configs_*`,
   `table_selection_*`) are unchanged and survive the upgrade.
4. **A direct field write does not reset the page.** `view.search = 'x'` changes only the
   search; the table's own handlers still reset to page 1 on a new search, filter or
   grouping. Write `view.page = 1` alongside if you want the reset.
5. **The storage binding drops pending writes on teardown.** No side effects after the
   component is gone; call `flush()` first if a write must land.
6. **A grouping on a `virtualized` table stays on the view, unrendered.** The table renders
   ungrouped and warns in DEV; the value keeps standing on the view and in the URL, and it
   never reaches storage unless the reader set it — so it applies again on the next load
   without `virtualized`.
7. **A direction is half of a sort value, not a field of its own.** `view.sort` is
   `{ column, direction }` or `null`, so there is no way to write a direction while nothing
   is sorted. In v7 the two lived in separate fields and a direction written while unsorted
   was picked up by the next column write; now you set both together, or `null`.
8. **Inside the URL write debounce, a foreign navigation wins.** If something else navigates
   the same path without a bound axis's param before the binding's debounced write fires —
   a link elsewhere on the page, a router redirect — the runtime rule applies: absence on a
   bound axis means the default. The pending edit is not resurrected afterwards; the last
   writer of the URL wins.

## Consumers who used `onQueryChange` without a URL

Analytics, a manual fetch, a server sync — anything that wanted to *observe* the view rather
than put it in the address bar:

```ts
import { observeView } from '@urbicon-ui/table';

observeView(view, (snapshot) => fetchPage(snapshot), { debounceMs: 300 });
```

It fires once synchronously on registration (the parity with `onQueryChange`'s initial
emission), then debounced on every structural change, and it is echo-free. The snapshot is
the same object a managed `source.query` receives — project it onto your backend's
parameter names where you build the request.

## Sharing one view across tables

Several tables may mount the same view. They read and write the same six axes, and a table
takes no claim of its own — a remounting `{#if}` child inherits the current state, and a
third table can join later.

A virtualized table renders any grouping the view carries as ungrouped — for itself only.
The value stays on the view, so an un-virtualized sibling of the same view keeps rendering
it grouped, and a grouping the reader sets later still applies everywhere else; DEV logs a
console warning on the virtualized table so the mismatch is visible while developing.

One limit is worth knowing:

- **A shared view is not a shared cache.** A managed source (`{ query }`) on both tables
  fetches once *per table* per interaction. If one fetch should serve both, run it yourself
  (`observeView` + your fetch) and hand each table a manual `processing: 'server'` source.

## Where to construct the view

Inside the component that owns it, or a request-scoped `load`. **Never in module scope**: on
the server that is state shared between requests, and DEV warns about it.
