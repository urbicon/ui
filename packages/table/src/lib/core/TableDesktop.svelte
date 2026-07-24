<script lang="ts">
  import { getTableContext } from '$lib/stores/TableStore.svelte';
  import { useTableI18n } from '$lib/i18n';
  import EmptyState from './EmptyState.svelte';
  import ErrorState from './ErrorState.svelte';
  import GroupedRow from './GroupedRow.svelte';
  import LoadingState from './LoadingState.svelte';
  import TableHead from './TableHead.svelte';
  import TableRow from './TableRow.svelte';
  import SummaryRow from '../features/SummaryRow.svelte';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';
  import { computeVirtualItems, ROW_HEIGHTS } from '$lib/utils/virtualizer';
  import { getStickyContext } from './sticky-context.svelte';
  import type { Column, TableItem } from '$lib/types/tableTypes';
  import type { Snippet } from 'svelte';

  const tt = useTableI18n();

  const styleConfig = getTableStyleConfig();
  const stickyContext = getStickyContext();
  // When header or group-header pinning is enabled, the visible frame must NOT
  // create its own scroll-ancestor (overflow:auto/hidden hijacks `position: sticky`).
  // We trade the in-table horizontal scroll for page-level overflow in that case.
  const scrollAreaOverflow = $derived(
    stickyContext.mode.header || stickyContext.mode.group ? '' : 'overflow-x-auto'
  );

  let {
    tableStyles,
    tableDomWidth = '100%',
    size = 'md' as 'sm' | 'md' | 'lg',
    expandable = false,
    expandedRowContent = undefined as Snippet<[item: TableItem]> | undefined,
    cell = undefined as Snippet<[item: TableItem, value: unknown, column: Column]> | undefined,
    header = undefined as Snippet | undefined,
    body = undefined as Snippet | undefined,
    emptyState = undefined as Snippet | undefined,
    loadingState = undefined as Snippet | undefined,
    errorState = undefined as Snippet | undefined,
    loadingText = '',
    errorText = '',
    noDataText = '',
    onRowClick = undefined as ((item: TableItem) => void) | undefined,
    virtualized = false,
    groupHeaderContent = undefined as
      Snippet<[groupName: string, items: TableItem[], isExpanded: boolean]> | undefined,
    ariaLabel = undefined as string | undefined,
    virtualHeight = '600px',
    enableColumnReorder = false
  } = $props();

  const tableContext = getTableContext();
  const { state: tableState } = tableContext;
  const filteredItems = $derived(tableContext.filteredItems);
  const paginatedItems = $derived(tableContext.paginatedItems);
  const grouped = $derived(tableContext.grouped);
  const groupedSummaryData = $derived(tableContext.groupedSummaryData);

  let selectable = $derived(tableState.selectionMode !== 'none');
  let interactive = $derived(selectable || expandable || !!onRowClick);

  /** Total columns including expand + group + selection columns */
  const totalColSpan = $derived.by(() => {
    let count = tableState.columns.length;
    if (expandable) count += 1;
    if (tableState.groupByKey) count += 1;
    if (selectable) count += 1;
    return count;
  });

  let tableElement = $state<HTMLTableElement | null>(null);
  let scrollContainerEl = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let viewportHeight = $state(0);

  // Virtualized = true bypasses pagination, uses all sorted items
  const virtualizedActive = $derived(virtualized && !tableState.groupByKey);
  const virtualItems = $derived(tableContext.sortedItems);
  const rowHeight = $derived(ROW_HEIGHTS[size] ?? ROW_HEIGHTS.md);

  const virtualResult = $derived(
    virtualizedActive
      ? computeVirtualItems(scrollTop, viewportHeight, {
          count: virtualItems.length,
          rowHeight,
          overscan: 5
        })
      : null
  );

  function handleVirtualScroll() {
    if (scrollContainerEl) {
      scrollTop = scrollContainerEl.scrollTop;
    }
  }

  // Observe container height for virtualizer
  $effect(() => {
    if (scrollContainerEl && virtualizedActive) {
      viewportHeight = scrollContainerEl.clientHeight;
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          viewportHeight = entry.contentRect.height;
        }
      });
      observer.observe(scrollContainerEl);
      return () => observer.disconnect();
    }
  });

  // Reset focus when page/sort/filter changes
  $effect(() => {
    // Track dependencies so we reset on any data change
    void tableState.currentPage;
    void tableState.sortColumn;
    void tableState.sortDirection;
    void tableState.searchTerm;
    void tableState.activeFilters;
    tableContext.resetFocus();
  });

  function focusRow(index: number) {
    if (!tableElement) return;
    const rows = tableElement.querySelectorAll<HTMLElement>('tbody tr[data-row-index]');
    const targetRow = rows[index];
    if (targetRow) {
      targetRow.focus({ preventScroll: false });
    }
  }

  function getItemIdAtIndex(index: number): string | number | undefined {
    const items = Array.isArray(paginatedItems) ? paginatedItems : [];
    const item = items[index];
    if (!item) return undefined;
    const id = item.id ?? item.__index;
    return typeof id === 'string' || typeof id === 'number' ? id : undefined;
  }

  function handleTableKeyDown(e: KeyboardEvent) {
    if (!interactive) return;

    // Only handle keys when focus is on or inside a row
    const target = e.target as HTMLElement;
    const isInsideInteractive = target.closest(
      'button, input, select, textarea, a[href], [contenteditable]'
    );

    // If the user is interacting with a form element inside a cell, don't capture keys
    // Exception: we still handle arrow keys to navigate out
    if (
      isInsideInteractive &&
      !['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)
    ) {
      return;
    }

    const itemCount = Array.isArray(paginatedItems) ? paginatedItems.length : 0;
    if (itemCount === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        tableContext.moveFocus('down');
        focusRow(tableContext.focusedRowIndex);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        tableContext.moveFocus('up');
        focusRow(tableContext.focusedRowIndex);
        break;
      }
      case 'Home': {
        e.preventDefault();
        tableContext.moveFocus('first');
        focusRow(tableContext.focusedRowIndex);
        break;
      }
      case 'End': {
        e.preventDefault();
        tableContext.moveFocus('last');
        focusRow(tableContext.focusedRowIndex);
        break;
      }
      case ' ': {
        // Space = toggle selection
        if (selectable) {
          e.preventDefault();
          const id = getItemIdAtIndex(tableContext.focusedRowIndex);
          if (id !== undefined) {
            tableContext.toggleItem(id);
          }
        }
        break;
      }
      case 'Enter': {
        // Enter = expand row or trigger onRowClick
        const id = getItemIdAtIndex(tableContext.focusedRowIndex);
        if (id !== undefined) {
          if (expandable) {
            e.preventDefault();
            tableContext.toggleExpand(id);
          } else if (onRowClick) {
            e.preventDefault();
            const items = Array.isArray(paginatedItems) ? paginatedItems : [];
            const item = items[tableContext.focusedRowIndex];
            if (item) onRowClick(item);
          }
        }
        break;
      }
      case 'Escape': {
        // Escape = deselect all or collapse expanded rows
        if (selectable && tableContext.selectedItems.length > 0) {
          e.preventDefault();
          tableContext.deselectAll();
        }
        break;
      }
      case 'PageDown': {
        // Next page
        if (tableContext.totalPages > 1 && tableState.currentPage < tableContext.totalPages) {
          e.preventDefault();
          tableContext.goToPage(tableState.currentPage + 1);
        }
        break;
      }
      case 'PageUp': {
        // Previous page
        if (tableContext.totalPages > 1 && tableState.currentPage > 1) {
          e.preventDefault();
          tableContext.goToPage(tableState.currentPage - 1);
        }
        break;
      }
    }
  }
</script>

{#if virtualizedActive}
  <!-- Virtualized mode: scroll container with fixed height -->
  <div
    class={resolveSlotClass(
      tableStyles.scrollArea,
      styleConfig.slotClasses.scrollArea,
      styleConfig.unstyled,
      'desktop-only relative max-md:hidden'
    )}
    role="region"
    aria-label={tt('aria.tableData')}
    style="width: {tableDomWidth};"
  >
    <!-- Sticky header table -->
    <table
      bind:this={tableElement}
      class={resolveSlotClass(
        tableStyles.table,
        styleConfig.slotClasses.table,
        styleConfig.unstyled,
        'table-fixed'
      )}
      role={interactive ? 'grid' : undefined}
      aria-label={ariaLabel}
      aria-rowcount={virtualItems.length}
      onkeydown={handleTableKeyDown}
      data-testid="table-element"
    >
      {#if header}
        {@render header()}
      {:else}
        <TableHead {expandable} {enableColumnReorder} {size} />
      {/if}
    </table>

    <!-- Scrollable body -->
    <div
      bind:this={scrollContainerEl}
      onscroll={handleVirtualScroll}
      class="overflow-x-hidden overflow-y-auto"
      style="height: {virtualHeight};"
      role="presentation"
      data-testid="virtual-scroll-container"
    >
      {#if filteredItems.length === 0}
        <table
          class={resolveSlotClass(
            tableStyles.table,
            styleConfig.slotClasses.table,
            styleConfig.unstyled,
            'table-fixed'
          )}
          onkeydown={handleTableKeyDown}
        >
          <tbody
            class={resolveSlotClass(
              tableStyles.body,
              styleConfig.slotClasses.tbody,
              styleConfig.unstyled
            )}
          >
            {#if emptyState}
              {@render emptyState()}
            {:else}
              <EmptyState message={noDataText} {size} colSpan={totalColSpan} />
            {/if}
          </tbody>
        </table>
      {:else if virtualResult}
        <!-- Inner container with total height for scrollbar -->
        <div style="height: {virtualResult.totalHeight}px; position: relative;">
          <table
            class="{resolveSlotClass(
              tableStyles.table,
              styleConfig.slotClasses.table,
              styleConfig.unstyled,
              'table-fixed'
            )} absolute top-0 left-0 w-full"
            onkeydown={handleTableKeyDown}
          >
            <tbody
              class={resolveSlotClass(
                tableStyles.body,
                styleConfig.slotClasses.tbody,
                styleConfig.unstyled
              )}
            >
              {#each virtualResult.virtualItems as vItem (vItem.index)}
                {@const item = virtualItems[vItem.index]}
                {#if item}
                  <TableRow
                    {item}
                    {expandable}
                    {expandedRowContent}
                    {cell}
                    {size}
                    virtualized={true}
                    virtualIndex={vItem.index}
                    virtualItemHeight={rowHeight}
                    {onRowClick}
                    rowIndex={vItem.index}
                  />
                {/if}
              {/each}
            </tbody>
          </table>
        </div>

        {#if tableState.showSummary && tableState.summaryConfigs.length > 0}
          <table
            class={resolveSlotClass(
              tableStyles.table,
              styleConfig.slotClasses.table,
              styleConfig.unstyled
            )}
          >
            <tbody>
              <SummaryRow {expandable} {size} />
            </tbody>
          </table>
        {/if}
      {/if}
    </div>
  </div>
{:else}
  <!-- Standard mode: normal table rendering -->
  <div
    class={resolveSlotClass(
      tableStyles.scrollArea,
      styleConfig.slotClasses.scrollArea,
      styleConfig.unstyled,
      ['desktop-only relative max-md:hidden', scrollAreaOverflow].filter(Boolean).join(' ')
    )}
    role="region"
    aria-label={tt('aria.tableData')}
    style="width: {tableDomWidth};"
  >
    <table
      bind:this={tableElement}
      class={resolveSlotClass(
        tableStyles.table,
        styleConfig.slotClasses.table,
        styleConfig.unstyled
      )}
      role={interactive ? 'grid' : undefined}
      aria-label={ariaLabel}
      aria-rowcount={filteredItems.length}
      onkeydown={handleTableKeyDown}
      data-testid="table-element"
    >
      {#if header}
        {@render header()}
      {:else}
        <TableHead {expandable} {enableColumnReorder} {size} />
      {/if}

      <tbody
        class={resolveSlotClass(
          tableStyles.body,
          styleConfig.slotClasses.tbody,
          styleConfig.unstyled
        )}
      >
        {#if tableState.loading}
          {#if loadingState}
            {@render loadingState()}
          {:else}
            <LoadingState text={loadingText} {size} colSpan={totalColSpan} />
          {/if}
        {:else if tableState.error}
          {#if errorState}
            {@render errorState()}
          {:else}
            <ErrorState
              title={errorText}
              message={tableState.error}
              {size}
              colSpan={totalColSpan}
            />
          {/if}
        {:else if tableState.groupByKey}
          {#if filteredItems.length === 0}
            {#if emptyState}
              {@render emptyState()}
            {:else}
              <EmptyState message={noDataText} {size} colSpan={totalColSpan} />
            {/if}
          {:else}
            {#each Object.entries(grouped) as [groupName, groupItems] (groupName)}
              <GroupedRow
                {groupName}
                items={groupItems}
                {expandable}
                {expandedRowContent}
                {cell}
                {size}
                {groupHeaderContent}
                {onRowClick}
              />

              {#if tableState.showSummary && tableState.summaryConfigs.length > 0}
                <SummaryRow
                  {expandable}
                  {size}
                  {groupName}
                  groupSummaryData={groupedSummaryData[groupName]}
                />
              {/if}
            {/each}
          {/if}
        {:else if filteredItems.length === 0}
          {#if emptyState}
            {@render emptyState()}
          {:else}
            <EmptyState message={noDataText} {size} colSpan={totalColSpan} />
          {/if}
        {:else}
          {#if body}
            {@render body()}
          {:else}
            {#each Array.isArray(paginatedItems) ? paginatedItems : [] as item, i (item.id ?? i)}
              <TableRow
                {item}
                {expandable}
                {expandedRowContent}
                {cell}
                {size}
                {onRowClick}
                rowIndex={i}
              />
            {/each}
          {/if}

          {#if tableState.showSummary && tableState.summaryConfigs.length > 0}
            <SummaryRow {expandable} {size} />
          {/if}
        {/if}
      </tbody>
    </table>
  </div>
{/if}
