<script lang="ts">
  import {
    resolveIcon,
    Checkbox,
    ChevronDownIcon as ChevronDownIconDefault
  } from '@urbicon-ui/blocks';
  import { slide } from 'svelte/transition';

  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import { useTableI18n } from '$lib/i18n';
  import { tableRowVariants } from '$lib/variants';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';
  import { resolveRowClickActions } from './row-interaction';
  import { structuralColumns } from './structural-columns';
  import TableCell from './TableCell.svelte';
  import { resolveColumnId, resolveRowItemId } from '$lib/utils';
  import type { Column, TableItem } from '$lib/types/tableTypes';
  import type { Snippet } from 'svelte';

  const tt = useTableI18n();

  const tableContext = getInternalTableContext();
  const { state: tableState, toggleExpand, isItemExpanded } = tableContext;
  const styleConfig = getTableStyleConfig();

  let selectable = $derived(tableState.selectionMode !== 'none');

  let {
    item,
    expandable = false,
    rowIndex = 0,
    // Absolute ARIA position of this page's first row (1-based). The grid
    // announces aria-rowcount over ALL rows, so a paged row must report its
    // list-wide index — page 2 of 20-per-page starts at 21, not 1. Keyboard
    // navigation (data-row-index) stays page-local on purpose.
    ariaRowStart = 1,
    expandedRowContent = undefined as Snippet<[item: TableItem]> | undefined,
    cell = undefined as Snippet<[item: TableItem, value: unknown, column: Column]> | undefined,
    onRowClick = undefined as ((item: TableItem) => void) | undefined,
    size = 'md' as const,
    // Grouped rows render through this component too (GroupedRow keeps only
    // the group header). Their historical test ids differ from the flat rows'
    // — these two props keep every existing selector stable.
    testId = undefined as string | undefined,
    cellTestIdPrefix = 'cell'
  } = $props();

  let isFocused = $derived(tableContext.isFocusedRow(rowIndex));
  let interactive = $derived(selectable || expandable || !!onRowClick);
  const selectsOnClick = $derived(tableState.rowClickSelects && selectable);
  const clickable = $derived(expandable || !!onRowClick || selectsOnClick);

  const itemId = $derived(resolveRowItemId(item));
  let isExpanded = $derived(isItemExpanded(itemId));

  let isRowSelected = $derived(selectable && tableContext.isSelected(itemId));
  // `!= null` on purpose: `0` is a legitimate id, and an unset `activeRowId`
  // must not match the row whose index fallback is `-1`.
  let isActiveRow = $derived(tableState.activeRowId != null && tableState.activeRowId === itemId);
  let isRecentlyUpdated = $derived(tableContext.isRecentlyUpdated(itemId));

  // The one list the header, the summary row and the column tracks also read —
  // see core/structural-columns.ts. The group column is in it even though this
  // row announces no group cell: the column exists in the grid either way, and
  // the data cells count from its index rather than closing the gap.
  const structuralCols = $derived(
    structuralColumns({
      grouped: !!tableState.effectiveGroupBy,
      selectable,
      expandable
    })
  );
  const colOffset = $derived(structuralCols.length);
  const totalColumnsCount = $derived(tableState.columns.length + colOffset);

  function handleRowClick(event: MouseEvent) {
    const actions = resolveRowClickActions({
      hasRowClickHandler: !!onRowClick,
      expandable,
      rowClickSelects: tableState.rowClickSelects,
      selectable,
      row: event.currentTarget as Node | null
    });
    if (actions.fireRowClick) {
      onRowClick?.(item);
    }
    if (actions.toggleExpand) {
      toggleExpand(itemId);
    }
    if (actions.toggleSelection) {
      // Keep the roving focus with the row the user just acted on, or the next
      // Space keypress would toggle whatever row the index still pointed at.
      tableContext.setFocusedRow(rowIndex);
      tableContext.toggleItem(itemId);
    }
  }

  function handleCheckboxClick(e: MouseEvent) {
    e.stopPropagation();
  }

  function handleChevronClick(e: MouseEvent) {
    e.stopPropagation();
    if (expandable) {
      toggleExpand(itemId);
    }
  }

  // Selection wins over "currently shown": it is the state a bulk action reads,
  // so it keeps the accent. `active` sits above `expanded` because a consumer
  // that sets `activeRowId` is making an explicit statement about this row,
  // while expansion is a local toggle.
  const rowStyles = $derived(
    tableRowVariants({
      state: isRowSelected
        ? 'selected'
        : isActiveRow
          ? 'active'
          : isExpanded
            ? 'expanded'
            : 'default',
      size
    })
  );
</script>

<!-- Main row.

     A row carries no positioning of its own, virtualized or not: the window of
     rendered rows is offset by spacer rows in `TableDesktop`. Positioning a
     `<tr>` blockifies it — an absolutely positioned element is never a
     `table-row` — so its cells would leave the table's column tracks and size
     themselves from their content instead (measured on a four-column body:
     61/101/84/33 where the tracks called for equal quarters). -->
<tr
  id={String(itemId)}
  onclick={handleRowClick}
  class={resolveSlotClass(
    rowStyles.row,
    styleConfig.slotClasses.row,
    styleConfig.unstyled,
    [
      clickable ? 'cursor-pointer' : '',
      // `select-none` only where the click has no selection meaning. A
      // row-click-selects row keeps its text selectable — the handler skips
      // selection while text inside the row is highlighted, which `select-none`
      // would make unreachable.
      clickable && !selectsOnClick ? 'select-none' : '',
      isRecentlyUpdated
        ? 'ring-success/30 bg-success-subtle/30 ring-2 transition-[box-shadow,background-color] duration-1000 ring-inset'
        : ''
    ]
      .filter(Boolean)
      .join(' ')
  )}
  tabindex={interactive ? (isFocused ? 0 : -1) : undefined}
  aria-rowindex={ariaRowStart + rowIndex}
  aria-expanded={expandable ? isExpanded : undefined}
  aria-selected={selectable ? isRowSelected : undefined}
  aria-current={isActiveRow ? 'true' : undefined}
  data-row-index={rowIndex}
  data-active={isActiveRow ? '' : undefined}
  data-testid={testId ?? `table-row-${itemId}`}
>
  <!-- Structural cells (group indent, selection, expand) carry the row's cell
       chrome but not `slotClasses.cell` — that slot is scoped to data columns;
       see TableSlotClasses.cell. They also take the `controlCell` slot rather
       than `cell`: a data cell's inset is a reading edge (see
       TABLE_DIMENSIONS.padding.cellX), while these centre a fixed-size control
       inside a fixed-width column. -->
  {#each structuralCols as structural (structural.key)}
    {#if structural.key === 'group'}
      <!-- aria-hidden like the head's expand spacer, so no aria-colindex: the
           column exists, the cell just isn't content. -->
      <td class="{rowStyles.controlCell()} {structural.widthClass}" aria-hidden="true"></td>
    {:else if structural.key === 'selection'}
      <td
        class="{rowStyles.controlCell()} {structural.widthClass}"
        role={interactive ? 'gridcell' : undefined}
        aria-colindex={structural.colIndex}
        onclick={handleCheckboxClick}
      >
        <div class="flex h-full w-full items-center justify-center">
          <Checkbox
            checked={isRowSelected}
            onCheckedChange={() => tableContext.toggleItem(itemId)}
            aria-label={isRowSelected ? tt('selection.deselectRow') : tt('selection.selectRow')}
            size="sm"
            data-testid={`selection-checkbox-${itemId}`}
          />
        </div>
      </td>
    {:else if structural.key === 'expand'}
      <td
        class="{rowStyles.controlCell()} {structural.widthClass}"
        role={interactive ? 'gridcell' : undefined}
        aria-colindex={structural.colIndex}
      >
        <!-- The `px-2` stays, and is not the drift #256 removed: this box centres
             its button rather than setting content against an edge, so padding
             here squeezes the button's box instead of moving anything. Dropping
             it would be visible — the column is 2.5rem (40px at the default root
             size) and the control step takes 8px, so the 24px button currently
             has 16px to sit in and renders narrower than it declares; without the
             `px-2` it would get its full width and a wider hover ground. That is
             a change to the control, not to an inset. -->
        <div class="flex h-full w-full items-center justify-center px-2 py-2">
          <button
            class="table-expand-button rounded-modify flex h-6 w-6 items-center justify-center transition-transform duration-(--blocks-duration-fast) {isExpanded
              ? 'rotate-180'
              : ''}"
            onclick={handleChevronClick}
            aria-label={isExpanded ? tt('actions.hideDetails') : tt('actions.showDetails')}
            data-testid={`expand-button-${itemId}`}
          >
            <ChevronDownIcon class="h-4 w-4" />
          </button>
        </div>
      </td>
    {/if}
  {/each}

  {#each tableContext.orderedColumns as column, colIdx (resolveColumnId(column))}
    <TableCell
      {item}
      {column}
      {cell}
      {size}
      colIndex={colOffset + colIdx}
      cellRole={interactive ? 'gridcell' : undefined}
      cellClass={resolveSlotClass(
        rowStyles.cell,
        styleConfig.slotClasses.cell,
        styleConfig.unstyled
      )}
      testIdPrefix={cellTestIdPrefix}
    />
  {/each}
</tr>

{#if isExpanded && expandedRowContent}
  <tr data-testid={`expanded-row-${itemId}`} class="border-b-0">
    <td colspan={totalColumnsCount} class="p-0">
      <div class="bg-surface-elevated/50 px-6 py-4" transition:slide={{ duration: 150 }}>
        {@render expandedRowContent(item)}
      </div>
    </td>
  </tr>
{/if}
