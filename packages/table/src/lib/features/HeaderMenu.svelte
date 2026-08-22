<script lang="ts">
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import {
    isColumnGroupable,
    isColumnSortable,
    isColumnSummable
  } from '$lib/utils/column-capabilities';
  import { headerMenuItemVariants, headerMenuVariants } from '$lib/variants';
  import {
    Button,
    Menu,
    MenuDivider,
    MenuItem,
    MenuSubmenu,
    resolveIcon,
    ArrowDownIcon as ArrowDownIconDefault,
    ArrowUpIcon as ArrowUpIconDefault,
    CalculatorIcon as CalculatorIconDefault,
    EyeIcon as EyeIconDefault,
    EyeOffIcon as EyeOffIconDefault,
    FilterXIcon as FilterXIconDefault,
    MoreVerticalIcon as MoreVerticalIconDefault,
    UsersIcon as UsersIconDefault,
    type MenuObjectOption
  } from '@urbicon-ui/blocks';
  import { useTableI18n } from '$lib/i18n';
  import { resolveColumnId, resolveColumnLabel } from '$lib/utils';
  import {
    SUMMARY_TYPE_LABEL_KEY,
    SUMMARY_TYPES,
    type SummaryType
  } from '$lib/utils/summary-types';
  import type { Column } from '$lib/types/tableTypes';

  const tt = useTableI18n();

  type HeaderMenuProps = {
    column: Column;
    isActive?: boolean;
  };

  const ArrowDownIcon = resolveIcon('arrowDown', ArrowDownIconDefault);
  const ArrowUpIcon = resolveIcon('arrowUp', ArrowUpIconDefault);
  const CalculatorIcon = resolveIcon('calculator', CalculatorIconDefault);
  const EyeIcon = resolveIcon('eye', EyeIconDefault);
  const EyeOffIcon = resolveIcon('eyeOff', EyeOffIconDefault);
  const FilterXIcon = resolveIcon('filterX', FilterXIconDefault);
  const MoreVerticalIcon = resolveIcon('moreVertical', MoreVerticalIconDefault);
  const UsersIcon = resolveIcon('users', UsersIconDefault);

  let { column, isActive = false }: HeaderMenuProps = $props();

  const tableContext = getInternalTableContext();
  const {
    state: tableState,
    view: tableView,
    setGroupBy,
    addSummaryConfig,
    removeSummaryConfig,
    removeFiltersByColumn,
    hideColumn,
    showColumn
  } = tableContext;

  const columnId = $derived(resolveColumnId(column));
  const canSort = $derived(isColumnSortable(column));
  // The column's own capability, plus the one condition that belongs to the
  // *table*: grouping is not implemented for the virtual list, and offering it
  // there used to silently deactivate virtualization and dump every row into
  // the DOM, which is exactly what `virtualized` exists to prevent. The mode
  // wins; the affordance goes.
  const canGroup = $derived(isColumnGroupable(column) && !tableState.virtualized);
  // Column visibility can be switched off table-wide, or pinned per column via `hideable: false`.
  const canHide = $derived(tableState.enableColumnVisibility && column.hideable !== false);

  const styles = $derived(headerMenuVariants({ active: isActive }));

  // No `open` bookkeeping: the Menu primitive closes itself after every item
  // activation, so the handlers only talk to the store.

  function handleSortAsc() {
    tableView.sort = { column: columnId, direction: 'asc' };
  }

  function handleSortDesc() {
    tableView.sort = { column: columnId, direction: 'desc' };
  }

  function handleGroupBy() {
    if (tableState.effectiveGroupBy === columnId) {
      setGroupBy(null);
    } else {
      setGroupBy(columnId);
    }
  }

  // The aggregations a column can carry come from the one vocabulary module
  // (utils/summary-types.ts), in the order the tools sheet lists them. The
  // store keeps at most one per column, so this is a choice among six states
  // rather than a set of switches — and "none" is one of the six.

  const currentSummaryType = $derived(
    tableState.summaryConfigs.find((config) => config.column === columnId)?.type
  );

  function handleSummaryType(type: SummaryType | undefined) {
    if (type) {
      addSummaryConfig({ column: columnId, type });
    } else {
      removeSummaryConfig(columnId);
    }
  }

  function handleRemoveFilters() {
    removeFiltersByColumn(columnId);
  }

  function handleHideColumn() {
    hideColumn(columnId);
  }

  function itemClass(
    intent: 'default' | 'filter' | 'group' | 'summary' | 'danger',
    active = false
  ) {
    return headerMenuItemVariants({ intent, active });
  }

  let isSorted = $derived(tableView.sort?.column === columnId);
  const sortDirection = $derived(isSorted ? tableView.sort?.direction : undefined);
  let isGrouped = $derived(tableState.effectiveGroupBy === columnId);
  const hasSummary = $derived(!!currentSummaryType);
  let hasFilter = $derived(tableView.filters.some((f) => f.column === columnId));

  /**
   * The summary entry expands into a sub-menu instead of acting, because a
   * column's aggregation is a choice and this menu used to make it silently:
   * the entry was a toggle that picked `sum` for a number column and `count`
   * for anything else, with no way to ask for an average. Expanding costs one
   * click and puts the same six states here that the tools sheet offers, so
   * the two surfaces cannot disagree about what a column is set to. The
   * active state is `checked` on the item — announced as `menuitemradio` —
   * and the collapsed parent row reads it out via `detail`.
   */
  const summaryItems = $derived.by<MenuObjectOption[]>(() => [
    ...SUMMARY_TYPES.map((type) => ({
      id: `summary-${type.value}`,
      label: tt(type.labelKey),
      checked: currentSummaryType === type.value,
      class: itemClass(
        currentSummaryType === type.value ? 'summary' : 'default',
        currentSummaryType === type.value
      ),
      onSelect: () => handleSummaryType(type.value)
    })),
    {
      id: 'summary-none',
      label: tt('summary.none'),
      checked: !currentSummaryType,
      class: itemClass('default', !currentSummaryType),
      onSelect: () => handleSummaryType(undefined)
    }
  ]);

  const hiddenColumns = $derived.by(() =>
    tableContext.allColumns.filter((col) => tableContext.hiddenColumnKeys.has(resolveColumnId(col)))
  );

  function handleShowColumn(key: string) {
    showColumn(key);
  }
</script>

<div class={styles.container()} data-testid={`header-menu-${columnId}`}>
  <Menu
    placement="bottom-start"
    syncWidth={false}
    itemSize="sm"
    slotClasses={{ content: styles.menu() }}
  >
    {#snippet customTrigger(toggle, open)}
      <Button
        variant="ghost"
        size="sm"
        class={styles.trigger()}
        aria-label="{tt('headerMenu.columnOptions')} {resolveColumnLabel(column)}"
        aria-haspopup="menu"
        aria-expanded={open}
        onclick={toggle}
        data-testid={`header-menu-trigger-${columnId}`}
      >
        <MoreVerticalIcon class="h-4 w-4" />
      </Button>
    {/snippet}

    {#if canSort}
      <!-- The two directions are one radio pair: the effective direction is
           machine-readable state (`aria-checked`), not just a tint. -->
      <MenuItem
        icon={ArrowUpIcon}
        label={tt('headerMenu.sortAscending')}
        checked={isSorted && sortDirection === 'asc'}
        class={itemClass('default', isSorted && sortDirection === 'asc')}
        onSelect={handleSortAsc}
      />
      <MenuItem
        icon={ArrowDownIcon}
        label={tt('headerMenu.sortDescending')}
        checked={isSorted && sortDirection === 'desc'}
        class={itemClass('default', isSorted && sortDirection === 'desc')}
        onSelect={handleSortDesc}
      />
      <MenuDivider />
    {/if}

    {#if hasFilter}
      <MenuItem
        icon={FilterXIcon}
        label={tt('headerMenu.removeFilter')}
        class={itemClass('filter')}
        onSelect={handleRemoveFilters}
      />
    {/if}

    {#if canGroup}
      <!-- A verb, not a radio: the entry names the one transition it performs
           ("Group by column" / "Remove grouping"), so `checked` would say the
           same thing twice with a contradicting label. -->
      <MenuItem
        icon={UsersIcon}
        label={isGrouped ? tt('headerMenu.removeGrouping') : tt('headerMenu.groupByColumn')}
        class={itemClass(isGrouped ? 'group' : 'default', isGrouped)}
        onSelect={handleGroupBy}
      />
    {/if}

    {#if isColumnSummable(column)}
      <MenuSubmenu
        id="summary"
        icon={CalculatorIcon}
        label={tt('headerMenu.summary')}
        detail={currentSummaryType
          ? tt(SUMMARY_TYPE_LABEL_KEY[currentSummaryType])
          : tt('summary.none')}
        class={itemClass(hasSummary ? 'summary' : 'default', hasSummary)}
        items={summaryItems}
      />
    {/if}

    {#if canHide}
      <MenuDivider />
      <MenuItem
        icon={EyeOffIcon}
        label={tt('headerMenu.hideColumn')}
        class={itemClass('danger')}
        onSelect={handleHideColumn}
      />
    {/if}

    {#if tableState.enableColumnVisibility && hiddenColumns.length > 0}
      <MenuDivider />
      {#each hiddenColumns as col (resolveColumnId(col))}
        <MenuItem
          icon={EyeIcon}
          label={`${tt('headerMenu.showColumn')} "${resolveColumnLabel(col)}"`}
          class={itemClass('default')}
          onSelect={() => handleShowColumn(resolveColumnId(col))}
        />
      {/each}
    {/if}
  </Menu>
</div>
