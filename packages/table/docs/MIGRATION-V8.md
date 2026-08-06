# Migrating the Table to v8

v8 replaces eleven view-state props and two ownership mechanisms with **one object you
own**. Everything that decides *which rows a reader is looking at* — search, sort, page,
page size, filters, grouping — lives in a `TableView` you construct, under one name scheme,
fully resolved against its defaults. Where those axes live (the URL, web storage, nowhere)
is decided by *bindings you apply to the object*, not by props of the table.

Nothing about columns, cells, selection, virtualization, styling or snippets changed.

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
| `queryDebounceMs={300}` | `bindViewToUrl(view, { debounceMs: 300 })` / `source={{ query, debounceMs: 300 }}` |
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

The four `mode`/`queryFn`/`loading`/`error`/`serverTotalItems` combinations became one union,
in which the invalid combinations are not expressible:

| v7 | v8 |
| --- | --- |
| `items={rows}` | `items={rows}` (unchanged) or `source={rows}` |
| `{items}` + `{loading}` + `{error}` in client mode | `source={{ items, loading, error }}` |
| `mode="server"` + `serverTotalItems` + `{items}` + `{loading}` + `{error}` + `onQueryChange` | `source={{ kind: 'server', items, total, loading, error }}` + `observeView(view, cb)` |
| `mode="server"` + `queryFn` + `queryDebounceMs` | `source={{ query, debounceMs }}` |

`kind: 'server'` is mandatory on the manual server source. Server mode hands sorting and
filtering to the server, so it has to be a decision you took, not a shape you fell into —
`{ items, total }` without the tag is a type error.

The managed source (`{ query }`) owns loading and error itself, aborts superseded requests
and issues the first fetch immediately, later ones debounced. It has no `loading`/`error`
fields at all, so the v7 rule "those props are ignored when `queryFn` is set" no longer has
anything to warn about.

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

The pure serializers are unchanged and still SvelteKit-free. For the load path, prefer
`searchParamsToViewQuery` from `@urbicon-ui/sveltekit-utils/table-view`: it takes the *same*
defaults object the component hands `createTableView`, so the server cannot resolve an
absent param differently from the client.

```ts
// view-defaults.ts — imported by both the component and the load function
export const invoiceView = { pageSize: 25, sort: { column: 'date', direction: 'desc' } };

// +page.server.ts
export const load = async ({ url }) => ({
  initialResult: await fetchInvoices(searchParamsToViewQuery(url.searchParams, invoiceView))
});
```

`searchParamsToTableQuery` in `/table-query` still works and still takes its baseline in the
wire vocabulary (`itemsPerPage`, `sortColumn`/`sortDirection`, `groupByKey`) — but it has no
field for a default filter set, which is why the view-vocabulary function exists.

### The context surface (`onReady` / `getTableContext`)

`TableContext` is a hand-written interface now, and it is the whole contract. In v7 the
type was an alias for everything the internal store returned, so the store's wiring —
`setColumns`, `initColumnOrder`, `resetFocus`, `setServerResult`, `clearAllPersistentData`
and some sixty other members — was formally public API and every internal restructuring a
breaking change. v8 keeps the parts that were meant for consumers:

- **`state`** (the reactive read surface) and **`view`** (the six shareable axes),
- the **derived collections** — `filteredItems`, `sortedItems`, `paginatedItems`,
  `totalItems`, `totalPages`, `effectivePage`, `selectedItems`, `allSelected`,
  `someSelected`,
- the **action families** — search (`setSearchTerm`), filters (`addFilter`,
  `removeFilter`, `removeFiltersByColumn`, `clearAllFilters`, `hasFilterForColumn`),
  sort (`handleSort`, `setSort`), pagination (`goToPage`, `setItemsPerPage`), grouping
  (`setGroupByKey`), selection (`selectItem` … `setSelectedIds`, `isSelected`) and
  summaries (`addSummaryConfig`, `removeSummaryConfig`, `toggleSummary`,
  `setSummaryConfigs`),
- the **live-update family** — `pushInsert`/`pushUpdate`/`pushDelete`, the apply/dismiss
  methods, `liveUpdateCounts`, `hasPendingUpdates`, `isRecentlyUpdated`, `isPendingDelete`.

What no longer appears on the type, and where its job went:

| v7 context member | v8 |
| --- | --- |
| `setItems` / `setLoading` / `setError` | the `source` union: `source={{ items, loading, error }}` |
| `setServerResult` / `setServerError` / `setServerLoading` | a `kind: 'server'` source, or the managed `{ query }` source |
| `query` / `queryKey` | `viewToQuery(view.snapshot())`, or `observeView(view, cb)` |
| `setColumns` | the `columns` prop |
| `hideColumn` / `showColumn` / `toggleColumnVisibility` / `showAllColumns` / `allColumns` / `hiddenColumnKeys` | the built-in visibility UI (`enableColumnVisibility`), initial state via `prefs.defaults.hiddenColumns` |
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
6. **A grouping discarded by `virtualized` is a system decision.** It cleans the URL but never
   reaches storage as your wish, so the stored grouping applies again on the next load
   without `virtualized`.
7. **A `sortDirection` write on an unsorted view is a no-op.** On the context surface,
   `state.sortDirection = 'desc'` only re-directions an existing sort: direction is half of
   the sort *value* (`view.sort = { column, direction }`), and unsorted is `null`, so there
   is no direction to flip. In v7 the two lived in separate fields and a direction written
   while unsorted was picked up by the next column write; in v8, set the column and the
   direction together.
8. **Inside the URL write debounce, a foreign navigation wins.** If something else navigates
   the same path without a bound axis's param before the binding's debounced write fires —
   a link elsewhere on the page, a router redirect — the runtime rule applies: absence on a
   bound axis means the default. The pending edit is not resurrected afterwards; the last
   writer of the URL wins.

## Consumers who used `onQueryChange` without a URL

Analytics, a manual fetch, a server sync — anything that wanted to *observe* the view rather
than put it in the address bar:

```ts
import { observeView, viewToQuery } from '@urbicon-ui/table';

observeView(view, (snapshot) => fetchPage(viewToQuery(snapshot)), { debounceMs: 300 });
```

It fires once synchronously on registration (the parity with `onQueryChange`'s initial
emission), then debounced on every structural change, and it is echo-free.
`viewToQuery` projects a snapshot into the `TableQuery` shape your backend already speaks —
that type and its field names (`itemsPerPage`, `sortColumn`, `sortDirection`, `searchTerm`,
`activeFilters`, `groupByKey`) are unchanged, because they are the server contract, not the
view vocabulary.

## Sharing one view across tables

Several tables may mount the same view. They read and write the same six axes, and a table
takes no claim of its own — a remounting `{#if}` child inherits the current state, and a
third table can join later. Two limits are worth knowing:

- **Give a virtualized table its own view.** A virtualized table discards grouping as a
  system decision, and on a shared view that discard is not scoped to the table that made
  it: an un-virtualized sibling loses a grouping it could perfectly well render, and a
  grouping the reader sets later is taken back in the same flush.
- **A shared view is not a shared cache.** A managed source (`{ query }`) on both tables
  fetches once *per table* per interaction. If one fetch should serve both, run it yourself
  (`observeView` + your fetch) and hand each table a manual `kind: 'server'` source.

## Where to construct the view

Inside the component that owns it, or a request-scoped `load`. **Never in module scope**: on
the server that is state shared between requests, and DEV warns about it.
