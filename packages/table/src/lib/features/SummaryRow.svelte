<script lang="ts">
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import { resolveColumnId } from '$lib/utils';
  import { summaryRowVariants } from '$lib/variants';
  import { getTableStyleConfig, resolveSlotClass } from '$lib/core/table-style-context';

  let {
    expandable = false,
    groupName = null as string | null,
    groupSummaryData = null as Record<string, unknown> | null,
    size = 'md' as 'sm' | 'md' | 'lg',
    class: className = ''
  } = $props();

  const tableContext = getInternalTableContext();
  const { state: tableState } = tableContext;
  const styleConfig = getTableStyleConfig();

  let summaryData = $derived(groupSummaryData || tableContext.summaryData);
  let selectable = $derived(tableState.selectionMode !== 'none');

  function getSummaryLabel(column: string, type: string): string {
    switch (type) {
      case 'sum':
        return '∑';
      case 'avg':
        return '⌀';
      case 'count':
        return '#';
      case 'min':
        return '↓';
      case 'max':
        return '↑';
      default:
        return type;
    }
  }

  const summaryStyles = $derived(summaryRowVariants({ variant: 'highlighted', size }));
</script>

{#if tableState.showSummary && tableState.summaryConfigs.length > 0}
  <tr
    class={resolveSlotClass(
      summaryStyles.row,
      styleConfig.slotClasses.summaryRow,
      styleConfig.unstyled,
      className
    )}
    data-testid={groupName ? `summary-row-${groupName}` : 'summary-row-total'}
  >
    <!-- Spacer cells mirror the data rows (selection → group indent → expand):
         every column slot needs a cell, or the whole row shifts and the
         row background stops short of the missing slot. -->
    {#if selectable}
      <td class="{summaryStyles.cell()} w-12" aria-hidden="true"></td>
    {/if}

    {#if tableState.groupByKey}
      <td class="{summaryStyles.cell()} w-10" aria-hidden="true"></td>
    {/if}

    {#if expandable}
      <td class="{summaryStyles.cell()} w-10" aria-hidden="true"></td>
    {/if}

    {#each tableContext.orderedColumns as column (resolveColumnId(column))}
      {@const columnId = resolveColumnId(column)}
      {@const summaryConfig = tableState.summaryConfigs.find((c) => c.column === columnId)}
      {@const summaryValue = summaryData[columnId]}

      <td
        class="{summaryStyles.cell()} {column.align ? `text-${column.align}` : 'text-right'}"
        style={column.width
          ? `width: ${column.width}; min-width: ${column.minWidth || '4rem'};`
          : ''}
        data-testid={`summary-cell-${columnId}`}
      >
        {#if summaryConfig && typeof summaryValue === 'number'}
          <div class={summaryStyles.content()}>
            <span class={summaryStyles.label()}>
              {getSummaryLabel(columnId, summaryConfig.type)}
            </span>
            <span class={summaryStyles.value()}>
              {tableContext.getFormattedSummaryValue(columnId, summaryValue)}
            </span>
          </div>
        {/if}
      </td>
    {/each}
  </tr>
{/if}
