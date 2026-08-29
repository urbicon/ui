<script lang="ts">
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import { resolveColumnId } from '$lib/utils';
  import { SUMMARY_TYPE_GLYPH } from '$lib/utils/summary-types';
  import { summaryRowVariants } from '$lib/variants';
  import { getTableStyleConfig, resolveSlotClass } from '$lib/core/table-style-context';
  import { structuralColumns } from '$lib/core/structural-columns';

  let {
    expandable = false,
    groupName = null as string | null,
    groupSummaryData = null as Record<string, unknown> | null,
    size = 'md' as 'sm' | 'md' | 'lg',
    // Rendered inside a `<tfoot>` pinned to the bottom edge of the table's own
    // scroll box: the top rule becomes a shadow that travels with the pin —
    // see `summaryRowVariants`.
    pinned = false,
    class: className = ''
  } = $props();

  const tableContext = getInternalTableContext();
  const { state: tableState } = tableContext;
  const styleConfig = getTableStyleConfig();

  let summaryData = $derived(groupSummaryData || tableContext.summaryData);
  let selectable = $derived(tableState.selectionMode !== 'none');
  // The aggregations in force, not the configured ones — one derivation for
  // every surface that says a summary is acting (#252, see useSummary).
  const summaryConfigs = $derived(tableState.effectiveSummaryConfigs);

  /**
   * Whether any aggregation in force has a cell here to be drawn in.
   *
   * The store's answer, not this row's own: the total's `<tfoot>` is an element
   * wrapped around this component, so it has to reach the same verdict or a row
   * that declines to exist leaves an empty foot behind. The grouped arm renders
   * this component with no element around it, and is unaffected either way.
   *
   * What it rules out here: the aggregations in force are every aggregation
   * acting on the data (#252), while this row has a *place* only for the
   * columns it renders — hiding a summarised column takes its cell with it.
   * Gating on the list alone left a highlighted, entirely empty strip under the
   * table whenever the last summarised column was hidden.
   */
  const hasSummaryCell = $derived(tableContext.summaryRowRenders);

  // The one list the header, the body and the column tracks also read — see
  // core/structural-columns.ts.
  const structuralCols = $derived(
    structuralColumns({
      grouped: !!tableState.effectiveGroupBy,
      selectable,
      expandable
    })
  );

  const summaryStyles = $derived(summaryRowVariants({ size, pinned }));
</script>

{#if hasSummaryCell}
  <tr
    class={resolveSlotClass(
      summaryStyles.row,
      styleConfig.slotClasses.summaryRow,
      styleConfig.unstyled,
      className
    )}
    data-testid={groupName ? `summary-row-${groupName}` : 'summary-row-total'}
  >
    <!-- One spacer per structural column: every column slot needs a cell, or the
         whole row shifts and the row background stops short of the missing slot.
         `controlCell` rather than `cell` for the same reason the body uses it —
         a narrow step for a control column, not a data cell's reading inset. -->
    {#each structuralCols as structural (structural.key)}
      <td class="{summaryStyles.controlCell()} {structural.widthClass}" aria-hidden="true"></td>
    {/each}

    {#each tableContext.orderedColumns as column (resolveColumnId(column))}
      {@const columnId = resolveColumnId(column)}
      {@const summaryConfig = summaryConfigs.find((c) => c.column === columnId)}
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
              {SUMMARY_TYPE_GLYPH[summaryConfig.type]}
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
