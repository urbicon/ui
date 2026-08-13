<script lang="ts">
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
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
  import { resolveColumnId } from '$lib/utils';
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

  const tableContext = getInternalTableContext();
  const { state: tableState, view: tableView } = tableContext;
  const filteredItems = $derived(tableContext.filteredItems);
  const paginatedItems = $derived(tableContext.paginatedItems);
  /** Rendered rows in visual order — what the keyboard navigates. Equals
   *  `paginatedItems` ungrouped; grouped it spans all groups minus collapsed ones. */
  const navigableItems = $derived(tableContext.navigableItems);
  const grouped = $derived(tableContext.grouped);
  const groupedSummaryData = $derived(tableContext.groupedSummaryData);

  /**
   * Where each rendered group's item rows start within `navigableItems`. A
   * collapsed group renders no item rows, so it contributes 0 and the next group
   * continues at the same offset — which keeps `data-row-index` contiguous over
   * exactly the rows that exist in the DOM.
   */
  const groupRowOffsets = $derived.by(() => {
    const offsets: number[] = [];
    let running = 0;
    for (const [groupName, groupItems] of Object.entries(grouped)) {
      offsets.push(running);
      if (!tableState.collapsedGroups.has(groupName)) running += groupItems.length;
    }
    return offsets;
  });

  let selectable = $derived(tableState.selectionMode !== 'none');
  let interactive = $derived(selectable || expandable || !!onRowClick);

  /** Total columns including expand + group + selection columns */
  const totalColSpan = $derived.by(() => {
    let count = tableState.columns.length;
    if (expandable) count += 1;
    if (tableState.effectiveGroupBy) count += 1;
    if (selectable) count += 1;
    return count;
  });

  let tableElement = $state<HTMLTableElement | null>(null);
  let scrollContainerEl = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let viewportHeight = $state(0);

  // Virtualized = true bypasses pagination, uses all sorted items.
  // Loading/error fall back to the standard branch: those states render a
  // single row instead of a body, which the virtual list has no place for —
  // without this the virtualized table would answer "loading" with the empty
  // state ("No data found.") while mobile says "Loading…".
  const virtualizedActive = $derived(
    virtualized && !tableState.effectiveGroupBy && !tableState.loading && !tableState.error
  );
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
    // Track dependencies so we reset on any data change.
    // `effectivePage`, not `view.page` — what matters is whether the
    // rendered rows changed, and the raw value misses that in both directions:
    // 5 → 6 against three pages renders the same rows (reset was firing for
    // nothing), while a new page size re-slices them without moving it at all.
    void tableContext.effectivePage;
    void tableView.sort;
    void tableView.search;
    void tableView.filters;
    // Grouping reshapes the index space just as much as paging does: switching
    // the group key reorders every row, and collapsing a group removes a run of
    // them, so a held index would land on a different item.
    void tableState.effectiveGroupBy;
    void tableState.collapsedGroups.size;
    tableContext.resetFocus();
  });

  function focusRow(index: number) {
    if (!tableElement) return;
    // Address the row by its index attribute rather than by position in the
    // NodeList: grouped rendering interleaves group headers and summary rows, so
    // "the Nth matching element" and "the row at index N" are not the same thing.
    const targetRow = tableElement.querySelector<HTMLElement>(
      `tbody tr[data-row-index="${index}"]`
    );
    if (targetRow) {
      targetRow.focus({ preventScroll: false });
    }
  }

  function getItemIdAtIndex(index: number): string | number | undefined {
    const item = navigableItems[index];
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

    const itemCount = navigableItems.length;
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
            const item = navigableItems[tableContext.focusedRowIndex];
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
      // Both keys step from `effectivePage`, not `view.page`: the raw
      // value can sit past the last page after the page size or the row count
      // changed, and stepping from there lands outside the range `goToPage`
      // accepts — which killed paging in BOTH directions rather than one.
      case 'PageDown': {
        // Next page
        if (tableContext.totalPages > 1 && tableContext.effectivePage < tableContext.totalPages) {
          e.preventDefault();
          tableContext.goToPage(tableContext.effectivePage + 1);
        }
        break;
      }
      case 'PageUp': {
        // Previous page
        if (tableContext.totalPages > 1 && tableContext.effectivePage > 1) {
          e.preventDefault();
          tableContext.goToPage(tableContext.effectivePage - 1);
        }
        break;
      }
    }
  }

  /**
   * The column tracks, as data — one entry per rendered `<col>`, in render order.
   *
   * The virtualized layout renders the header, the body and the summary row as
   * three independent `<table>` elements, so each computes its own tracks. That
   * only stayed invisible while every track was implicit: `table-fixed` takes
   * its widths from the **first row**, which for the header table is the `<th>`
   * row and for the body table is a `<td>` row — and `TableHead` writes
   * `width`/`min-width` inline on `<th>` while `TableRow` writes nothing on
   * `<td>`. So a column with an explicit `width` sized the header and not the
   * body, and everything after it slid (measured on the landing specimen: the
   * STATUS header ~130px right of its badges).
   *
   * `<colgroup>` is the mechanism tables have for exactly this — it sizes tracks
   * independently of any row — so the same list goes into all three and they can
   * no longer disagree. It mirrors `TableHead`'s leading control columns; the
   * group-toggle column is absent on purpose, because `virtualizedActive`
   * already excludes grouping.
   */
  const columnTracks = $derived.by(() => {
    const tracks: Array<{ key: string; width?: string }> = [];
    // The header's control cells carry `w-12` / `w-10`; these are the same two
    // widths, as something a `<col>` can express.
    if (selectable) tracks.push({ key: '__selection', width: '3rem' });
    if (expandable) tracks.push({ key: '__expand', width: '2.5rem' });
    // `orderedColumns` unconditionally, NOT `enableColumnReorder ? … :
    // state.columns`. `TableRow` and `SummaryRow` iterate `orderedColumns`
    // whatever that flag says, and `applyPersistedState` restores a stored
    // order whether or not reordering is currently enabled — so the conditional
    // would have sized the header's declaration order onto the body's persisted
    // one, which is the defect this snippet exists to remove. It falls back to
    // `state.columns` when no order is set, so it is never the narrower choice.
    for (const column of tableContext.orderedColumns) {
      tracks.push({ key: resolveColumnId(column), width: column.width });
    }
    return tracks;
  });
</script>

{#snippet columnTrackGroup()}
  <!-- `width` only: per CSS Tables a column box honours `border`, `background`,
       `width` and `visibility` and nothing else, so a `min-width` here would be
       inert — and one that reads as if it applied is worse than none. A column
       with only a `minWidth` gets no track, exactly as before. -->
  <colgroup>
    {#each columnTracks as track (track.key)}
      <col style={track.width ? `width: ${track.width}` : ''} />
    {/each}
  </colgroup>
{/snippet}

{#if virtualizedActive}
  <!-- Virtualized mode: scroll container with fixed height -->
  <div
    class={resolveSlotClass(
      tableStyles.scrollArea,
      styleConfig.slotClasses.scrollArea,
      styleConfig.unstyled,
      `relative ${tableStyles.desktopOnly()}`
    )}
    data-table-layout="desktop"
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
      {@render columnTrackGroup()}
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
          {@render columnTrackGroup()}
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
          <!-- The rendered window is offset once, here, rather than per row:
               `startIndex` is the first row the virtualizer kept, so the table
               starts exactly where that row belongs. Offsetting each `<tr>`
               instead (which is what this did until 2026-08-13) forced
               `position: absolute` onto it, and an absolutely positioned
               element is never a `table-row` — its cells then sized themselves
               from their content instead of from the shared column tracks. -->
          <table
            class="{resolveSlotClass(
              tableStyles.table,
              styleConfig.slotClasses.table,
              styleConfig.unstyled,
              'table-fixed'
            )} absolute top-0 left-0 w-full"
            style="transform: translateY({virtualResult.startIndex * rowHeight}px);"
            onkeydown={handleTableKeyDown}
          >
            {@render columnTrackGroup()}
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
          <!-- `table-fixed` + the shared tracks, like its two siblings: without
               them this third table sized its columns from the summary values,
               so the totals sat under the wrong headers. -->
          <table
            class={resolveSlotClass(
              tableStyles.table,
              styleConfig.slotClasses.table,
              styleConfig.unstyled,
              'table-fixed'
            )}
          >
            {@render columnTrackGroup()}
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
      // The layout switch itself is declared once, next to its mobile half, in
      // `tableContainerVariants` — see the note there for why both literals live
      // in one place.
      [`relative ${tableStyles.desktopOnly()}`, scrollAreaOverflow].filter(Boolean).join(' ')
    )}
    data-table-layout="desktop"
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
        {:else if tableState.effectiveGroupBy}
          {#if filteredItems.length === 0}
            {#if emptyState}
              {@render emptyState()}
            {:else}
              <EmptyState message={noDataText} {size} colSpan={totalColSpan} />
            {/if}
          {:else}
            {#each Object.entries(grouped) as [groupName, groupItems], groupIndex (groupName)}
              <GroupedRow
                {groupName}
                items={groupItems}
                {expandable}
                {expandedRowContent}
                {cell}
                {size}
                {groupHeaderContent}
                {onRowClick}
                rowIndexOffset={groupRowOffsets[groupIndex]}
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
