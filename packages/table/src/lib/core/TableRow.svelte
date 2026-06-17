<script lang="ts">
  import {
    resolveIcon,
    Checkbox,
    ChevronDownIcon as ChevronDownIconDefault
  } from '@urbicon-ui/blocks';
  import { slide } from 'svelte/transition';

  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);
  import { getTableContext } from '$lib/stores/TableStore.svelte';
  import { useTableI18n } from '$lib/i18n';
  import { tableRowVariants } from '$lib/variants';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';
  import TableCell from './TableCell.svelte';
  import { resolveColumnId } from '$lib/utils';
  import type { Column, TableItem } from '$lib/types/tableTypes';
  import type { Snippet } from 'svelte';

  const tt = useTableI18n();

  const tableContext = getTableContext();
  const { state: tableState, toggleExpand, isItemExpanded } = tableContext;
  const styleConfig = getTableStyleConfig();

  let selectable = $derived(tableState.selectionMode !== 'none');

  let {
    item,
    expandable = false,
    virtualized = false,
    virtualIndex = 0,
    virtualItemHeight = 48,
    rowIndex = 0,
    expandedRowContent = undefined as Snippet<[item: TableItem]> | undefined,
    cell = undefined as Snippet<[item: TableItem, value: unknown, column: Column]> | undefined,
    onRowClick = undefined as ((item: TableItem) => void) | undefined,
    size = 'md' as const
  } = $props();

  let isFocused = $derived(tableContext.isFocusedRow(rowIndex));
  let interactive = $derived(selectable || expandable || !!onRowClick);

  const itemId = $derived.by((): string | number => {
    const candidate = item.id ?? item.__index;
    return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : -1;
  });
  let isExpanded = $derived(isItemExpanded(itemId));

  let isRowSelected = $derived(selectable && tableContext.isSelected(itemId));
  let isRecentlyUpdated = $derived(tableContext.isRecentlyUpdated(itemId));

  const totalColumnsCount = $derived.by(() => {
    let count = tableState.columns.length;
    if (tableState.groupByKey) count += 1;
    if (expandable) count += 1;
    if (selectable) count += 1;
    return count;
  });

  function handleRowClick() {
    if (onRowClick) {
      onRowClick(item);
    }
    if (expandable) {
      toggleExpand(itemId);
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

  const rowStyles = $derived(
    tableRowVariants({
      state: isRowSelected ? 'selected' : isExpanded ? 'expanded' : 'default',
      size
    })
  );
</script>

<!-- Main row -->
<tr
  id={String(itemId)}
  onclick={handleRowClick}
  class={resolveSlotClass(
    rowStyles.row(),
    styleConfig.slotClasses.row,
    styleConfig.unstyled,
    [
      expandable || onRowClick ? 'cursor-pointer select-none' : '',
      isRecentlyUpdated
        ? 'ring-success/30 bg-success-subtle/30 ring-2 transition-[box-shadow,background-color] duration-1000 ring-inset'
        : ''
    ]
      .filter(Boolean)
      .join(' ')
  )}
  style={virtualized
    ? `position: absolute; transform: translateY(${virtualIndex * virtualItemHeight}px);`
    : ''}
  tabindex={interactive ? (isFocused ? 0 : -1) : undefined}
  aria-rowindex={rowIndex + 1}
  aria-expanded={expandable ? isExpanded : undefined}
  aria-selected={selectable ? isRowSelected : undefined}
  data-row-index={rowIndex}
  data-testid={`table-row-${itemId}`}
>
  {#if selectable}
    <td class="{rowStyles.cell()} w-12" onclick={handleCheckboxClick}>
      <div class="flex h-full w-full items-center justify-center">
        <Checkbox
          checked={isRowSelected}
          onchange={() => tableContext.toggleItem(itemId)}
          aria-label={isRowSelected ? tt('selection.deselectRow') : tt('selection.selectRow')}
          size="sm"
          data-testid={`selection-checkbox-${itemId}`}
        />
      </div>
    </td>
  {/if}

  {#if expandable}
    <td class="{rowStyles.cell()} w-10">
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
      colIndex={colIdx}
      cellClass={resolveSlotClass(
        rowStyles.cell(),
        styleConfig.slotClasses.cell,
        styleConfig.unstyled
      )}
      testIdPrefix="cell"
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
