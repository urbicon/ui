<script lang="ts">
  // E2E fixture for the Table core flows (e2e/table-core.spec.ts): sorting, search
  // filtering, virtualization, grouping, row selection, column reorder, and remote
  // (server-mode) data. Data is fully deterministic — index-derived names, cycling
  // categories, and a (i * 37) % 101 score whose order deliberately differs from
  // insertion order so a sort visibly reorders rows. No Math.random anywhere.
  import { Table, type Column, type TableQuery, type TableQueryResult } from '@urbicon-ui/table';

  type Row = { id: number; name: string; category: string; score: number };

  const CATEGORIES = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];

  function makeRows(count: number): Row[] {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      name: `Item ${String(i).padStart(4, '0')}`,
      category: CATEGORIES[i % CATEGORIES.length],
      score: (i * 37) % 101
    }));
  }

  const standardRows = makeRows(57);
  const virtualRows = makeRows(2000);
  const selectionRows = makeRows(6);
  const reorderRows = makeRows(5);

  const columns: Column<Row>[] = [
    { accessor: 'name', title: 'Name', sortable: true },
    { accessor: 'category', title: 'Category', sortable: true },
    { accessor: 'score', title: 'Score', sortable: true }
  ];

  // Grouping fixture: six rows across three regions with distinct counts
  // (north 3, south 2, east 1), interleaved in insertion order so grouping
  // visibly reorders them. groupOrder is deliberately NOT the natural / insertion
  // order, so the spec can prove the display sequence follows groupOrder.
  type GroupRow = { id: number; name: string; region: string; score: number };
  const groupRows: GroupRow[] = [
    { id: 1, name: 'Row 1', region: 'north', score: 10 },
    { id: 2, name: 'Row 2', region: 'south', score: 20 },
    { id: 3, name: 'Row 3', region: 'east', score: 30 },
    { id: 4, name: 'Row 4', region: 'north', score: 40 },
    { id: 5, name: 'Row 5', region: 'south', score: 50 },
    { id: 6, name: 'Row 6', region: 'north', score: 60 }
  ];
  const groupColumns: Column<GroupRow>[] = [
    { accessor: 'name', title: 'Name', sortable: true },
    { accessor: 'region', title: 'Region', sortable: true, groupable: true },
    { accessor: 'score', title: 'Score', sortable: true }
  ];
  const groupOrder = ['east', 'north', 'south'];

  // Multi-select fixture: onSelectionChange feeds a visible count so the spec can
  // assert the selected set alongside aria-selected / checkbox state.
  let selectedCount = $state(0);

  // Master/detail fixture: the clicked row is what `activeRowId` reflects, so the
  // spec can prove the mark follows the click without any selection being made.
  let shownRow = $state<Row | null>(null);

  // Remote (server-mode) fixture: a deterministic in-memory "backend". queryFn
  // applies search / sort / paging to a fixed 40-row set after an artificial
  // latency, and increments a request counter surfaced in the DOM — so the spec
  // can assert that a search or sort interaction issues a fresh request and the
  // table renders the new result. queryFn never throws (an abort surfaces via the
  // AbortSignal the table passes; a resolved-but-superseded result is ignored by
  // the table itself), keeping the page free of uncaught errors.
  const remoteData = makeRows(40);
  const REMOTE_LATENCY_MS = 180;
  let requestCount = $state(0);
  let remoteTotal = $state(0);

  async function remoteQuery(query: TableQuery): Promise<TableQueryResult> {
    requestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, REMOTE_LATENCY_MS));

    const term = (query.searchTerm ?? '').trim().toLowerCase();
    let rows = term
      ? remoteData.filter(
          (row) =>
            row.name.toLowerCase().includes(term) || row.category.toLowerCase().includes(term)
        )
      : [...remoteData];

    if (query.sortColumn) {
      const key = query.sortColumn as keyof Row;
      const dir = query.sortDirection === 'desc' ? -1 : 1;
      rows = [...rows].sort((a, b) => {
        if (a[key] < b[key]) return -1 * dir;
        if (a[key] > b[key]) return 1 * dir;
        return 0;
      });
    }

    remoteTotal = rows.length;

    const perPage = query.itemsPerPage || 10;
    const start = (Math.max(1, query.page) - 1) * perPage;
    return { items: rows.slice(start, start + perPage), totalItems: rows.length };
  }
</script>

<svelte:head>
  <title>Table Test Fixtures</title>
</svelte:head>

<div class="bg-surface-base min-h-screen p-8" data-testid="table-fixtures">
  <h1 class="text-text-primary mb-6 text-xl font-bold">Table fixtures</h1>

  <!-- Standard client-mode table: pagination + smart filter + sortable headers.
       Short search debounce keeps the spec fast without racing the filter. -->
  <section data-testid="table-standard" class="mb-16">
    <h2 class="text-text-primary mb-4 text-lg font-semibold">Standard (57 rows)</h2>
    <Table
      items={standardRows}
      {columns}
      itemsPerPage={10}
      searchDebounceMs={50}
      ariaLabel="Standard fixture table"
    />
  </section>

  <!-- Virtualized table: 2000 rows, bounded scroll container, no toolbar. The spec
       asserts only a DOM subset is rendered and that scrolling swaps the window. -->
  <section data-testid="table-virtual" class="mb-16">
    <h2 class="text-text-primary mb-4 text-lg font-semibold">Virtualized (2000 rows)</h2>
    <Table
      items={virtualRows}
      {columns}
      virtualized
      virtualHeight="360px"
      enableSmartFilter={false}
      ariaLabel="Virtualized fixture table"
    />
  </section>

  <!-- Grouped table: rows bucketed by region, display order pinned by groupOrder.
       The spec asserts group headers appear in groupOrder and every member row
       sits under the header of its own region. -->
  <section data-testid="table-grouped" class="mb-16">
    <h2 class="text-text-primary mb-4 text-lg font-semibold">Grouped (by region)</h2>
    <Table
      items={groupRows}
      columns={groupColumns}
      initialGroupBy="region"
      {groupOrder}
      itemsPerPage={50}
      enableSmartFilter={false}
      ariaLabel="Grouped fixture table"
    />
  </section>

  <!-- Grouped + interactive: same grouping, but selectable, so rows join the
       roving-tabindex sequence. The grouped table above is deliberately inert
       (no selection/expand/onRowClick), which is why it never exercised the
       keyboard path — grouped rows carried no data-row-index at all until
       2026-07-25. -->
  <section data-testid="table-grouped-keyboard" class="mb-16">
    <h2 class="text-text-primary mb-4 text-lg font-semibold">Grouped + keyboard</h2>
    <Table
      items={groupRows}
      columns={groupColumns}
      initialGroupBy="region"
      {groupOrder}
      selectionMode="multi"
      itemsPerPage={50}
      enableSmartFilter={false}
      ariaLabel="Grouped keyboard fixture table"
    />
  </section>

  <!-- Multi-select table: checkbox selection + select-all header. onSelectionChange
       drives the visible count the spec asserts against. -->
  <section data-testid="table-selection" class="mb-16">
    <h2 class="text-text-primary mb-4 text-lg font-semibold">Selection (multi)</h2>
    <p class="text-text-secondary mb-4 text-sm">
      Selected: <span data-testid="selection-count">{selectedCount}</span>
    </p>
    <Table
      items={selectionRows}
      {columns}
      selectionMode="multi"
      onSelectionChange={(items) => (selectedCount = items.length)}
      enableSmartFilter={false}
      itemsPerPage={10}
      ariaLabel="Selection fixture table"
    />
  </section>

  <!-- Master/detail: `activeRowId` marks the row being shown without switching on
       the selection column. The rows start at id 0 on purpose — an `activeRowId`
       guard written as a truthy check would skip exactly that row. -->
  <section data-testid="table-active-row" class="mb-16">
    <h2 class="text-text-primary mb-4 text-lg font-semibold">Active row (master/detail)</h2>
    <p class="text-text-secondary mb-4 text-sm">
      Shown: <span data-testid="active-row-name">{shownRow?.name ?? 'none'}</span>
    </p>
    <Table
      items={selectionRows}
      {columns}
      activeRowId={shownRow?.id ?? null}
      onRowClick={(row) => (shownRow = row as Row)}
      enableSmartFilter={false}
      itemsPerPage={10}
      ariaLabel="Active row fixture table"
    />
  </section>

  <!-- Column-reorder table: headers reorderable by drag or Shift+Arrow. The spec
       drives the keyboard path (drag is pointer-flaky in headless) and asserts the
       header DOM order changes. -->
  <section data-testid="table-reorder" class="mb-16">
    <h2 class="text-text-primary mb-4 text-lg font-semibold">Column reorder</h2>
    <Table
      items={reorderRows}
      {columns}
      enableColumnReorder
      enableSmartFilter={false}
      itemsPerPage={10}
      ariaLabel="Reorder fixture table"
    />
  </section>

  <!-- Remote (server mode) table: queryFn is a deterministic mock backend with
       latency. The spec asserts a search / sort interaction fires a new request
       (visible counter) and the table renders the fresh result. -->
  <section data-testid="table-remote">
    <h2 class="text-text-primary mb-4 text-lg font-semibold">Remote (server mode)</h2>
    <p class="text-text-secondary mb-4 text-sm">
      Requests: <span data-testid="remote-request-count">{requestCount}</span> · Total:
      <span data-testid="remote-total">{remoteTotal}</span>
    </p>
    <Table
      items={[] as Row[]}
      {columns}
      mode="server"
      queryFn={remoteQuery}
      queryDebounceMs={50}
      searchDebounceMs={50}
      itemsPerPage={10}
      ariaLabel="Remote fixture table"
    />
  </section>
</div>
