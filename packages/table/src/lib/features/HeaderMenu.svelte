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
    Popover,
    resolveIcon,
    ArrowDownIcon as ArrowDownIconDefault,
    ArrowUpIcon as ArrowUpIconDefault,
    CalculatorIcon as CalculatorIconDefault,
    EyeIcon as EyeIconDefault,
    EyeOffIcon as EyeOffIconDefault,
    FilterXIcon as FilterXIconDefault,
    MoreVerticalIcon as MoreVerticalIconDefault,
    UsersIcon as UsersIconDefault
  } from '@urbicon-ui/blocks';
  import { useTableI18n } from '$lib/i18n';
  import { resolveColumnId, resolveColumnLabel } from '$lib/utils';
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

  let menuOpen = $state(false);

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

  function handleSortAsc() {
    tableView.sort = { column: columnId, direction: 'asc' };
    menuOpen = false;
  }

  function handleSortDesc() {
    tableView.sort = { column: columnId, direction: 'desc' };
    menuOpen = false;
  }

  function handleGroupBy() {
    if (tableState.effectiveGroupBy === columnId) {
      setGroupBy(null);
    } else {
      setGroupBy(columnId);
    }
    menuOpen = false;
  }

  /**
   * The aggregations a column can carry, in the order the tools sheet lists
   * them. The store keeps at most one per column, so this is a choice among
   * six states rather than a set of switches — and "none" is one of the six.
   */
  const SUMMARY_TYPES = [
    { value: 'sum', label: () => tt('summary.types.sum') },
    { value: 'avg', label: () => tt('summary.types.average') },
    { value: 'count', label: () => tt('summary.types.count') },
    { value: 'min', label: () => tt('summary.types.minimum') },
    { value: 'max', label: () => tt('summary.types.maximum') }
  ] as const;

  /**
   * The summary row expands instead of acting, because a column's aggregation
   * is a choice and this menu used to make it silently: the entry was a toggle
   * that picked `sum` for a number column and `count` for anything else, with
   * no way to ask for an average. Expanding costs one click and puts the same
   * six states here that the tools sheet offers, so the two surfaces can no
   * longer disagree about what a column is set to.
   */
  let summaryOpen = $state(false);

  const currentSummaryType = $derived(
    tableState.summaryConfigs.find((config) => config.column === columnId)?.type
  );

  function handleSummaryType(type: string | undefined) {
    if (type) {
      addSummaryConfig({ column: columnId, type: type as (typeof SUMMARY_TYPES)[number]['value'] });
    } else {
      removeSummaryConfig(columnId);
    }
    summaryOpen = false;
    menuOpen = false;
  }

  function handleRemoveFilters() {
    removeFiltersByColumn(columnId);
    menuOpen = false;
  }

  function handleHideColumn() {
    hideColumn(columnId);
    menuOpen = false;
  }

  function itemClass(
    intent: 'default' | 'filter' | 'group' | 'summary' | 'danger',
    active = false
  ) {
    return headerMenuItemVariants({ intent, active });
  }

  let isSorted = $derived(tableView.sort?.column === columnId);
  let isGrouped = $derived(tableState.effectiveGroupBy === columnId);
  const hasSummary = $derived(!!currentSummaryType);
  let hasFilter = $derived(tableView.filters.some((f) => f.column === columnId));

  const hiddenColumns = $derived.by(() =>
    tableContext.allColumns.filter((col) => tableContext.hiddenColumnKeys.has(resolveColumnId(col)))
  );

  function handleShowColumn(key: string) {
    showColumn(key);
    menuOpen = false;
  }
</script>

<div class={styles.container()} data-testid={`header-menu-${columnId}`}>
  <Popover bind:open={menuOpen} placement="bottom-start">
    {#snippet trigger()}
      <Button
        variant="ghost"
        size="sm"
        class={styles.trigger()}
        aria-label="{tt('headerMenu.columnOptions')} {resolveColumnLabel(column)}"
        data-testid={`header-menu-trigger-${columnId}`}
      >
        <MoreVerticalIcon class="h-4 w-4" />
      </Button>
    {/snippet}

    <div class={styles.menu()}>
      {#if canSort}
        <Button
          variant="ghost"
          size="sm"
          class={itemClass('default', isSorted && tableView.sort?.direction === 'asc')}
          onclick={handleSortAsc}
        >
          <ArrowUpIcon class="h-4 w-4" />
          {tt('headerMenu.sortAscending')}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          class={itemClass('default', isSorted && tableView.sort?.direction === 'desc')}
          onclick={handleSortDesc}
        >
          <ArrowDownIcon class="h-4 w-4" />
          {tt('headerMenu.sortDescending')}
        </Button>

        <div class={styles.separator()}></div>
      {/if}

      {#if hasFilter}
        <Button variant="ghost" size="sm" class={itemClass('filter')} onclick={handleRemoveFilters}>
          <FilterXIcon class="h-4 w-4" />
          {tt('headerMenu.removeFilter')}
        </Button>
      {/if}

      {#if canGroup}
        <Button
          variant="ghost"
          size="sm"
          class={itemClass(isGrouped ? 'group' : 'default', isGrouped)}
          onclick={handleGroupBy}
        >
          <UsersIcon class="h-4 w-4" />
          {isGrouped ? tt('headerMenu.removeGrouping') : tt('headerMenu.groupByColumn')}
        </Button>
      {/if}

      {#if isColumnSummable(column)}
        <Button
          variant="ghost"
          size="sm"
          class={itemClass(hasSummary ? 'summary' : 'default', hasSummary)}
          aria-expanded={summaryOpen}
          data-testid={`header-menu-summary-${columnId}`}
          onclick={() => (summaryOpen = !summaryOpen)}
        >
          <CalculatorIcon class="h-4 w-4" />
          {tt('headerMenu.summary')}
          <span class={styles.itemValue()}>
            {currentSummaryType
              ? (SUMMARY_TYPES.find((t) => t.value === currentSummaryType)?.label() ?? '')
              : tt('summary.none')}
          </span>
        </Button>

        {#if summaryOpen}
          <div class={styles.submenu()} data-testid={`header-menu-summary-types-${columnId}`}>
            {#each SUMMARY_TYPES as type (type.value)}
              <Button
                variant="ghost"
                size="sm"
                class={itemClass(
                  currentSummaryType === type.value ? 'summary' : 'default',
                  currentSummaryType === type.value
                )}
                aria-pressed={currentSummaryType === type.value}
                onclick={() => handleSummaryType(type.value)}
              >
                {type.label()}
              </Button>
            {/each}
            <Button
              variant="ghost"
              size="sm"
              class={itemClass('default', !currentSummaryType)}
              aria-pressed={!currentSummaryType}
              onclick={() => handleSummaryType(undefined)}
            >
              {tt('summary.none')}
            </Button>
          </div>
        {/if}
      {/if}

      {#if canHide}
        <div class={styles.separator()}></div>
        <Button variant="ghost" size="sm" class={itemClass('danger')} onclick={handleHideColumn}>
          <EyeOffIcon class="h-4 w-4" />
          {tt('headerMenu.hideColumn')}
        </Button>
      {/if}

      {#if tableState.enableColumnVisibility && hiddenColumns.length > 0}
        <div class={styles.separator()}></div>
        {#each hiddenColumns as col (resolveColumnId(col))}
          <Button
            variant="ghost"
            size="sm"
            class={itemClass('default')}
            onclick={() => handleShowColumn(resolveColumnId(col))}
          >
            <EyeIcon class="h-4 w-4" />
            {tt('headerMenu.showColumn')} "{resolveColumnLabel(col)}"
          </Button>
        {/each}
      {/if}
    </div>
  </Popover>
</div>
