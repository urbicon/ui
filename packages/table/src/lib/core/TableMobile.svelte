<script lang="ts">
  import { getTableContext } from '$lib/stores/TableStore.svelte';
  import { useTableI18n } from '$lib/i18n';
  import MobileCard from './MobileCard.svelte';
  import { resolveColumnId } from '$lib/utils';
  import type { Column, TableItem } from '$lib/types/tableTypes';
  import type { Snippet } from 'svelte';

  const tt = useTableI18n();

  let {
    size = 'md' as 'sm' | 'md' | 'lg',
    expandable = false,
    expandedRowContent = undefined as Snippet<[item: TableItem]> | undefined,
    cell = undefined as Snippet<[item: TableItem, value: unknown, column: Column]> | undefined,
    emptyState = undefined as Snippet | undefined,
    noDataText = '',
    loadingText = '',
    errorText = '',
    onRowClick = undefined as ((item: TableItem) => void) | undefined
  } = $props();

  const tableContext = getTableContext();
  const { state: tableState, groupedSummaryData } = tableContext;
  const filteredItems = $derived(tableContext.filteredItems);
  const paginatedItems = $derived(tableContext.paginatedItems);
  const grouped = $derived(tableContext.grouped);
</script>

<div class="mobile-only md:hidden" data-testid="mobile-table">
  <!--
    Loading/error render as plain text here, never through the `loadingState` /
    `errorState` snippets: those are table-row markup (`<tr><td>`), which cannot
    live inside this card container. Same reason the desktop states are separate.
  -->
  {#if tableState.loading}
    <div
      class="text-text-secondary py-6 text-center text-sm"
      role="status"
      data-testid="loading-state-mobile"
    >
      {loadingText}
    </div>
  {:else if tableState.error}
    <div class="text-danger py-6 text-center text-sm" role="alert" data-testid="error-state-mobile">
      {errorText}
      <span class="text-text-secondary mt-1 block">{tableState.error}</span>
    </div>
  {:else if filteredItems.length === 0}
    {#if emptyState}
      {@render emptyState()}
    {:else}
      <div class="text-text-secondary py-6 text-center text-sm" data-testid="empty-state-mobile">
        {noDataText}
      </div>
    {/if}
  {:else if tableState.groupByKey}
    {#each Object.entries(grouped) as [groupName, groupItems] (groupName)}
      <div class="mb-6">
        <h3
          class="text-text-primary border-border-subtle mb-3 flex min-h-11 items-center border-b pb-2 text-base font-semibold"
        >
          {groupName}
          <span class="text-text-tertiary ml-1.5 text-sm font-normal">
            ({groupItems.length}
            {groupItems.length === 1 ? tt('group.item') : tt('group.items')})
          </span>
        </h3>
        {#each groupItems as item, i (item.id ?? i)}
          <MobileCard {item} {expandable} {expandedRowContent} {cell} {size} onClick={onRowClick} />
        {/each}

        {#if tableState.showSummary && tableState.summaryConfigs.length > 0}
          <div class="bg-surface-elevated border-border-subtle rounded-contain mt-3 border p-4">
            <h4 class="text-text-primary mb-2 text-sm font-semibold">
              {tt('group.summaryFor')}
              {groupName}:
            </h4>
            <div class="space-y-1.5 text-sm">
              {#each tableState.summaryConfigs as config (config.column)}
                {#if groupedSummaryData[groupName] && groupedSummaryData[groupName][config.column] !== undefined}
                  <div class="flex min-h-8 items-center justify-between">
                    <span class="text-text-secondary">
                      {tableState.columns.find((c) => resolveColumnId(c) === config.column)
                        ?.title || config.column}:
                    </span>
                    <span class="text-text-primary font-medium">
                      {tableContext.getFormattedSummaryValue(
                        config.column,
                        groupedSummaryData[groupName][config.column]
                      )}
                    </span>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  {:else}
    {#each Array.isArray(paginatedItems) ? paginatedItems : [] as item, i (item.id ?? i)}
      <MobileCard {item} {expandable} {expandedRowContent} {cell} {size} onClick={onRowClick} />
    {/each}

    {#if tableState.showSummary && tableState.summaryConfigs.length > 0}
      <div class="bg-surface-elevated border-border-subtle rounded-contain mt-4 border p-4">
        <h4 class="text-text-primary mb-2 text-sm font-semibold">
          {tt('table.summary.totalSummary')}
        </h4>
        <div class="space-y-1.5 text-sm">
          {#each tableState.summaryConfigs as config (config.column)}
            {#if tableContext.summaryData[config.column] !== undefined}
              <div class="flex min-h-8 items-center justify-between">
                <span class="text-text-secondary">
                  {tableState.columns.find((c) => resolveColumnId(c) === config.column)?.title ||
                    config.column}:
                </span>
                <span class="text-text-primary font-medium">
                  {tableContext.getFormattedSummaryValue(
                    config.column,
                    tableContext.summaryData[config.column]
                  )}
                </span>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>
