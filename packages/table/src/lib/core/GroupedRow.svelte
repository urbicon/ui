<script lang="ts">
  import { ChevronDownIcon as ChevronDownIconDefault, resolveIcon } from '@urbicon-ui/blocks';
  import { useTableI18n } from '#lib/i18n/index.js';
  import { getInternalTableContext } from '#lib/stores/TableStore.svelte.js';

  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);

  import type { Snippet } from 'svelte';
  import type { Column, TableItem } from '#lib/types/tableTypes.js';
  import { resolveRowItemId } from '#lib/utils/index.js';
  import { type GroupHeaderVariantProps, groupHeaderVariants } from '#lib/variants/index.js';
  import { groupCountText } from './group-count';
  import { getStickyContext } from './sticky-context.svelte';
  import { leadingStructuralColumns } from './structural-columns';
  import TableRow from './TableRow.svelte';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';

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

  // The group band spans every column the grid declares, structural ones
  // included — the same list the cells under it are built from, see
  // core/structural-columns.ts.
  const colSpan = $derived(
    tableState.columns.length +
      leadingStructuralColumns({
        grouped: !!tableState.effectiveGroupBy,
        selectable,
        expandable
      })
  );

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
</script>

<!-- Group Header Row -->
<tr
  class={resolveSlotClass(
    styles.row,
    styleConfig.slotClasses.groupHeader,
    styleConfig.unstyled,
    undefined,
    className
  )}
  data-testid={computedTestId}
  id={`grouped-item-${groupName}`}
>
  <!-- The whole band toggles on a click; the button inside is the keyboard path and the
       name, and it stays a sibling of `groupHeaderContent`, which may hold the consumer's
       own buttons. The band draws the button's focus ring, so keyboard focus outlines the
       whole band; `outline: auto` alone would take the text colour, not the platform's. -->
  <!-- biome-ignore lint/a11y/useKeyWithClickEvents: a pointer target around the toggle button, which takes the keys -->
  <td
    colspan={colSpan}
    class={[
      styles.cell(),
      'has-[[data-group-toggle]:focus-visible]:[outline:auto]',
      'has-[[data-group-toggle]:focus-visible]:[outline-color:-webkit-focus-ring-color]'
    ]}
    onclick={handleToggleGroup}
  >
    <div class={styles.content()}>
      <button
        type="button"
        class="{styles.content()} cursor-pointer focus-visible:outline-none"
        data-group-toggle
        aria-expanded={isExpanded}
        aria-label="{displayGroupName} {itemCountText} {isExpanded
          ? tt('header.collapseGroup')
          : tt('header.expandGroup')}"
      >
        <!-- Expand/Collapse Icon -->
        <span class={styles.chevron()}>
          <ChevronDownIcon class={styles.chevron()} size={16} />
        </span>

        <!-- Group Name and Count -->
        <span class={styles.content()}>
          <span class={styles.title()}>
            {displayGroupName}
          </span>
          <span class={styles.count()}>
            {itemCountText}
          </span>
        </span>
      </button>

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
