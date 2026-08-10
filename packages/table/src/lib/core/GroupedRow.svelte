<script lang="ts">
  import { slide } from 'svelte/transition';
  import {
    resolveIcon,
    Checkbox,
    ChevronDownIcon as ChevronDownIconDefault
  } from '@urbicon-ui/blocks';
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import { useTableI18n } from '$lib/i18n';

  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);
  import { groupHeaderVariants, type GroupHeaderVariantProps } from '$lib/variants';
  import { tableRowVariants } from '$lib/variants';
  import TableCell from './TableCell.svelte';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';
  import { resolveRowClickActions } from './row-interaction';
  import { getStickyContext } from './sticky-context.svelte';
  import { resolveColumnId } from '$lib/utils';
  import { groupCountText } from './group-count';
  import type { Column, TableItem } from '$lib/types/tableTypes';
  import type { Snippet } from 'svelte';

  const tt = useTableI18n();

  export type GroupedRowProps = {
    groupName: string;
    items: TableItem[];
    expandable?: boolean;
    expandedRowContent?: Snippet<[item: TableItem]>;
    cell?: Snippet<[item: TableItem, value: unknown, column: Column]>;
    size?: GroupHeaderVariantProps['size'];
    class?: string;
    testId?: string;
    groupHeaderContent?: Snippet<[groupName: string, items: TableItem[], isExpanded: boolean]>;
    onRowClick?: (item: TableItem) => void;
    /**
     * Index of this group's first item row within `tableContext.navigableItems`
     * — the flat, visual-order index space the roving tabindex moves through.
     * Supplied by TableDesktop, which accumulates it across the rendered groups
     * (skipping collapsed ones, which render no item rows).
     */
    rowIndexOffset?: number;
  };

  let {
    groupName,
    items,
    expandable = false,
    expandedRowContent = undefined,
    cell = undefined,
    size = 'md',
    class: className = '',
    testId = undefined,
    groupHeaderContent,
    onRowClick = undefined,
    rowIndexOffset = 0
  }: GroupedRowProps = $props();

  // Table context
  const tableContext = getInternalTableContext();
  const { state: tableState, toggleGroup, toggleExpand, isItemExpanded } = tableContext;

  // Reactive computations
  const computedTestId = $derived.by(() => {
    if (testId) return testId;
    return `grouped-row-${groupName.replace(/\s+/g, '-').toLowerCase()}`;
  });

  const isExpanded = $derived.by(() => {
    return !tableState.collapsedGroups.has(groupName);
  });

  let selectable = $derived(tableState.selectionMode !== 'none');
  // Same rule as TableRow: a row only joins the roving sequence when there is
  // something to do with it.
  let interactive = $derived(selectable || expandable || !!onRowClick);
  const styleConfig = getTableStyleConfig();
  const stickyContext = getStickyContext();

  const colSpan = $derived.by(() => {
    let count = tableState.columns.length;
    if (expandable) count++; // For expand column
    if (tableState.effectiveGroupBy) count++; // For group indentation column
    if (selectable) count++; // For selection checkbox column
    return count;
  });

  const displayGroupName = $derived.by(() => {
    if (groupName === '' || groupName === null || groupName === undefined) {
      return tt('group.noGroup');
    }
    return String(groupName);
  });

  const itemCountText = $derived(groupCountText(items.length, tableState.mode, tt));

  // Tailwind-Variants styling
  const styles = $derived(groupHeaderVariants({ size, sticky: stickyContext.mode.group }));

  // Item-row styles are resolved per row (inside the each), because the
  // selected/expanded state is per row — this block used to pin `state:
  // 'default'` for all of them, so a selected row in a group never picked up
  // the selected tint.

  // Event handlers
  function handleToggleGroup() {
    toggleGroup(groupName);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggleGroup();
    }
  }

  function handleItemToggleExpand(e: MouseEvent, rowItemId: string | number) {
    e.stopPropagation();
    if (!expandable) return;
    toggleExpand(rowItemId);
  }

  // Same click semantics as the flat rows (TableRow) — grouped rows previously
  // took `onRowClick` as a prop and never wired it, so a click did nothing here.
  function handleItemRowClick(event: MouseEvent, row: TableItem, rowItemId: string | number) {
    const actions = resolveRowClickActions({
      hasRowClickHandler: !!onRowClick,
      expandable,
      rowClickSelects: tableState.rowClickSelects,
      selectable,
      row: event.currentTarget as Node | null
    });
    if (actions.fireRowClick) {
      onRowClick?.(row);
    }
    if (actions.toggleExpand) {
      toggleExpand(rowItemId);
    }
    if (actions.toggleSelection) {
      tableContext.toggleItem(rowItemId);
    }
  }

  const selectsOnClick = $derived(tableState.rowClickSelects && selectable);
  const clickable = $derived(expandable || !!onRowClick || selectsOnClick);
</script>

<!-- Group Header Row -->
<tr
  class={resolveSlotClass(
    styles.row,
    styleConfig.slotClasses.groupHeader,
    styleConfig.unstyled,
    className
  )}
  data-testid={computedTestId}
  id={`grouped-item-${groupName}`}
>
  <td
    colspan={colSpan}
    class={styles.cell()}
    onclick={handleToggleGroup}
    onkeydown={handleKeyDown}
    role="button"
    tabindex="0"
    aria-expanded={isExpanded}
    aria-label="{displayGroupName} {itemCountText} {isExpanded
      ? tt('header.collapseGroup')
      : tt('header.expandGroup')}"
  >
    <div class={styles.content()}>
      <!-- Expand/Collapse Icon -->
      <div class={styles.chevron()}>
        <ChevronDownIcon class={styles.chevron()} size={16} />
      </div>

      <!-- Group Name and Count -->
      <div class={styles.content()}>
        <span class={styles.title()}>
          {displayGroupName}
        </span>
        <span class={styles.count()}>
          {itemCountText}
        </span>
      </div>

      <!-- Custom header content or actions -->
      <div class={styles.actions()}>
        {#if groupHeaderContent}
          {@render groupHeaderContent(groupName, items, isExpanded)}
        {/if}
      </div>
    </div>
  </td>
</tr>

<!-- Group Content Rows -->
{#if isExpanded}
  {#each items as item, index (item.id ?? index)}
    {@const rowItemId =
      typeof item.id === 'string' || typeof item.id === 'number' ? item.id : index}
    {@const isRowExpanded = isItemExpanded(rowItemId)}
    {@const isRowSelected = selectable && tableContext.isSelected(rowItemId)}
    {@const isActiveRow = tableState.activeRowId != null && tableState.activeRowId === rowItemId}
    {@const itemStyles = tableRowVariants({
      state: isRowSelected
        ? 'selected'
        : isActiveRow
          ? 'active'
          : isRowExpanded
            ? 'expanded'
            : 'default',
      size
    })}
    <tr
      class={resolveSlotClass(
        itemStyles.row,
        styleConfig.slotClasses.row,
        styleConfig.unstyled,
        [
          clickable ? 'cursor-pointer' : '',
          // `select-none` only where the click has no selection meaning — see TableRow.
          clickable && !selectsOnClick ? 'select-none' : ''
        ]
          .filter(Boolean)
          .join(' ')
      )}
      onclick={(event) => handleItemRowClick(event, item, rowItemId)}
      transition:slide={{ duration: 150 }}
      tabindex={interactive
        ? tableContext.isFocusedRow(rowIndexOffset + index)
          ? 0
          : -1
        : undefined}
      aria-rowindex={rowIndexOffset + index + 1}
      aria-selected={selectable ? isRowSelected : undefined}
      aria-current={isActiveRow ? 'true' : undefined}
      data-row-index={rowIndexOffset + index}
      data-active={isActiveRow ? '' : undefined}
      data-testid={`grouped-item-${rowItemId}`}
    >
      {#if selectable}
        <td class="{itemStyles.cell()} w-12" onclick={(e) => e.stopPropagation()}>
          <div class="flex h-full w-full items-center justify-center">
            <Checkbox
              checked={isRowSelected}
              onCheckedChange={() => tableContext.toggleItem(rowItemId)}
              aria-label={isRowSelected ? tt('selection.deselectRow') : tt('selection.selectRow')}
              size="sm"
            />
          </div>
        </td>
      {/if}

      {#if tableState.effectiveGroupBy}
        <td class={itemStyles.cell()} aria-hidden="true"></td>
      {/if}

      {#if expandable}
        <td class="{itemStyles.cell()} w-10">
          <div class="flex h-full w-full items-center justify-center px-2 py-2">
            <button
              class="table-expand-button rounded-modify flex h-6 w-6 items-center justify-center transition-transform duration-(--blocks-duration-fast) {isRowExpanded
                ? 'rotate-180'
                : ''}"
              onclick={(e) => handleItemToggleExpand(e, rowItemId)}
              aria-label={tt('actions.showDetails')}
              data-testid={`expand-button-${rowItemId}`}
            >
              <ChevronDownIcon class="h-4 w-4" />
            </button>
          </div>
        </td>
      {/if}

      {#each tableContext.orderedColumns as column (resolveColumnId(column))}
        <TableCell
          {item}
          {column}
          {cell}
          {size}
          cellClass={resolveSlotClass(
            itemStyles.cell,
            styleConfig.slotClasses.cell,
            styleConfig.unstyled
          )}
          testIdPrefix="grouped-cell"
        />
      {/each}
    </tr>

    <!-- Expanded row content -->
    {#if isRowExpanded && expandedRowContent}
      <tr data-testid={`expanded-row-${rowItemId}`} class="border-b-0">
        <td colspan={colSpan} class="p-0">
          <div class="bg-surface-elevated/50 px-6 py-4" transition:slide={{ duration: 150 }}>
            {@render expandedRowContent(item)}
          </div>
        </td>
      </tr>
    {/if}
  {/each}
{/if}
