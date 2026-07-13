<script lang="ts">
  import { slide } from 'svelte/transition';
  import {
    resolveIcon,
    Checkbox,
    ChevronDownIcon as ChevronDownIconDefault
  } from '@urbicon-ui/blocks';
  import { getTableContext } from '$lib/stores/TableStore.svelte';
  import { useTableI18n } from '$lib/i18n';

  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);
  import { groupHeaderVariants, type GroupHeaderVariantProps } from '$lib/variants';
  import { tableRowVariants } from '$lib/variants';
  import TableCell from './TableCell.svelte';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';
  import { getStickyContext } from './sticky-context.svelte';
  import { resolveColumnId } from '$lib/utils';
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
    onRowClick = undefined
  }: GroupedRowProps = $props();

  // Table context
  const tableContext = getTableContext();
  const { state: tableState, toggleGroupExpand, toggleExpand, isItemExpanded } = tableContext;

  // Reactive computations
  const computedTestId = $derived.by(() => {
    if (testId) return testId;
    return `grouped-row-${groupName.replace(/\s+/g, '-').toLowerCase()}`;
  });

  const isExpanded = $derived.by(() => {
    return !tableState.collapsedGroups.has(groupName);
  });

  let selectable = $derived(tableState.selectionMode !== 'none');
  const styleConfig = getTableStyleConfig();
  const stickyContext = getStickyContext();

  const colSpan = $derived.by(() => {
    let count = tableState.columns.length;
    if (expandable) count++; // For expand column
    if (tableState.groupByKey) count++; // For group indentation column
    if (selectable) count++; // For selection checkbox column
    return count;
  });

  const displayGroupName = $derived.by(() => {
    if (groupName === '' || groupName === null || groupName === undefined) {
      return tt('group.noGroup');
    }
    return String(groupName);
  });

  const itemCountText = $derived.by(() => {
    const count = items.length;
    return `(${count} ${count === 1 ? tt('group.item') : tt('group.items')})`;
  });

  // Tailwind-Variants styling
  const styles = $derived(groupHeaderVariants({ size, sticky: stickyContext.mode.group }));

  // TableRow styles for individual items
  const rowStyles = $derived(
    tableRowVariants({
      state: 'default',
      size
    })
  );

  // Event handlers
  function handleToggleGroup() {
    toggleGroupExpand(groupName);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggleGroup();
    }
  }

  function handleItemToggleExpand(e: MouseEvent, row: TableItem) {
    e.stopPropagation();
    if (!expandable) return;
    const candidate = row.id ?? row.__index;
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      toggleExpand(candidate);
    }
  }
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
    aria-label="{displayGroupName} {isExpanded
      ? tt('header.collapseAllGroups')
      : tt('header.expandAllGroups')}"
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
    <tr
      class={rowStyles.row()}
      transition:slide={{ duration: 150 }}
      aria-selected={selectable ? isRowSelected : undefined}
      data-testid={`grouped-item-${rowItemId}`}
    >
      {#if selectable}
        <td class="{rowStyles.cell()} w-12" onclick={(e) => e.stopPropagation()}>
          <div class="flex h-full w-full items-center justify-center">
            <Checkbox
              checked={isRowSelected}
              onchange={() => tableContext.toggleItem(rowItemId)}
              aria-label={isRowSelected ? tt('selection.deselectRow') : tt('selection.selectRow')}
              size="sm"
            />
          </div>
        </td>
      {/if}

      {#if tableState.groupByKey}
        <td class={rowStyles.cell()} aria-hidden="true"></td>
      {/if}

      {#if expandable}
        <td class="{rowStyles.cell()} w-10">
          <div class="flex h-full w-full items-center justify-center px-2 py-2">
            <button
              class="table-expand-button rounded-modify flex h-6 w-6 items-center justify-center transition-transform duration-(--blocks-duration-fast) {isRowExpanded
                ? 'rotate-180'
                : ''}"
              onclick={(e) => handleItemToggleExpand(e, item)}
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
          cellClass={rowStyles.cell()}
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
