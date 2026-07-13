<script lang="ts">
  // E2E fixture for the Table core flows (e2e/table-core.spec.ts): sorting, search
  // filtering, and virtualization. Data is fully deterministic — index-derived names,
  // cycling categories, and a (i * 37) % 101 score whose order deliberately differs
  // from insertion order so a sort visibly reorders rows. No Math.random anywhere.
  import { Table, type Column } from '@urbicon-ui/table';

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

  const columns: Column<Row>[] = [
    { accessor: 'name', title: 'Name', sortable: true },
    { accessor: 'category', title: 'Category', sortable: true },
    { accessor: 'score', title: 'Score', sortable: true }
  ];
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
  <section data-testid="table-virtual">
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
</div>
