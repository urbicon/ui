<script lang="ts">
  import {
    resolveIcon,
    Checkbox,
    createDraggable,
    findDropTarget,
    ChevronDownIcon as ChevronDownIconDefault,
    ChevronUpIcon as ChevronUpIconDefault
  } from '@urbicon-ui/blocks';
  import { getTableContext } from '$lib/stores/TableStore.svelte';
  import { resolveColumnId } from '$lib/utils';

  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);
  const ChevronUpIcon = resolveIcon('chevronUp', ChevronUpIconDefault);
  import HeaderMenu from '../features/HeaderMenu.svelte';
  import { useTableI18n } from '../i18n';
  import { tableHeaderVariants, headerIndicatorVariants } from '$lib/variants';
  import { TABLE_INDICATORS } from '$lib/variants/table.system';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';
  import { getStickyContext } from './sticky-context.svelte';
  import { measureToCssVar } from '$lib/utils/sticky-measure';

  const tt = useTableI18n();

  let { expandable = false, enableColumnReorder = false, size = 'md' as const } = $props();

  const tableContext = getTableContext();
  const { state: tableState, handleSort, toggleAllGroups } = tableContext;
  const styleConfig = getTableStyleConfig();
  const stickyContext = getStickyContext();

  let selectable = $derived(tableState.selectionMode !== 'none');
  let multiSelect = $derived(tableState.selectionMode === 'multi');

  // Column reorder state
  let dragFromIndex = $state<number | null>(null);
  let dropIndicatorIndex = $state<number | null>(null);

  // Use orderedColumns when column reorder is enabled
  const displayColumns = $derived(
    enableColumnReorder ? tableContext.orderedColumns : tableState.columns
  );

  function makeDraggable(colIndex: number) {
    if (!enableColumnReorder) {
      // No-op attachment when reorder is disabled.
      return () => {};
    }

    return createDraggable({
      axis: 'horizontal',
      threshold: 8,
      cursor: 'grabbing',
      disabled: !enableColumnReorder,
      onDragStart: ({ element }) => {
        dragFromIndex = colIndex;
        element.style.opacity = '0.5';
      },
      onDragMove: ({ clientX, clientY }) => {
        const target = findDropTarget(clientX, clientY, 'reorderCol');
        if (target) {
          dropIndicatorIndex = Number(target.dataset.reorderCol);
        }
      },
      onDragEnd: ({ element, didDrag }) => {
        element.style.opacity = '';
        if (
          didDrag &&
          dragFromIndex !== null &&
          dropIndicatorIndex !== null &&
          dragFromIndex !== dropIndicatorIndex
        ) {
          tableContext.reorderColumn(dragFromIndex, dropIndicatorIndex);
        }
        dragFromIndex = null;
        dropIndicatorIndex = null;
      }
    });
  }

  function handleHeaderKeyDown(e: KeyboardEvent, colIndex: number) {
    if (!enableColumnReorder) return;
    if (!e.shiftKey) return;

    if (e.key === 'ArrowLeft' && colIndex > 0) {
      e.preventDefault();
      tableContext.reorderColumn(colIndex, colIndex - 1);
    } else if (e.key === 'ArrowRight' && colIndex < displayColumns.length - 1) {
      e.preventDefault();
      tableContext.reorderColumn(colIndex, colIndex + 1);
    }
  }

  function hasActiveFilter(columnKey: string): boolean {
    return tableState.activeFilters.some((filter) => filter.column === columnKey);
  }

  function isGroupedColumn(columnKey: string): boolean {
    return tableState.groupByKey === columnKey;
  }

  function hasSummary(columnKey: string): boolean {
    return tableState.summaryConfigs.some((config) => config.column === columnKey);
  }

  function getSummaryTypes(columnKey: string): string[] {
    return tableState.summaryConfigs
      .filter((config) => config.column === columnKey)
      .map((config) => {
        switch (config.type) {
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
            return '?';
        }
      });
  }

  function getActionIndicators(columnKey: string) {
    const indicators: Array<{ type: 'filter' | 'group' | 'summary' }> = [];
    if (hasActiveFilter(columnKey)) indicators.push({ type: 'filter' });
    if (isGroupedColumn(columnKey)) indicators.push({ type: 'group' });
    if (hasSummary(columnKey)) indicators.push({ type: 'summary' });
    return indicators;
  }

  const INDICATOR_BG: Record<string, string> = {
    filter: TABLE_INDICATORS.dot.intent.filter,
    group: TABLE_INDICATORS.dot.intent.group,
    summary: TABLE_INDICATORS.dot.intent.summary
  };

  const headerStyles = $derived(tableHeaderVariants({ size, sticky: stickyContext.mode.header }));
</script>

<thead
  class={resolveSlotClass(
    headerStyles.header(),
    styleConfig.slotClasses.thead,
    styleConfig.unstyled
  )}
  {@attach stickyContext.mode.header ? measureToCssVar('--blocks-table-thead-h') : () => {}}
>
  <tr
    class={resolveSlotClass(
      headerStyles.row(),
      styleConfig.slotClasses.headerRow,
      styleConfig.unstyled
    )}
  >
    {#if tableState.groupByKey}
      <th class="{headerStyles.cell()} w-10 text-center">
        <button
          onclick={() => toggleAllGroups()}
          class="text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-modify flex h-6 w-6 items-center justify-center transition-colors"
          aria-label={tableState.allGroupsExpanded
            ? tt('header.collapseAllGroups')
            : tt('header.expandAllGroups')}
          data-testid="toggle-all-groups"
        >
          {#if tableState.allGroupsExpanded}
            <ChevronUpIcon class="h-4 w-4" />
          {:else}
            <ChevronDownIcon class="h-4 w-4" />
          {/if}
        </button>
      </th>
    {/if}

    {#if selectable}
      <th class="{headerStyles.cell()} w-12 text-center" data-testid="selection-header">
        {#if multiSelect}
          <Checkbox
            checked={tableContext.allSelected}
            indeterminate={tableContext.someSelected}
            onchange={() => tableContext.toggleAll()}
            aria-label={tableContext.allSelected
              ? tt('selection.deselectAllRows')
              : tt('selection.selectAllRows')}
            size="sm"
          />
        {/if}
      </th>
    {/if}

    {#if expandable}
      <th class="{headerStyles.cell()} w-10 text-center" aria-hidden="true"></th>
    {/if}

    {#each displayColumns as column, colIdx (resolveColumnId(column))}
      {@const columnId = resolveColumnId(column)}
      {@const hasFilter = hasActiveFilter(columnId)}
      {@const isGrouped = isGroupedColumn(columnId)}
      {@const columnHasSummary = hasSummary(columnId)}
      {@const summaryTypes = getSummaryTypes(columnId)}
      {@const actionIndicators = getActionIndicators(columnId)}
      {@const isActiveSorted = tableState.sortColumn === columnId}
      {@const sortedState = isActiveSorted ? tableState.sortDirection : 'none'}
      {@const isSortable =
        column.accessor !== undefined && (column.sortable === undefined || column.sortable)}
      {@const columnStyles = tableHeaderVariants({
        size,
        sortable: isSortable,
        sorted: sortedState
      })}
      {@const isDragOver =
        dropIndicatorIndex === colIdx && dragFromIndex !== null && dragFromIndex !== colIdx}

      <th
        {@attach makeDraggable(colIdx)}
        style={column.width
          ? `width: ${column.width}; min-width: ${column.minWidth || '4rem'};`
          : ''}
        class="{columnStyles.cell()} whitespace-nowrap {column.flex
          ? 'flex-col'
          : ''} {enableColumnReorder ? 'cursor-grab' : ''} {isDragOver
          ? 'outline-primary outline outline-2 outline-offset-[-2px]'
          : ''}"
        aria-sort={isActiveSorted
          ? tableState.sortDirection === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'}
        onkeydown={(e) => handleHeaderKeyDown(e, colIdx)}
        data-reorder-col={colIdx}
        data-testid={`column-header-${columnId}`}
      >
        <div class={columnStyles.cellContent()}>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div
            class="{columnStyles.titleContainer()} {isSortable ? 'cursor-pointer' : ''}"
            onclick={() => isSortable && handleSort(columnId)}
            role={isSortable ? 'button' : undefined}
            tabindex={isSortable ? 0 : undefined}
            onkeydown={(e) => {
              if (isSortable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                handleSort(columnId);
              }
            }}
          >
            <div class={columnStyles.titleContent()}>
              <span class={columnStyles.title()}>{column.title}</span>

              <div class={columnStyles.indicators()}>
                {#if hasFilter}
                  <div
                    class={headerIndicatorVariants({ type: 'filter', state: 'default' })}
                    title={tt('header.activeFilter')}
                    data-testid={`filter-indicator-${columnId}`}
                  ></div>
                {/if}

                {#if isGrouped}
                  <div
                    class={headerIndicatorVariants({ type: 'group', state: 'default' })}
                    title={tt('header.groupedColumn')}
                    data-testid={`group-indicator-${columnId}`}
                  ></div>
                {/if}

                {#if columnHasSummary}
                  <div
                    class={headerIndicatorVariants({ type: 'summary', state: 'default' })}
                    title={tt('header.summarizedColumn') + ': ' + summaryTypes.join(', ')}
                    data-testid={`summary-indicator-${columnId}`}
                  ></div>
                {/if}
              </div>
            </div>

            {#if isActiveSorted}
              <span class={columnStyles.sortIcon()} aria-hidden="true">
                {#if tableState.sortDirection === 'asc'}
                  <ChevronUpIcon class="h-4 w-4" />
                {:else}
                  <ChevronDownIcon class="h-4 w-4" />
                {/if}
              </span>
            {/if}
          </div>

          <HeaderMenu {column} isActive={isActiveSorted || isGrouped || columnHasSummary} />
        </div>

        {#if actionIndicators.length > 0}
          <div
            class={columnStyles.actionIndicators()}
            data-testid={`action-indicators-${columnId}`}
          >
            {#each actionIndicators as indicator (indicator.type)}
              <div
                class="{columnStyles.actionIndicatorBar()} {INDICATOR_BG[indicator.type]}"
                title={tt('header.activeIndicator', { type: indicator.type })}
                data-action={indicator.type}
              ></div>
            {/each}
          </div>
        {/if}
      </th>
    {/each}
  </tr>
</thead>
