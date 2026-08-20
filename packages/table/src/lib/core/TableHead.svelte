<script lang="ts">
  import {
    resolveIcon,
    Checkbox,
    createDraggable,
    findDropTarget,
    ChevronDownIcon as ChevronDownIconDefault,
    ChevronUpIcon as ChevronUpIconDefault
  } from '@urbicon-ui/blocks';
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import { resolveColumnId } from '$lib/utils';
  import { isColumnSortable } from '$lib/utils/column-capabilities';
  import { headerSelection } from './header-selection';
  import { leadingStructuralColumns } from './column-offset';

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

  let {
    expandable = false,
    enableColumnReorder = false,
    size = 'md' as const,
    // The virtualized branch wraps three presentational <table>s in one
    // role="grid" element; presentation strips the implicit roles of thead,
    // tr and th, so this head re-declares them explicitly there. The standard
    // branch passes nothing and renders exactly as before.
    explicitRoles = false
  } = $props();

  const tableContext = getInternalTableContext();
  const { state: tableState, view: tableView, handleSort, toggleAllGroups } = tableContext;
  const styleConfig = getTableStyleConfig();
  const stickyContext = getStickyContext();

  let selectable = $derived(tableState.selectionMode !== 'none');

  // The same offset the row's cells count from — one derivation, so the
  // header's aria-colindex can never disagree with the body's.
  const colOffset = $derived(
    leadingStructuralColumns({
      grouped: !!tableState.effectiveGroupBy,
      selectable,
      expandable
    })
  );
  const selectionColIndex = $derived((tableState.effectiveGroupBy ? 1 : 0) + 1);
  let multiSelect = $derived(tableState.selectionMode === 'multi');

  // Column reorder state
  let dragFromIndex = $state<number | null>(null);
  let dropIndicatorIndex = $state<number | null>(null);

  // `orderedColumns` unconditionally. It used to be gated on
  // `enableColumnReorder`, but `TableRow` and `SummaryRow` never were, and a
  // stored column order is restored whether or not reordering is currently
  // enabled — so with the flag off the header rendered the declaration order
  // over a body in the persisted one. `orderedColumns` falls back to
  // `state.columns` when no order is set, so this is the same list in every
  // case the flag used to cover.
  const displayColumns = $derived(tableContext.orderedColumns);

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
    return tableView.filters.some((filter) => filter.column === columnKey);
  }

  function isGroupedColumn(columnKey: string): boolean {
    return tableState.effectiveGroupBy === columnKey;
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
  class={resolveSlotClass(headerStyles.header, styleConfig.slotClasses.thead, styleConfig.unstyled)}
  role={explicitRoles ? 'rowgroup' : undefined}
  {@attach stickyContext.mode.header ? measureToCssVar('--blocks-table-thead-h') : () => {}}
>
  <tr
    class={resolveSlotClass(
      headerStyles.row,
      styleConfig.slotClasses.headerRow,
      styleConfig.unstyled
    )}
    role={explicitRoles ? 'row' : undefined}
  >
    <!-- Structural header cells (group toggle, select-all, expand spacer) are
         chrome, not columns: they carry the header cell chrome but not
         `slotClasses.headerCell` — see TableSlotClasses.headerCell. -->
    {#if tableState.effectiveGroupBy}
      <th
        scope="col"
        role={explicitRoles ? 'columnheader' : undefined}
        aria-colindex={1}
        class="{headerStyles.cell()} w-10 text-center"
      >
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
      <th
        scope="col"
        role={explicitRoles ? 'columnheader' : undefined}
        aria-colindex={selectionColIndex}
        class="{headerStyles.cell()} w-12"
        data-testid="selection-header"
      >
        {#if multiSelect}
          <!-- What the checkbox may claim is decided in headerSelection: in
               server mode it acts on one page of a larger result, so a full
               check stays unreachable and the label names the page. -->
          {@const headerSel = headerSelection({
            pageScoped:
              tableContext.pageInfo.serverProcessed &&
              tableContext.pageInfo.totalItems > tableContext.filteredItems.length,
            pageComplete: tableContext.allSelected,
            someSelected: tableContext.someSelected,
            visibleCount: tableContext.filteredItems.length
          })}
          <div class="flex h-full w-full items-center justify-center">
            <Checkbox
              checked={headerSel.checked}
              indeterminate={headerSel.indeterminate}
              disabled={headerSel.disabled}
              onCheckedChange={() => tableContext.toggleAll()}
              aria-label={tt(headerSel.labelKey, {
                count: String(headerSel.labelParams?.count ?? 0)
              })}
              size="sm"
            />
          </div>
        {/if}
      </th>
    {/if}

    {#if expandable}
      <!-- aria-hidden, so no aria-colindex: the header leaves the tree, but
           the COLUMN still counts — colOffset includes it, so the data cells
           skip its index rather than closing the gap. -->
      <th scope="col" class="{headerStyles.cell()} w-10 text-center" aria-hidden="true"></th>
    {/if}

    {#each displayColumns as column, colIdx (resolveColumnId(column))}
      {@const columnId = resolveColumnId(column)}
      {@const hasFilter = hasActiveFilter(columnId)}
      {@const isGrouped = isGroupedColumn(columnId)}
      {@const columnHasSummary = hasSummary(columnId)}
      {@const summaryTypes = getSummaryTypes(columnId)}
      {@const actionIndicators = getActionIndicators(columnId)}
      {@const isActiveSorted = tableView.sort?.column === columnId}
      {@const sortedState = isActiveSorted ? (tableView.sort?.direction ?? 'none') : 'none'}
      {@const isSortable = isColumnSortable(column)}
      <!-- No `align` here, deliberately: a header does NOT yet follow its
           column's alignment, and the axis that used to be passed has been
           removed rather than left in place doing nothing. Making it work is a
           layout change, not a variant value — the header and the body cell are
           two separately grown chains with their own inner padding and their own
           chrome (menu, sort chevron, indicator dots), and every attempt to
           align them by moving one class uncovered another layer. See the issue
           linked from `tableHeaderVariants`. -->
      {@const columnStyles = tableHeaderVariants({
        size,
        sortable: isSortable,
        sorted: sortedState
      })}
      {@const isDragOver =
        dropIndicatorIndex === colIdx && dragFromIndex !== null && dragFromIndex !== colIdx}

      <th
        scope="col"
        role={explicitRoles ? 'columnheader' : undefined}
        aria-colindex={colOffset + colIdx + 1}
        {@attach makeDraggable(colIdx)}
        style={column.width
          ? `width: ${column.width}; min-width: ${column.minWidth || '4rem'};`
          : ''}
        class={resolveSlotClass(
          columnStyles.cell,
          styleConfig.slotClasses.headerCell,
          styleConfig.unstyled,
          [
            'whitespace-nowrap',
            column.flex ? 'flex-col' : '',
            enableColumnReorder ? 'cursor-grab' : '',
            isDragOver ? 'outline-primary outline outline-2 outline-offset-[-2px]' : ''
          ]
            .filter(Boolean)
            .join(' ')
        )}
        aria-sort={isActiveSorted
          ? tableView.sort?.direction === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'}
        onkeydown={(e) => handleHeaderKeyDown(e, colIdx)}
        data-reorder-col={colIdx}
        data-testid={`column-header-${columnId}`}
      >
        <div class={columnStyles.cellContent()}>
          <!-- The tab stop follows what the header can do, which is sorting OR
               reordering. Keyed on `isSortable` alone, keyboard reordering was
               unreachable for exactly the columns most likely to be moved —
               status, actions, anything unsorted: `handleHeaderKeyDown` sits on
               the `<th>` and only ever sees a key event that bubbles up from
               this element.

               Reaching the stop is half of it; knowing what it does is the
               other. The column title inside supplies the accessible name, and
               `aria-keyshortcuts` supplies the part no screen reader could
               infer — that Shift+Arrow moves this column. Without it a reader
               tabbing through a reorderable header lands on an element that
               announces a name and no capability, which is a stop that costs
               keystrokes and gives nothing back.

               `role` stays unset when the column cannot be sorted: `button`
               would promise that Enter does something, and here it does not. -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div
            class="{columnStyles.titleContainer()} {isSortable ? 'cursor-pointer' : ''}"
            onclick={() => isSortable && handleSort(columnId)}
            role={isSortable ? 'button' : undefined}
            tabindex={isSortable || enableColumnReorder ? 0 : undefined}
            aria-keyshortcuts={enableColumnReorder ? 'Shift+ArrowLeft Shift+ArrowRight' : undefined}
            onkeydown={(e) => {
              if (isSortable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                handleSort(columnId);
              }
            }}
          >
            <div class={columnStyles.titleContent()}>
              <span class={columnStyles.title()}>{column.title}</span>

              <!-- Only when there is something to show, and gated on the same
                   `actionIndicators` the bar below reads — two copies of one
                   condition would let the dots and the bar disagree. Rendered
                   unconditionally the box was still a sibling, so
                   `titleContent`'s `space-x-2` gave the title an 8px trailing
                   margin in every column: invisible on its own, and
                   load-bearing by accident during the alignment attempt. -->
              {#if actionIndicators.length > 0}
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
              {/if}
            </div>

            {#if isActiveSorted}
              <span class={columnStyles.sortIcon()} aria-hidden="true">
                {#if tableView.sort?.direction === 'asc'}
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
