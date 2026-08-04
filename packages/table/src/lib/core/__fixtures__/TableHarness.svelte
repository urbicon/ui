<script lang="ts">
  import Table from '../table/Table.svelte';
  import type { Column } from '$lib/types/tableTypes';

  /**
   * Minimal mountable/renderable table.
   *
   * Exists because `Table` is a compound: it builds its store in `TableProvider`
   * and hands it down through context, so the rendering paths cannot be reached
   * by calling `render()` on a leaf. Same role as `cells/__fixtures__/LocaleHarness.svelte`
   * for the formatting cells, and `__fixtures__/` is kept out of the published
   * tarball by package.json `files`.
   *
   * Deliberately thin: the tests set what they need through props, so a change
   * to the harness cannot quietly become part of what is being asserted.
   */
  type Row = { id: number; name: string; amount: number };

  let {
    items = [] as Row[],
    columns = [
      { accessor: 'name', title: 'Name', sortable: true },
      { accessor: 'amount', title: 'Amount' }
    ] as Column<Row>[],
    ...rest
  } = $props();
</script>

<Table {items} {columns} ariaLabel="Test table" {...rest} />
