<script lang="ts">
  import {
    resolveIcon,
    Checkbox,
    ChevronDownIcon as ChevronDownIconDefault
  } from '@urbicon-ui/blocks';
  import { getTableContext } from '$lib/stores/TableStore.svelte.js';
  import { useTableI18n } from '$lib/i18n';

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

  const tt = useTableI18n();
  const tableContext = getTableContext();
  const {
    state: tableState,
    toggleExpand,
    isItemExpanded: checkExpanded,
    toggleItem,
    isSelected: checkSelected
  } = tableContext;
  const styleConfig = getTableStyleConfig();

  const itemId = $derived.by((): string | number => {
    const candidate = item.id ?? item.__index;
    return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : -1;
  });
  let isExpanded = $derived(checkExpanded(itemId));

  const selectable = $derived(tableState.selectionMode !== 'none');
  const isItemSelected = $derived(selectable && checkSelected(itemId));

  // The whole card may act as one button only when it has no focusable child —
  // a selection checkbox inside a role="button" is a nested-interactive a11y
  // violation. Selectable cards therefore use dedicated controls (the checkbox
  // for selection, a chevron button for expand) instead of a card-wide button.
  const cardActsAsButton = $derived(!selectable && (expandable || !!onClick));
  // A selectable card still forwards a pointer click to onClick, but not expand
  // (that's the chevron button's job) — so only bind onclick when it does something.
  const cardClickable = $derived(cardActsAsButton || (selectable && !!onClick));

  // Keep checkbox / expand-button interaction from also triggering the card click.
  function stopSelectionBubble(event: Event) {
    event.stopPropagation();
  }

  const computedTestId = $derived.by(() => {
    if (testId) return testId;
    return `mobile-card-${itemId}`;
  });

  function handleClick() {
    if (onClick) {
      onClick(item);
    } else if (cardActsAsButton && expandable) {
      toggleExpand(itemId);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }

  function handleExpandClick(event: MouseEvent) {
    event.stopPropagation();
    toggleExpand(itemId);
  }

  function getComponentProps(column: Column, row: TableItem) {
    const baseProps = column.componentProps ? column.componentProps(row) : {};
    return { ...baseProps, item: row };
  }

  // The card shows priority 1/unset (primary) + 2 (secondary) columns in their
  // natural order; priority 3 is desktop-only and omitted. The first such column
  // becomes the emphasized, label-less title; the rest fill a compact grid.
  const cardColumns = $derived(
    tableState.columns.filter((col) => !col.priority || col.priority <= 2)
  );
  const titleColumn = $derived(cardColumns[0]);
  const detailColumns = $derived(cardColumns.slice(1));

  // See TableRow: `!= null` because `0` is a legitimate id.
  const isActiveRow = $derived(tableState.activeRowId != null && tableState.activeRowId === itemId);

  const cardStyles = $derived(
    mobileCardVariants({
      size,
      interactive: !!(expandable || onClick),
      selected: isItemSelected,
      active: isActiveRow,
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

<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div
  class={resolveSlotClass(
    cardStyles.card,
    styleConfig.slotClasses.mobileCard,
    styleConfig.unstyled,
    className
  )}
  data-testid={computedTestId}
  data-active={isActiveRow ? '' : undefined}
  aria-current={isActiveRow ? 'true' : undefined}
  role={cardActsAsButton ? 'button' : undefined}
  tabindex={cardActsAsButton ? 0 : undefined}
  onclick={cardClickable ? handleClick : undefined}
  onkeydown={cardActsAsButton ? handleKeyDown : undefined}
>
  {#if titleColumn || selectable}
    <div class={cardStyles.header()}>
      {#if selectable}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="flex shrink-0 items-center"
          onclick={stopSelectionBubble}
          onkeydown={stopSelectionBubble}
        >
          <Checkbox
            checked={isItemSelected}
            onCheckedChange={() => toggleItem(itemId)}
            aria-label={isItemSelected ? tt('selection.deselectRow') : tt('selection.selectRow')}
            size="sm"
            data-testid={`mobile-card-checkbox-${itemId}`}
          />
        </div>
      {/if}
      {#if titleColumn}
        <div class={cardStyles.title()}>
          {@render renderCellContent(titleColumn)}
        </div>
      {/if}
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
      {#if cardActsAsButton}
        <!-- The whole card is the button; the chevron is a visual affordance. -->
        <ChevronDownIcon class="{cardStyles.expandIcon()} h-5 w-5" />
      {:else}
        <!-- Selectable card → the card can't be a button, so expand has its own. -->
        <button
          type="button"
          class="rounded-modify hover:bg-surface-hover flex h-11 w-11 items-center justify-center transition-colors duration-[var(--blocks-duration-fast)]"
          onclick={handleExpandClick}
          aria-label={isExpanded ? tt('actions.hideDetails') : tt('actions.showDetails')}
          aria-expanded={isExpanded}
          data-testid={`mobile-card-expand-${itemId}`}
        >
          <ChevronDownIcon class="{cardStyles.expandIcon()} h-5 w-5" />
        </button>
      {/if}
    </div>
  {/if}

  {#if isExpanded && expandedRowContent}
    <div class={cardStyles.expandedContent()}>
      {@render expandedRowContent(item)}
    </div>
  {/if}
</div>
