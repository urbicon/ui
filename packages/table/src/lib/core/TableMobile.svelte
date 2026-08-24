<script lang="ts">
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import { useTableI18n } from '$lib/i18n';
  import MobileCard from './MobileCard.svelte';
  import { resolveColumnLabelById, resolveRowItemId } from '$lib/utils';
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
  // The cards page even where the desktop virtualizes: rendering the full
  // list here is O(n) DOM on every viewport (this layout is always mounted —
  // CSS owns the switch), so the page slice stays and the shared pager
  // renders mobile-only in that case (see the page descriptor's pagerScope).
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

  // The aggregations in force, from the store's one derivation (#252) — this
  // used to be a hand-written copy of the gate, and the surfaces that carried
  // no copy at all contradicted it.
  const summaryConfigs = $derived(tableState.effectiveSummaryConfigs);
  const hasSummary = $derived(summaryConfigs.length > 0);

  // The band is a LIST of label/value rows, not a grid, so it has a place for
  // an aggregation whose column is not on screen — and it keeps showing one
  // (tool-columns.ts carries where that line runs). Which makes the label the
  // whole question: resolved over `state.columns` this degraded to the raw
  // `amount` the moment the column was hidden, beside a correctly formatted
  // total (#253). The shared helper also brings `menuTitle` and the humanised
  // fallback, neither of which the hand-rolled `?.title || columnId` had.
  const columnTitle = (columnId: string) => resolveColumnLabelById(tableState.allColumns, columnId);
</script>

{#snippet summaryBand(title: string, values: Record<string, number>)}
  <div class={listStyles.summary()}>
    <h4 class={listStyles.summaryTitle()}>{title}</h4>
    {#each summaryConfigs as config (config.column)}
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
  <!-- Loading text only while there is nothing to show yet: on a later fetch
       the cards stay put and the shared pager goes inert — unlike the desktop
       rows, which still blank during every fetch; the cards are the better
       half here. Unmounting every card on each page turn made the list jump. -->
  {#if tableState.loading && filteredItems.length === 0}
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
        <!-- Same identity rule as every renderer — a loop-local key collided
             across groups for id-less rows (see GroupedRow). -->
        {#each groupItems as item (resolveRowItemId(item))}
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
    {#each paginatedItems as item (resolveRowItemId(item))}
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
