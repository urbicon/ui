<script lang="ts">
  import { resolveIcon, ChevronDownIcon as ChevronDownIconDefault } from '@urbicon-ui/blocks';
  import { getTableContext } from '$lib/stores/TableStore.svelte.js';

  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);
  import { formatCellValue, resolveColumnId, resolveColumnValue } from '../utils';
  import type { Column, TableItem } from '$lib/types/tableTypes';
  import { mobileCardVariants } from '$lib/variants';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';
  import type { Snippet } from 'svelte';

  export type MobileCardProps = {
    item: TableItem;
    expandable?: boolean;
    expandedRowContent?: Snippet<[item: TableItem]>;
    cell?: Snippet<[item: TableItem, value: unknown, column: Column]>;
    onClick?: (item: TableItem) => void;
    size?: 'sm' | 'md' | 'lg';
    class?: string;
    testId?: string;
  };

  let {
    item,
    expandable = false,
    expandedRowContent = undefined,
    cell = undefined,
    onClick = undefined,
    size = 'md',
    class: className = '',
    testId = undefined
  }: MobileCardProps = $props();

  const tableContext = getTableContext();
  const { state: tableState, toggleExpand, isItemExpanded: checkExpanded } = tableContext;
  const styleConfig = getTableStyleConfig();

  const itemId = $derived.by((): string | number => {
    const candidate = item.id ?? item.__index;
    return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : -1;
  });
  let isExpanded = $derived(checkExpanded(itemId));

  const computedTestId = $derived.by(() => {
    if (testId) return testId;
    return `mobile-card-${itemId}`;
  });

  function handleClick() {
    if (onClick) {
      onClick(item);
    } else if (expandable) {
      toggleExpand(itemId);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }

  function getComponentProps(column: Column, row: TableItem) {
    const baseProps = column.componentProps ? column.componentProps(row) : {};
    return { ...baseProps, item: row };
  }

  const primaryColumns = $derived(
    tableState.columns.filter((col) => col.priority === 1 || !col.priority)
  );

  const secondaryColumns = $derived(tableState.columns.filter((col) => col.priority === 2));

  // The first visible column becomes the card title (emphasized, label-less);
  // the remaining fields fill a compact grid below it.
  const visibleColumns = $derived([...primaryColumns, ...secondaryColumns]);
  const titleColumn = $derived(visibleColumns[0]);
  const detailColumns = $derived(visibleColumns.slice(1));

  const cardStyles = $derived(
    mobileCardVariants({
      size,
      interactive: !!(expandable || onClick),
      expanded: isExpanded
    })
  );
</script>

{#snippet renderCellContent(column: Column)}
  {@const cellValue = resolveColumnValue(column, item)}
  {#if cell}
    {@render cell(item, cellValue, column)}
  {:else if column.cell}
    {@render column.cell(item, cellValue)}
  {:else if column.component}
    {@const CellComponent = column.component}
    <CellComponent {...getComponentProps(column, item)} />
  {:else if cellValue !== undefined}
    {formatCellValue(item, column)}
  {/if}
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class={resolveSlotClass(
    cardStyles.card(),
    styleConfig.slotClasses.mobileCard,
    styleConfig.unstyled,
    className
  )}
  data-testid={computedTestId}
  role={expandable || onClick ? 'button' : undefined}
  tabindex={expandable || onClick ? 0 : undefined}
  onclick={handleClick}
  onkeydown={handleKeyDown}
>
  {#if titleColumn}
    <div class={cardStyles.header()}>
      <div class={cardStyles.title()}>
        {@render renderCellContent(titleColumn)}
      </div>
    </div>
  {/if}

  {#if detailColumns.length > 0}
    <div class={cardStyles.content()}>
      <div class={cardStyles.grid()}>
        {#each detailColumns as column (resolveColumnId(column))}
          <div class={cardStyles.field()}>
            <span class={cardStyles.label()}>{column.title}</span>
            <div class={cardStyles.value()}>
              {@render renderCellContent(column)}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if expandable}
    <div class={cardStyles.actions()}>
      <ChevronDownIcon class="{cardStyles.expandIcon()} h-5 w-5" />
    </div>
  {/if}

  {#if isExpanded && expandedRowContent}
    <div class={cardStyles.expandedContent()}>
      {@render expandedRowContent(item)}
    </div>
  {/if}
</div>
