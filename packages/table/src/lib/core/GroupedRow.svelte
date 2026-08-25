<script lang="ts">
  import { resolveIcon, ChevronDownIcon as ChevronDownIconDefault } from '@urbicon-ui/blocks';
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import { useTableI18n } from '$lib/i18n';

  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);
  import { groupHeaderVariants, type GroupHeaderVariantProps } from '$lib/variants';
  import TableRow from './TableRow.svelte';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';
  import { getStickyContext } from './sticky-context.svelte';
  import { resolveRowItemId } from '$lib/utils';
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
  const { state: tableState, toggleGroup } = tableContext;

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
  const styles = $derived(groupHeaderVariants({ size, sticky: stickyContext.mode.header }));

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

<!-- Group Content Rows.

     Grouping is a wrapper around the row, not a second row renderer: the item
     rows delegate to TableRow, which owns every row capability (identity,
     selection, roving focus, expansion, live-update ring, ARIA). This
     component used to carry a full inline copy of that markup, and the copy
     had drifted in eight measured places — see Table.groupedrow.merge tests. -->
{#if isExpanded}
  {#each items as item, index (resolveRowItemId(item))}
    <TableRow
      {item}
      {expandable}
      {expandedRowContent}
      {cell}
      {size}
      {onRowClick}
      rowIndex={rowIndexOffset + index}
      ariaRowStart={tableContext.pageInfo.rangeStart}
      testId={`grouped-item-${resolveRowItemId(item)}`}
      cellTestIdPrefix="grouped-cell"
    />
  {/each}
{/if}
