# @urbicon-ui/table

Feature-complete data table for Svelte 5 — zero runtime dependencies, part of the Urbicon UI monorepo.

> **Maturity:** stable since `v1.0.0` (2026-05-12). `v2.0.0` (2026-05-15) refactored the Column API to separate `accessor` (value extraction) from `id` (state-targeting), eliminating the `"[object Object]"`-search trap; see `CHANGELOG.md`. All nine implementation phases are closed; 185 unit tests cover every concern.

## Installation

This package ships inside the Urbicon UI monorepo. Install from repo root:

```bash
bun install
```

Peer dependencies: `svelte` (^5), `@urbicon-ui/blocks`, `@urbicon-ui/i18n`.

## Capability Overview

| Area                | Highlights                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Data pipeline       | `$derived`-chain `items → filteredItems → sortedItems → grouped → paginatedItems`; all stages reactive                      |
| Sorting & Filtering | Column sort (asc/desc/none tri-state), smart filter bar, column-level filters, search highlighting                          |
| Selection           | Single / multi, `onSelectionChange`, indeterminate header, keyboard toggle (`Space`)                                        |
| Keyboard            | Roving tabindex, ARIA-Grid role, arrow keys, `Home`/`End`/`PageUp`/`PageDown`, Skip-Link                                    |
| Grouping            | `groupByKey`, collapsible group headers, grouped summary rows                                                               |
| Pagination          | Built-in paginator, auto-disable on grouping, mobile-friendly controls                                                      |
| Virtualization      | `computeVirtualItems` for 10k+ rows (custom, zero deps); `virtualHeight` prop; falls back to normal rendering when inactive |
| Column ordering     | Pointer-event drag-and-drop + `Shift+ArrowLeft/Right` keyboard reorder via shared `createDraggable` action                  |
| Column visibility   | Header menu + persistence API                                                                                               |
| Remote mode         | `mode: 'server'` + `queryFn` (managed fetch with `AbortSignal`) or `onQueryChange` (manual), debounced, cancellation-safe   |
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

```svelte
<Table {items} {columns} enableLiveUpdates>
  {#snippet aboveTable({ ctx })}
    <button onclick={() => ctx.pushInsert({ id: crypto.randomUUID(), name: 'New' })}>
      + row
    </button>
  {/snippet}
</Table>
```

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

Storage keys are namespaced by `tableId` (`urbicon_table_filters_expenses_v1`, …); pick a stable, unique `tableId` per table — two tables sharing one id will overwrite each other.

`storage: 'sessionStorage'` limits persistence to the current tab (lost on tab close). The `clearAllPersistentData` and `forceSavePersistentData` methods on the table context let you reset or flush state imperatively.

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

## Development

```bash
bun --filter='@urbicon-ui/table' run dev     # svelte-package watch
bun --filter='@urbicon-ui/table' run build   # svelte-package
bun --filter='@urbicon-ui/table' run check   # svelte-check
bunx --bun vitest run                        # unit tests (from package root)
```

## Related

- [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) — remote-data architecture
