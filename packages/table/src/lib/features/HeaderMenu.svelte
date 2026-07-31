<script lang="ts">
  import { getTableContext } from '$lib/stores/TableStore.svelte';
  import { isColumnSummable } from '$lib/utils/summable';
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

  const tableContext = getTableContext();
  const {
    state: tableState,
    setGroupByKey,
    addSummaryConfig,
    removeSummaryConfig,
    removeFiltersByColumn,
    hideColumn,
    showColumn
  } = tableContext;

  let menuOpen = $state(false);

  const columnId = $derived(resolveColumnId(column));
  // Synthetic columns (no accessor) cannot participate in derived ops.
  const canSort = $derived(column.accessor !== undefined && column.sortable !== false);
  // Grouping is not implemented for the virtual list — offering it there used to
  // silently deactivate virtualization and dump every row into the DOM, which is
  // exactly what `virtualized` exists to prevent. The mode wins; the affordance goes.
  const canGroup = $derived(
    column.accessor !== undefined && column.groupable !== false && !tableState.virtualized
  );
  // Column visibility can be switched off table-wide, or pinned per column via `hideable: false`.
  const canHide = $derived(tableState.enableColumnVisibility && column.hideable !== false);

  const styles = $derived(headerMenuVariants({ active: isActive }));

  function handleSortAsc() {
    tableState.sortColumn = columnId;
    tableState.sortDirection = 'asc';
    menuOpen = false;
  }

  function handleSortDesc() {
    tableState.sortColumn = columnId;
    tableState.sortDirection = 'desc';
    menuOpen = false;
  }

  function handleGroupBy() {
    if (tableState.groupByKey === columnId) {
      setGroupByKey(null);
    } else {
      setGroupByKey(columnId);
    }
    menuOpen = false;
  }

  function handleToggleSummary() {
    const hasSummary = tableState.summaryConfigs.some((c) => c.column === columnId);

    if (hasSummary) {
      removeSummaryConfig(columnId);
    } else {
      // Synthetic columns can't reach this handler (gated by isColumnSummable),
      // so `dataType` is reachable on the narrowed data-column shape.
      const dataType = 'dataType' in column ? column.dataType : undefined;
      const summaryType = dataType === 'number' ? 'sum' : 'count';
      addSummaryConfig({
        column: columnId,
        type: summaryType
      });
    }
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

  let isSorted = $derived(tableState.sortColumn === columnId);
  let isGrouped = $derived(tableState.groupByKey === columnId);
  let hasSummary = $derived(tableState.summaryConfigs.some((c) => c.column === columnId));
  let hasFilter = $derived(tableState.activeFilters.some((f) => f.column === columnId));

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
          class={itemClass('default', isSorted && tableState.sortDirection === 'asc')}
          onclick={handleSortAsc}
        >
          <ArrowUpIcon class="h-4 w-4" />
          {tt('headerMenu.sortAscending')}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          class={itemClass('default', isSorted && tableState.sortDirection === 'desc')}
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
          onclick={handleToggleSummary}
        >
          <CalculatorIcon class="h-4 w-4" />
          {hasSummary ? tt('headerMenu.removeSummary') : tt('headerMenu.addSummary')}
        </Button>
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
