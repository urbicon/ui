<script lang="ts">
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import { useTableI18n } from '$lib/i18n';
  import MobileCard from './MobileCard.svelte';
  import { resolveColumnId } from '$lib/utils';
  import { mobileListVariants } from '$lib/variants';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';
  import { groupCountText } from './group-count';
  import type { Column, TableItem } from '$lib/types/tableTypes';
  import type { Snippet } from 'svelte';

  const tt = useTableI18n();

  let {
    tableStyles,
    size = 'md' as 'sm' | 'md' | 'lg',
    expandable = false,
    details = 'collapsed' as 'collapsed' | 'expanded',
    expandedRowContent = undefined as Snippet<[item: TableItem]> | undefined,
    cell = undefined as Snippet<[item: TableItem, value: unknown, column: Column]> | undefined,
    noDataText = '',
    loadingText = '',
    errorText = '',
    onRowClick = undefined as ((item: TableItem) => void) | undefined
  }: {
    /** The resolved `tableContainerVariants` slots, shared with `TableDesktop`. */
    tableStyles: {
      scrollArea: (opts?: { class?: (string | undefined)[] }) => string;
      mobileOnly: () => string;
    };
    size?: 'sm' | 'md' | 'lg';
    expandable?: boolean;
    details?: 'collapsed' | 'expanded';
    expandedRowContent?: Snippet<[item: TableItem]>;
    cell?: Snippet<[item: TableItem, value: unknown, column: Column]>;
    noDataText?: string;
    loadingText?: string;
    errorText?: string;
    onRowClick?: (item: TableItem) => void;
  } = $props();

  const tableContext = getInternalTableContext();
  const { state: tableState } = tableContext;
  const filteredItems = $derived(tableContext.filteredItems);
  const paginatedItems = $derived(tableContext.paginatedItems);
  const grouped = $derived(tableContext.grouped);
  // `$derived`, not destructured off the context: every other field here is
  // read the same way, and this one was the exception — destructuring a getter
  // captures the totals once, so a grouped table kept showing the first render's
  // sums after the rows changed.
  const groupedSummaryData = $derived(tableContext.groupedSummaryData);

  const styleConfig = getTableStyleConfig();
  const listStyles = $derived(mobileListVariants({ size }));
  const errorStyles = $derived(mobileListVariants({ size, intent: 'danger' }));

  const hasSummary = $derived(tableState.showSummary && tableState.summaryConfigs.length > 0);

  function columnTitle(columnId: string): string {
    return tableState.columns.find((c) => resolveColumnId(c) === columnId)?.title || columnId;
  }
</script>

{#snippet summaryBand(title: string, values: Record<string, number>)}
  <div class={listStyles.summary()}>
    <h4 class={listStyles.summaryTitle()}>{title}</h4>
    {#each tableState.summaryConfigs as config (config.column)}
      {#if values[config.column] !== undefined}
        <div class={listStyles.summaryRow()}>
          <span class={listStyles.summaryLabel()}>{columnTitle(config.column)}</span>
          <span class={listStyles.summaryValue()}>
            {tableContext.getFormattedSummaryValue(config.column, values[config.column])}
          </span>
        </div>
      {/if}
    {/each}
  </div>
{/snippet}

<!-- The records form ONE list, not a stack of boxes: the surface, the frame and
     the radius belong to this element (`tableStyles.scrollArea`, the very slot
     the desktop table frames itself with), and a record draws nothing but a
     hairline to the next one. That also settles a documented prop that had no
     mobile effect whatsoever — `variant="framed"` used to frame the desktop
     table and leave the phone with bare cards on the page ground.

     Which of the two layouts shows is not decided here: `mobileOnly` and its
     complement `desktopOnly` are declared together in `tableContainerVariants`,
     because they are one decision and a copy of half of it drifts silently. -->
<div
  class={resolveSlotClass(
    tableStyles.scrollArea,
    styleConfig.slotClasses.scrollArea,
    styleConfig.unstyled,
    tableStyles.mobileOnly()
  )}
  data-table-layout="mobile"
  data-testid="mobile-table"
>
  <!--
    All three state snippets (`loadingState` / `errorState` / `emptyState`) are
    table-row markup (`<tr><td colspan>`, as the customization docs show), so none
    of them can render inside this card container: the HTML parser drops `<tr>`
    and `<td>` tokens outside a table and the content lands unstyled at best.
    Mobile therefore renders plain text for all three.

    There is no snippet shape that would work on both sides — phrasing content
    would be hoisted out of the desktop `<tbody>` just as row markup is dropped
    here — so this is a structural split, not a missing feature. `emptyState` used
    to be rendered here anyway; that was the odd one out, not the rule.
  -->
  {#if tableState.loading}
    <div class={listStyles.state()} role="status" data-testid="loading-state-mobile">
      {loadingText}
    </div>
  {:else if tableState.error}
    <div class={errorStyles.state()} role="alert" data-testid="error-state-mobile">
      {errorText}
      <span class={listStyles.stateDetail()}>{tableState.error}</span>
    </div>
  {:else if filteredItems.length === 0}
    <div class={listStyles.state()} data-testid="empty-state-mobile">
      {noDataText}
    </div>
  {:else if tableState.effectiveGroupBy}
    {#each Object.entries(grouped) as [groupName, groupItems] (groupName)}
      <div class={listStyles.group()}>
        <h3 class={listStyles.groupHeader()}>
          <span class={listStyles.groupTitle()}>{groupName}</span>
          <span class={listStyles.groupCount()}>
            {groupCountText(groupItems.length, tableState.mode, tt)}
          </span>
        </h3>
        {#each groupItems as item, i (item.id ?? i)}
          <MobileCard
            {item}
            {expandable}
            {details}
            {expandedRowContent}
            {cell}
            {size}
            onClick={onRowClick}
          />
        {/each}

        {#if hasSummary && groupedSummaryData[groupName]}
          <!-- No trailing colon: the band's title is a label in the list's
               uppercase register, not a sentence introducing the rows. -->
          {@render summaryBand(
            `${tt('group.summaryFor')} ${groupName}`,
            groupedSummaryData[groupName]
          )}
        {/if}
      </div>
    {/each}
  {:else}
    {#each Array.isArray(paginatedItems) ? paginatedItems : [] as item, i (item.id ?? i)}
      <MobileCard
        {item}
        {expandable}
        {details}
        {expandedRowContent}
        {cell}
        {size}
        onClick={onRowClick}
      />
    {/each}

    {#if hasSummary}
      {@render summaryBand(tt('table.summary.totalSummary'), tableContext.summaryData)}
    {/if}
  {/if}
</div>
