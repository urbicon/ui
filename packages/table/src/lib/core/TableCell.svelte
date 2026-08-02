<script lang="ts">
  import { formatCellValue, resolveColumnId, resolveColumnValue } from '../utils';
  import { customCellVariants } from '$lib/variants';
  import { getCellLocale, getTableContext } from '$lib/stores/TableStore.svelte';
  import SearchHighlight from '$lib/features/SearchHighlight.svelte';
  import type { Column, TableItem } from '$lib/types/tableTypes';
  import type { Snippet } from 'svelte';

  const { state: tableState } = getTableContext();

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
    cell?: Snippet<[item: TableItem, value: unknown, column: Column]>;
  };

  let {
    item,
    column,
    size = 'md',
    cellClass = '',
    testIdPrefix = 'cell',
    colIndex = undefined,
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
  role={colIndex !== undefined ? 'gridcell' : undefined}
  aria-colindex={colIndex !== undefined ? colIndex + 1 : undefined}
  title={titleText}
  data-testid={`${testIdPrefix}-${itemId}-${columnId}`}
>
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
          {#if tableState.searchTerm}
            <SearchHighlight
              text={formatCellValue(item, column, cellLocale)}
              searchTerm={tableState.searchTerm}
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
