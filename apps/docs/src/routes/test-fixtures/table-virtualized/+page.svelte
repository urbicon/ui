<script lang="ts">
  // E2E fixture for the virtualized layout (e2e/table-virtualized.spec.ts): one
  // `<table>` in one scroll box, its `<thead>` and `<tfoot>` pinned to the box.
  //
  // What the spec measures needs a layout engine and a scrollbar that takes
  // space: whether a classic scrollbar gutter narrows the column header and the
  // rows together or only the rows (#14), whether the pinned layers travel,
  // whether the window of rendered rows leaves a gap under the header or above
  // the summary, and whether the keyboard lands a row between the two.
  //
  // Two explicit tracks and two proportional ones, on purpose: an explicit
  // width is the same pixel count on either side of a gutter, so only the
  // proportional columns can show the drift — and the summary row is here
  // because the totals used to sit at the far end of the virtual scroll.
  import { Table, type Column } from '@urbicon-ui/table';

  type Row = { id: number; name: string; role: string; city: string; score: number };

  const ROLES = ['Reliability', 'Design', 'Data', 'Platform'];
  const CITIES = ['Berlin', 'Hamburg', 'Munich'];

  // Deterministic: index-derived, no Math.random. The score sequence is the
  // same coprime walk the table-core fixture uses, so the sum is a fixed number.
  const rows: Row[] = Array.from({ length: 2000 }, (_, i) => ({
    id: i,
    name: `Person ${String(i).padStart(4, '0')}`,
    role: ROLES[i % ROLES.length],
    city: CITIES[i % CITIES.length],
    score: (i * 37) % 101
  }));

  const columns: Column<Row>[] = [
    { accessor: 'name', title: 'Name', sortable: true, width: '14rem' },
    { accessor: 'role', title: 'Role' },
    { accessor: 'city', title: 'City' },
    { accessor: 'score', title: 'Score', dataType: 'number', width: '7rem' }
  ];
</script>

<svelte:head>
  <title>Virtualized table fixture</title>
  <style>
    /* A classic scrollbar with a 15px gutter — the Windows/Linux default — on
       the virtual scroll box. Overlay scrollbars (macOS, and headless Chromium
       under --hide-scrollbars) reserve no space, and a gutter that reserves
       none cannot drift anything; styling ::-webkit-scrollbar is what switches
       Chromium to a classic scrollbar. The spec checks the reservation before
       it measures (clientWidth === offsetWidth - 15), so a run where this rule
       stopped taking effect fails instead of measuring nothing. */
    [data-testid='virtual-scroll-container']::-webkit-scrollbar {
      width: 15px;
    }
    [data-testid='virtual-scroll-container']::-webkit-scrollbar-thumb {
      background: #888;
    }
    /* No motion: the spec compares pixels of the pinned header at two scroll
       positions, and a mid-transition frame is not a layout state. */
    * {
      transition: none !important;
      animation: none !important;
    }
  </style>
</svelte:head>

<main class="px-4 pt-4">
  <p class="text-text-secondary mb-4 text-sm" data-testid="sentinel">
    Virtualized single-table fixture
  </p>
  <div class="w-[960px]">
    <Table
      items={rows}
      {columns}
      virtualized
      virtualHeight="400px"
      selectionMode="multi"
      variant="framed"
      enableSmartFilter={false}
      ariaLabel="Virtualized fixture"
      prefs={{ defaults: { summaries: [{ column: 'score', type: 'sum' }] } }}
    />
  </div>
</main>
