<script lang="ts">
  import {
    resolveIcon,
    Checkbox,
    ChevronDownIcon as ChevronDownIconDefault
  } from '@urbicon-ui/blocks';
  import { resolveDateLocale, useI18n } from '@urbicon-ui/i18n';
  import { getTableContext } from '$lib/stores/TableStore.svelte.js';
  import { useTableI18n } from '$lib/i18n';

  // See TableCell: the default `Date` branch must not reach `Intl` with
  // `undefined`, which follows the runtime and diverges across SSR.
  const i18n = useI18n();
  const cellLocale = $derived(resolveDateLocale('auto', i18n.locale));

  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);
  import { formatCellValue, resolveColumnId, resolveColumnValue } from '../utils';
  import { resolveMobileCardShape } from './mobile-card-shape';
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
    /** See `Table`'s `mobileCardDetails`. */
    details?: 'collapsed' | 'expanded';
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
    details = 'collapsed',
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
  const selectable = $derived(tableState.selectionMode !== 'none');
  const isItemSelected = $derived(selectable && checkSelected(itemId));

  const computedTestId = $derived.by(() => {
    if (testId) return testId;
    return `mobile-card-${itemId}`;
  });

  function getComponentProps(column: Column, row: TableItem) {
    const baseProps = column.componentProps ? column.componentProps(row) : {};
    return { ...baseProps, item: row };
  }

  // The card shows priority 1/unset (primary) + 2 (secondary) columns in their
  // natural order; priority 3 is desktop-only and omitted. How those columns
  // split into title / subtitle / detail grid — and who owns which gesture —
  // is resolved in mobile-card-shape.ts.
  const cardColumns = $derived(
    tableState.columns.filter((col) => !col.priority || col.priority <= 2)
  );
  const collapsible = $derived(details === 'collapsed');
  const hasCustomBlock = $derived(expandable && !!expandedRowContent);
  const shape = $derived(
    resolveMobileCardShape({
      cardColumns,
      details,
      expandable: hasCustomBlock,
      hasRowClick: !!onClick
    })
  );
  const titleColumn = $derived(shape.titleColumn);
  const subtitleColumn = $derived(shape.subtitleColumn);
  const detailColumns = $derived(shape.detailColumns);
  const hasToggle = $derived(shape.hasToggle);
  const needsOwnToggle = $derived(shape.needsOwnToggle);

  // Which expansion state the chevron drives.
  //
  // A table with `expandedRowContent` keeps the store's: that block is the
  // consumer's opt-in row expansion, `multiExpand` governs it, and the desktop
  // rows share the same state — one truth for one disclosure.
  //
  // Without it, opening a card only reveals fields the card itself is hiding.
  // That is per-card display, not table state, so each card holds its own —
  // otherwise the store's single-expand default (useExpansion) would turn every
  // mobile table into an accordion where reading record B closes record A, and
  // the only cure would be `multiExpand`, a prop whose whole documentation is
  // about `expandedRowContent` rows the consumer never asked for.
  let localOpen = $state(false);
  const isExpanded = $derived(hasCustomBlock ? checkExpanded(itemId) : localOpen);

  function toggleDetail() {
    if (hasCustomBlock) toggleExpand(itemId);
    else localOpen = !localOpen;
  }

  function handleHeadline() {
    if (shape.headlineAction === 'open') onClick?.(item);
    else if (shape.headlineAction === 'toggle') toggleDetail();
  }

  // Only the parts a closed card actually hides are gated on `isExpanded`; in
  // `expanded` mode the grid is always out.
  const showDetailGrid = $derived(detailColumns.length > 0 && (!collapsible || isExpanded));
  const showExpandedContent = $derived(hasCustomBlock && isExpanded);
  // `aria-controls` needs a target id, and two cards may not share one.
  const propsId = $props.id();
  const detailId = $derived(`mobile-card-detail-${propsId}`);

  // See TableRow: `!= null` because `0` is a legitimate id.
  const isActiveRow = $derived(tableState.activeRowId != null && tableState.activeRowId === itemId);

  const cardStyles = $derived(
    mobileCardVariants({
      size,
      // Only claim the press cue where a press actually lands — the card is no
      // longer a control, so this rides the headline button.
      interactive: shape.headlineAction !== 'none',
      selected: isItemSelected,
      active: isActiveRow,
      expanded: isExpanded,
      collapsed: collapsible && !showDetailGrid && !showExpandedContent
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
    {formatCellValue(item, column, cellLocale)}
  {/if}
{/snippet}

{#snippet headlineContent()}
  <div class={cardStyles.title()}>
    {@render renderCellContent(titleColumn as Column)}
  </div>
  {#if subtitleColumn}
    <div class={cardStyles.subtitle()}>
      {@render renderCellContent(subtitleColumn)}
    </div>
  {/if}
{/snippet}

<!--
  The card is a container, never a control: its detail grid renders consumer
  markup (`column.cell` / `column.component`), so a card-wide `role="button"`
  would nest the consumer's own links and buttons inside a control AND make one
  tap fire both. The headline carries the gesture instead — as a real `<button>`,
  so Enter/Space work without a hand-rolled keydown handler.
-->
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
>
  <!-- `hasToggle` is in the condition because a table whose every column is
       desktop-only — or whose columns the reader hid down to nothing — still
       has to offer the way into `expandedRowContent`. -->
  {#if titleColumn || selectable || hasToggle}
    <div class={cardStyles.header()}>
      {#if selectable}
        <div class="flex shrink-0 items-center">
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
        {#if shape.headlineAction === 'none'}
          <div class={cardStyles.headline()}>{@render headlineContent()}</div>
        {:else}
          <button
            type="button"
            class={cardStyles.headlineButton()}
            onclick={handleHeadline}
            aria-expanded={shape.headlineAction === 'toggle' ? isExpanded : undefined}
            aria-controls={shape.headlineAction === 'toggle' && showDetailGrid
              ? detailId
              : undefined}
            data-testid={`mobile-card-headline-${itemId}`}
          >
            <span class={cardStyles.headline()}>{@render headlineContent()}</span>
            {#if hasToggle && !needsOwnToggle}
              <!-- Inside the button it presses with it; no control of its own. -->
              <ChevronDownIcon class="{cardStyles.expandIcon()} h-5 w-5 shrink-0" />
            {/if}
          </button>
        {/if}
      {/if}

      <!-- The chevron rides in the header, not in a row of its own: a closed
           card is a header and nothing else, and a trailing actions strip would
           add back the height the collapse just saved. -->
      {#if needsOwnToggle}
        <button
          type="button"
          class={cardStyles.toggle()}
          onclick={toggleDetail}
          aria-label={isExpanded ? tt('actions.hideDetails') : tt('actions.showDetails')}
          aria-expanded={isExpanded}
          aria-controls={showDetailGrid ? detailId : undefined}
          data-testid={`mobile-card-expand-${itemId}`}
        >
          <ChevronDownIcon class="{cardStyles.expandIcon()} h-5 w-5" />
        </button>
      {/if}
    </div>
  {/if}

  {#if showDetailGrid}
    <div id={detailId} class={cardStyles.content()}>
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

  {#if showExpandedContent}
    <div class={cardStyles.expandedContent()}>
      {@render expandedRowContent?.(item)}
    </div>
  {/if}
</div>
