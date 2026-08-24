<script lang="ts">
  import CustomCell from '$lib/cells/CustomCell.svelte';
  import NumberCell from '$lib/cells/NumberCell.svelte';
  import { TableColumns } from '$lib/factories/TableColumns';
  import type { Column } from '$lib/types/tableTypes';
  import Table from '../table/Table.svelte';

  /**
   * Every way a body cell can be filled, in one table, plus a summary row over
   * the same columns — the things #256 has to leave on one edge.
   *
   * The paths cannot be reached from a leaf component: `TableCell` picks
   * between them, and the `<td>` that carries the inset is written by
   * `TableRow`, so only a mounted table shows what a reader actually sees.
   *
   * The typed columns go through the **public factory** rather than a hand-made
   * column: `TableColumns.actions()` is what the docs demos call, and its
   * component wraps `actionCellVariants` in markup of its own — a wrapper no
   * variant-config assertion can see, and the one that was still a step out
   * after the first pass at #256.
   *
   * `probe` is the positive control for the measurement, not a supported
   * pattern: a snippet that deliberately wraps its content in `px-2`. Its inset
   * must come back one step LARGER than everything else, or the walk is not
   * descending into wrappers at all and every other assertion here is measuring
   * the `<td>` alone.
   *
   * `__fixtures__/` is excluded from the published tarball (package.json
   * `files`) and is not collected as a test (no `.test` in the name).
   */
  type Row = {
    id: number;
    name: string;
    amount: number;
    note: string;
    user: string;
    userPainted: string;
    status: string;
    code: string;
    created: Date;
    url: string;
  };

  let {
    size = 'md',
    selectionMode = 'none'
  }: { size?: 'sm' | 'md' | 'lg'; selectionMode?: 'none' | 'single' | 'multi' } = $props();

  const items: Row[] = [
    {
      id: 1,
      name: 'Ada',
      amount: 100,
      note: 'first',
      user: 'Ada Lovelace',
      userPainted: 'Ada Lovelace',
      status: 'active',
      code: 'AB-1',
      created: new Date('2026-03-12T10:30:00Z'),
      url: 'https://example.com'
    }
  ];

  const noop = () => {};
</script>

{#snippet noteCell(_item: Row, value: unknown)}
  <span data-testid="snippet-content">{String(value)}</span>
{/snippet}

{#snippet probeCell(_item: Row, value: unknown)}
  <div class="px-2">
    <span data-testid="probe-content">{String(value)}</span>
  </div>
{/snippet}

<Table
  {items}
  columns={[
    { accessor: 'name', title: 'Name' },
    {
      accessor: 'amount',
      title: 'Amount',
      component: NumberCell,
      componentProps: () => ({ valueKey: 'amount' })
    },
    { accessor: 'note', title: 'Note', cell: noteCell },
    {
      id: 'custom',
      title: 'Custom',
      component: CustomCell,
      componentProps: () => ({ content: () => 'custom' })
    },
    // The two wrappers that PAINT — they carry the bleed pair
    // (`TABLE_DIMENSIONS.bleed.cellX`), so their hover ground covers the whole
    // cell. Both render twice: once into a `<td>`, where the bleed applies, and
    // once into a `MobileCard` grid cell, where it must not.
    {
      id: 'customPainted',
      title: 'Painted',
      component: CustomCell,
      componentProps: () => ({ content: () => 'painted', onClick: noop, testId: 'painted-cell' })
    },
    TableColumns.userAvatar<Row>('userPainted', 'Painted user', { clickable: true }),
    TableColumns.actions<Row>('Actions', { onView: noop, onEdit: noop, onDelete: noop }),
    // The rest of the typed roster, each through its own factory. None of them
    // wraps its variant container in extra markup today — this is what keeps
    // that true, one mounted cell per component rather than a source scan.
    TableColumns.userAvatar<Row>('user', 'User'),
    TableColumns.status<Row>('status', 'Status'),
    TableColumns.copy<Row>('code', 'Code'),
    TableColumns.date<Row>('created', 'Created'),
    TableColumns.link<Row>('url', 'Link'),
    { id: 'probe', title: 'Probe', cell: probeCell }
  ] as Column<Row>[]}
  prefs={{ defaults: { summaries: [{ column: 'amount', type: 'sum' }] } }}
  {size}
  {selectionMode}
  mobileCardDetails="expanded"
  ariaLabel="Cell inset table"
/>

<!--
  Both layouts render at once — CSS decides which is shown — so the card's copy
  of every cell hangs in the same tree as the row's, and the bleed's `td &` gate
  can be measured on both sides of one mount. `mobileCardDetails="expanded"` is
  what puts the detail columns in the DOM at all: collapsed, a card renders only
  its title and subtitle, and the painting wrappers would never appear.
-->
