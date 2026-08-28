<script lang="ts">
  import { formatCellValue, resolveColumnId, resolveColumnValue } from '../utils';
  import { customCellVariants } from '$lib/variants';
  import { getCellLocale, getTableContext } from '$lib/stores/TableStore.svelte';
  import SearchHighlight from '$lib/features/SearchHighlight.svelte';
  import type { Column, TableItem } from '$lib/types/tableTypes';
  import type { Snippet } from 'svelte';

  const { state: tableState, view: tableView } = getTableContext();

  // The default `Date` branch of `formatCellValue` needs a resolved tag —
  // `undefined` there follows the runtime and diverges across the SSR
  // boundary. Resolved once per table by `<TableProvider>`, not per cell.
  const cellLocale = $derived(getCellLocale());

  export type TableCellProps = {
    item: TableItem;
    column: Column;
    size?: 'sm' | 'md' | 'lg';
    cellClass?: string;
    testIdPrefix?: string;
    colIndex?: number;
    /**
     * The ARIA role this cell declares. The row decides: `gridcell` only when
     * the table is interactive (a grid), nothing otherwise — a cell that claims
     * grid membership without a grid ancestor is what this replaces.
     */
    cellRole?: 'gridcell';
    cell?: Snippet<[item: TableItem, value: unknown, column: Column]>;
  };

  let {
    item,
    column,
    size = 'md',
    cellClass = '',
    testIdPrefix = 'cell',
    colIndex = undefined,
    cellRole = undefined,
    cell = undefined
  }: TableCellProps = $props();

  function getComponentProps(col: Column, row: TableItem) {
    const baseProps = col.componentProps ? col.componentProps(row) : {};
    const componentSize = size === 'lg' ? 'md' : size;
    return {
      ...baseProps,
      item: row,
      size: componentSize,
      align: col.align
    };
  }

  const value = $derived(resolveColumnValue(column, item));
  const titleText = $derived(value === undefined || value === null ? undefined : String(value));
  const columnId = $derived(resolveColumnId(column));

  const defaultCellStyles = $derived(
    customCellVariants({
      size,
      align: column.align ?? 'left',
      interactive: false
    })
  );

  const itemId = $derived(item.id ?? item.__index);
</script>

<td
  class="{cellClass} {column.flex ? 'flex-col' : ''}"
  style={column.width ? `width: ${column.width}; min-width: ${column.minWidth || '4rem'};` : ''}
  role={cellRole}
  aria-colindex={colIndex !== undefined ? colIndex + 1 : undefined}
  title={titleText}
  data-testid={`${testIdPrefix}-${itemId}-${columnId}`}
>
  <!-- Four ways to fill a cell, one inset. It is on the `<td>` above
       (`cellClass` → `tableRowVariants.cell` → `TABLE_DIMENSIONS.padding.cellX`)
       because a snippet renders straight into the cell with no wrapper to put
       one on — which is why the wrapper-side copies drifted to 12px / 8px / 4px
       at `md` before #256. Nothing below adds horizontal padding. -->
  {#if cell}
    {@render cell(item, value, column)}
  {:else if column.cell}
    {@render column.cell(item, value)}
  {:else if column.component}
    {@const CellComponent = column.component}
    <CellComponent {...getComponentProps(column, item)} />
  {:else if value !== undefined}
    <div class={defaultCellStyles.container()}>
      <div class={defaultCellStyles.content()}>
        <span
          class="text-text-primary block max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
        >
          {#if tableView.search}
            <SearchHighlight
              text={formatCellValue(item, column, cellLocale)}
              searchTerm={tableView.search}
            />
          {:else}
            {formatCellValue(item, column, cellLocale)}
          {/if}
        </span>
      </div>
    </div>
  {:else}
    <div class={defaultCellStyles.container()}>
      <div class={defaultCellStyles.content()}>
        <span class="text-text-tertiary">—</span>
      </div>
    </div>
  {/if}
</td>
