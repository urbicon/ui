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
  import { leadingStructuralColumns } from './column-offset';
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
    // The virtualized branch renders this row inside a presentational <table>
    // under one role="grid" wrapper; presentation strips the implicit row and
    // cell roles, so the row re-declares them explicitly there. The standard
    // branch passes nothing and renders exactly as before.
    explicitRoles = false,
    expandedRowContent = undefined as Snippet<[item: TableItem]> | undefined,
    cell = undefined as Snippet<[item: TableItem, value: unknown, column: Column]> | undefined,
    onRowClick = undefined as ((item: TableItem) => void) | undefined,
    size = 'md' as const
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

  const totalColumnsCount = $derived.by(() => {
    let count = tableState.columns.length;
    if (tableState.effectiveGroupBy) count += 1;
    if (expandable) count += 1;
    if (selectable) count += 1;
    return count;
  });

  // The structural columns before the data columns — what aria-colindex
  // counts from. Grouped counts even though this row renders no group cell:
  // the column exists in the grid either way.
  const colOffset = $derived(
    leadingStructuralColumns({
      grouped: !!tableState.effectiveGroupBy,
      selectable,
      expandable
    })
  );
  const selectionColIndex = $derived((tableState.effectiveGroupBy ? 1 : 0) + 1);
  const expandColIndex = $derived(selectionColIndex + (selectable ? 1 : 0));

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
     rendered rows is offset once, on the table in `TableDesktop`. Positioning
     each `<tr>` absolutely blockified it — an absolutely positioned element is
     never a `table-row` — so its cells left the table's own column tracks and
     sized themselves from their content instead (measured on a four-column
     body: 61/101/84/33 where the tracks called for equal quarters).

     This is about the cells within ONE table. It does not make the virtualized
     header line up with the virtualized body: those are two separate `<table>`
     elements that share no tracks at all, so an explicit `column.width` remains
     the only thing that reaches both — see the note in
     `apps/docs/src/routes/table/virtual-scrolling/+page.svelte`. -->
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
  role={explicitRoles ? 'row' : undefined}
  tabindex={interactive ? (isFocused ? 0 : -1) : undefined}
  aria-rowindex={ariaRowStart + rowIndex}
  aria-expanded={expandable ? isExpanded : undefined}
  aria-selected={selectable ? isRowSelected : undefined}
  aria-current={isActiveRow ? 'true' : undefined}
  data-row-index={rowIndex}
  data-active={isActiveRow ? '' : undefined}
  data-testid={`table-row-${itemId}`}
>
  <!-- Structural cells (selection, expand) carry the row's cell chrome but not
       `slotClasses.cell` — that slot is scoped to data columns; see
       TableSlotClasses.cell. -->
  {#if selectable}
    <td
      class="{rowStyles.cell()} w-12"
      role={explicitRoles ? 'gridcell' : undefined}
      aria-colindex={selectionColIndex}
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
  {/if}

  {#if expandable}
    <td
      class="{rowStyles.cell()} w-10"
      role={explicitRoles ? 'gridcell' : undefined}
      aria-colindex={expandColIndex}
    >
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

  {#each tableContext.orderedColumns as column, colIdx (resolveColumnId(column))}
    <TableCell
      {item}
      {column}
      {cell}
      {size}
      colIndex={colOffset + colIdx}
      cellRole={explicitRoles
        ? interactive
          ? 'gridcell'
          : 'cell'
        : interactive
          ? 'gridcell'
          : undefined}
      cellClass={resolveSlotClass(
        rowStyles.cell,
        styleConfig.slotClasses.cell,
        styleConfig.unstyled
      )}
      testIdPrefix="cell"
    />
  {/each}
</tr>

{#if isExpanded && expandedRowContent}
  <tr
    data-testid={`expanded-row-${itemId}`}
    class="border-b-0"
    role={explicitRoles ? 'row' : undefined}
  >
    <td colspan={totalColumnsCount} class="p-0" role={explicitRoles ? 'gridcell' : undefined}>
      <div class="bg-surface-elevated/50 px-6 py-4" transition:slide={{ duration: 150 }}>
        {@render expandedRowContent(item)}
      </div>
    </td>
  </tr>
{/if}
