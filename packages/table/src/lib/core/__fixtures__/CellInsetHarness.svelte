<script lang="ts">
  import NumberCell from '$lib/cells/NumberCell.svelte';
  import type { Column } from '$lib/types/tableTypes';
  import Table from '../table/Table.svelte';

  /**
   * One table holding all three body-cell render paths at once, plus a summary
   * row over the same columns — the four things #256 has to leave on one edge.
   *
   * The paths cannot be reached from a leaf component: `TableCell` picks
   * between them, and the `<td>` that carries the inset is written by
   * `TableRow`, so only a mounted table shows what a reader actually sees.
   * Same role as `TableHarness`, kept separate because its columns are the
   * subject of the assertions rather than a convenience.
   *
   * `__fixtures__/` is excluded from the published tarball (package.json
   * `files`) and is not collected as a test (no `.test` in the name).
   */
  type Row = { id: number; name: string; amount: number; note: string };

  let {
    size = 'md',
    selectionMode = 'none'
  }: { size?: 'sm' | 'md' | 'lg'; selectionMode?: 'none' | 'single' | 'multi' } = $props();

  const items: Row[] = [{ id: 1, name: 'Ada', amount: 100, note: 'first' }];
</script>

{#snippet noteCell(_item: Row, value: unknown)}
  <span data-testid="snippet-content">{String(value)}</span>
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
    { accessor: 'note', title: 'Note', cell: noteCell }
  ] as Column<Row>[]}
  prefs={{ defaults: { summaries: [{ column: 'amount', type: 'sum' }] } }}
  {size}
  {selectionMode}
  ariaLabel="Cell inset table"
/>
